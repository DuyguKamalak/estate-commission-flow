import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { TransactionStage } from '../../common/enums/transaction-stage.enum';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { AgentsService } from '../agents/agents.service';
import { CommissionBreakdown } from '../commissions/schemas/commission-breakdown.schema';
import { TransactionsService } from './transactions.service';
import { Transaction } from './schemas/transaction.schema';
import { TransactionStageHistory } from './schemas/transaction-stage-history.schema';

function chainableList(result: unknown[]) {
  const q: Record<string, jest.Mock> = {};
  q.sort = jest.fn().mockReturnValue(q);
  q.skip = jest.fn().mockReturnValue(q);
  q.limit = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(result);
  return q;
}

/**
 * Fake connection whose `withTransaction` invokes the callback eagerly
 * with a stand-in session object. Enough for exercising write sequencing
 * without spinning up a real replica set.
 */
function fakeConnection() {
  const session = { fake: true };
  const run = jest.fn(async (cb: () => Promise<void>) => {
    await cb();
  });
  return {
    session,
    run,
    startSession: jest.fn().mockResolvedValue({
      withTransaction: run,
      endSession: jest.fn(),
    }),
  };
}

describe('TransactionsService', () => {
  let service: TransactionsService;

  const txModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const historyModel = {
    create: jest.fn(),
    find: jest.fn(),
  };

  const breakdownModel = {
    create: jest.fn(),
  };

  const agentsService = {
    assertActiveAgentExists: jest.fn(),
  } as unknown as AgentsService;

  let connection: ReturnType<typeof fakeConnection>;

  beforeEach(async () => {
    jest.clearAllMocks();
    connection = fakeConnection();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getModelToken(Transaction.name), useValue: txModel },
        {
          provide: getModelToken(TransactionStageHistory.name),
          useValue: historyModel,
        },
        {
          provide: getModelToken(CommissionBreakdown.name),
          useValue: breakdownModel,
        },
        { provide: getConnectionToken(), useValue: connection },
        { provide: AgentsService, useValue: agentsService },
      ],
    }).compile();

    service = moduleRef.get(TransactionsService);
    (agentsService.assertActiveAgentExists as jest.Mock).mockResolvedValue({});
  });

  /* --------------------------- create ------------------------------ */

  describe('create', () => {
    const listingId = new Types.ObjectId().toHexString();
    const sellingId = new Types.ObjectId().toHexString();
    const dto = {
      propertyTitle: 'Flat 3, Tower House',
      propertyAddress: '12 High Street, London',
      transactionType: TransactionType.SALE,
      totalServiceFee: 1_000_000,
      listingAgentId: listingId,
      sellingAgentId: sellingId,
    };

    it('validates both agents and writes tx + initial history', async () => {
      const created = { _id: new Types.ObjectId(), stage: 'agreement' };
      txModel.create.mockResolvedValueOnce([created]);
      historyModel.create.mockResolvedValueOnce([{}]);

      const result = await service.create(dto);

      expect(agentsService.assertActiveAgentExists).toHaveBeenCalledWith(
        listingId,
      );
      expect(agentsService.assertActiveAgentExists).toHaveBeenCalledWith(
        sellingId,
      );
      expect(agentsService.assertActiveAgentExists).toHaveBeenCalledTimes(2);

      const txCreateArg = (txModel.create.mock.calls[0][0] as Array<Record<string, unknown>>)[0];
      expect(txCreateArg).toMatchObject({
        propertyTitle: dto.propertyTitle,
        transactionType: dto.transactionType,
        totalServiceFee: dto.totalServiceFee,
        stage: TransactionStage.AGREEMENT,
        currency: 'GBP',
      });
      expect(typeof txCreateArg.referenceCode).toBe('string');
      expect(txCreateArg.referenceCode as string).toMatch(
        /^TRX-\d{4}-[A-Z2-9]{6}$/,
      );

      const histCreateArg = (historyModel.create.mock.calls[0][0] as Array<
        Record<string, unknown>
      >)[0];
      expect(histCreateArg).toMatchObject({
        fromStage: null,
        toStage: TransactionStage.AGREEMENT,
        triggeredBy: 'system',
      });

      expect(result).toBe(created);
    });

    it('validates the agent only once when listing equals selling', async () => {
      txModel.create.mockResolvedValueOnce([{ _id: new Types.ObjectId() }]);
      historyModel.create.mockResolvedValueOnce([{}]);

      await service.create({ ...dto, sellingAgentId: listingId });

      expect(agentsService.assertActiveAgentExists).toHaveBeenCalledTimes(1);
    });

    it('retries once on a reference-code collision', async () => {
      txModel.create
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce([{ _id: new Types.ObjectId() }]);
      historyModel.create.mockResolvedValueOnce([{}]);

      await service.create(dto);

      expect(txModel.create).toHaveBeenCalledTimes(2);
    });

    it('surfaces REFERENCE_CODE_COLLISION after exhausting retries', async () => {
      txModel.create.mockRejectedValue({ code: 11000 });

      const err = await service.create(dto).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictDomainException);
      expect((err as ConflictDomainException).errorCode).toBe(
        ErrorCode.REFERENCE_CODE_COLLISION,
      );
      expect(txModel.create).toHaveBeenCalledTimes(5);
    });

    it('propagates non-duplicate errors from the write', async () => {
      const boom = new Error('network down');
      txModel.create.mockRejectedValueOnce(boom);

      await expect(service.create(dto)).rejects.toBe(boom);
    });

    it('bubbles up the agent-validation failure without issuing writes', async () => {
      (agentsService.assertActiveAgentExists as jest.Mock).mockRejectedValueOnce(
        new DomainException(ErrorCode.AGENT_INACTIVE, 'inactive'),
      );

      await expect(service.create(dto)).rejects.toMatchObject({
        errorCode: ErrorCode.AGENT_INACTIVE,
      });
      expect(txModel.create).not.toHaveBeenCalled();
    });
  });

  /* --------------------------- read -------------------------------- */

  describe('findById', () => {
    it('throws TRANSACTION_NOT_FOUND on invalid ObjectId', async () => {
      const err = await service.findById('nope').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundDomainException);
      expect((err as NotFoundDomainException).errorCode).toBe(
        ErrorCode.TRANSACTION_NOT_FOUND,
      );
    });

    it('throws when the document is missing', async () => {
      txModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findById(new Types.ObjectId().toHexString()),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.TRANSACTION_NOT_FOUND,
      });
    });
  });

  describe('findByReferenceCode', () => {
    it('rejects malformed codes with INVALID_REFERENCE_CODE', async () => {
      const err = await service
        .findByReferenceCode('not-a-code')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).errorCode).toBe(
        ErrorCode.INVALID_REFERENCE_CODE,
      );
    });

    it('uppercases and queries by referenceCode', async () => {
      const doc = { _id: new Types.ObjectId() };
      txModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });
      const out = await service.findByReferenceCode('TRX-2026-ABC234');
      expect(txModel.findOne).toHaveBeenCalledWith({
        referenceCode: 'TRX-2026-ABC234',
      });
      expect(out).toBe(doc);
    });
  });

  describe('findAll', () => {
    it('translates filters into a Mongo query and paginates', async () => {
      txModel.find.mockReturnValueOnce(chainableList([{ _id: 'a' }]));
      txModel.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({
        stage: TransactionStage.AGREEMENT,
        transactionType: TransactionType.SALE,
        referenceCode: 'TRX-2026-ABC234',
        page: 1,
        pageSize: 20,
      });

      expect(txModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: TransactionStage.AGREEMENT,
          transactionType: TransactionType.SALE,
          referenceCode: 'TRX-2026-ABC234',
        }),
      );
      expect(result.total).toBe(1);
    });

    it('combines anyAgentId and search using $and', async () => {
      txModel.find.mockReturnValueOnce(chainableList([]));
      txModel.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0),
      });
      const agentId = new Types.ObjectId().toHexString();

      await service.findAll({
        anyAgentId: agentId,
        search: 'chelsea',
        page: 1,
        pageSize: 20,
      });

      const filter = txModel.find.mock.calls[0][0] as {
        $and: Array<Record<string, unknown>>;
        $or?: unknown;
      };
      expect(filter.$and).toHaveLength(2);
      expect(filter.$or).toBeUndefined();
    });
  });

  /* --------------------------- advanceStage ------------------------ */

  describe('advanceStage', () => {
    const txId = new Types.ObjectId();
    const baseTx = {
      _id: txId,
      stage: TransactionStage.AGREEMENT,
      totalServiceFee: 10_001,
      currency: 'GBP',
      listingAgentId: new Types.ObjectId(),
      sellingAgentId: new Types.ObjectId(),
    };

    beforeEach(() => {
      txModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(baseTx),
      });
    });

    it('advances one step and writes a history row', async () => {
      const updatedTx = { ...baseTx, stage: TransactionStage.EARNEST_MONEY };
      txModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updatedTx),
      });
      historyModel.create.mockResolvedValueOnce([{}]);

      const result = await service.advanceStage(txId.toHexString(), {
        toStage: TransactionStage.EARNEST_MONEY,
        reason: 'Deposit received',
      });

      expect(txModel.findByIdAndUpdate).toHaveBeenCalledWith(
        txId,
        expect.objectContaining({
          stage: TransactionStage.EARNEST_MONEY,
          earnestMoneyDate: expect.any(Date),
        }),
        expect.objectContaining({ new: true, runValidators: true }),
      );
      expect(historyModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            fromStage: TransactionStage.AGREEMENT,
            toStage: TransactionStage.EARNEST_MONEY,
            reason: 'Deposit received',
          }),
        ],
        expect.any(Object),
      );
      expect(breakdownModel.create).not.toHaveBeenCalled();
      expect(result).toBe(updatedTx);
    });

    it('rejects skipping stages via the stage machine', async () => {
      await expect(
        service.advanceStage(txId.toHexString(), {
          toStage: TransactionStage.COMPLETED,
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.INVALID_STAGE_TRANSITION,
      });
      expect(txModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('persists a commission breakdown when advancing to COMPLETED', async () => {
      txModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...baseTx,
          stage: TransactionStage.TITLE_DEED,
        }),
      });
      const updatedTx = {
        ...baseTx,
        stage: TransactionStage.COMPLETED,
        totalServiceFee: 10_001,
      };
      txModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updatedTx),
      });
      historyModel.create.mockResolvedValueOnce([{}]);
      breakdownModel.create.mockResolvedValueOnce([{}]);

      await service.advanceStage(txId.toHexString(), {
        toStage: TransactionStage.COMPLETED,
      });

      expect(breakdownModel.create).toHaveBeenCalledTimes(1);
      const breakdownArg = (breakdownModel.create.mock.calls[0][0] as Array<
        Record<string, unknown>
      >)[0];
      expect(breakdownArg).toMatchObject({
        transactionId: txId,
        totalServiceFee: 10_001,
        agencyShare: 5_000,
        agentPool: 5_001,
        isSameAgent: false,
        ruleVersion: 'v1',
      });
      expect(
        (breakdownArg.parties as Array<{ share: number }>).reduce(
          (s, p) => s + p.share,
          0,
        ),
      ).toBe(5_001);
    });

    it('surfaces COMMISSION_BREAKDOWN_ALREADY_EXISTS when a breakdown row collides', async () => {
      txModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...baseTx,
          stage: TransactionStage.TITLE_DEED,
        }),
      });
      txModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...baseTx,
          stage: TransactionStage.COMPLETED,
        }),
      });
      historyModel.create.mockResolvedValueOnce([{}]);
      breakdownModel.create.mockRejectedValueOnce({ code: 11000 });

      const err = await service
        .advanceStage(txId.toHexString(), {
          toStage: TransactionStage.COMPLETED,
        })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ConflictDomainException);
      expect((err as ConflictDomainException).errorCode).toBe(
        ErrorCode.COMMISSION_BREAKDOWN_ALREADY_EXISTS,
      );
    });
  });

  /* --------------------------- update ------------------------------ */

  describe('update', () => {
    it('applies only allowed fields and returns the updated document', async () => {
      const id = new Types.ObjectId().toHexString();
      const updated = { _id: id, notes: 'updated' };
      txModel.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.update(id, {
        notes: 'updated',
      });

      expect(txModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { notes: 'updated' },
        expect.objectContaining({ new: true }),
      );
      expect(result).toBe(updated);
    });
  });

  /* --------------------------- history ----------------------------- */

  describe('findStageHistory', () => {
    it('throws NOT_FOUND when the transaction itself is missing', async () => {
      txModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findStageHistory(new Types.ObjectId().toHexString()),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.TRANSACTION_NOT_FOUND,
      });
    });
  });
});
