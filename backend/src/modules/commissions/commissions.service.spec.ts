import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { CommissionsService } from './commissions.service';
import { CommissionBreakdown } from './schemas/commission-breakdown.schema';

describe('CommissionsService', () => {
  let service: CommissionsService;
  const model = {
    findOne: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        {
          provide: getModelToken(CommissionBreakdown.name),
          useValue: model,
        },
      ],
    }).compile();
    service = moduleRef.get(CommissionsService);
  });

  describe('findByTransactionId', () => {
    it('throws NOT_FOUND on invalid ObjectId', async () => {
      const err = await service
        .findByTransactionId('nope')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundDomainException);
      expect((err as NotFoundDomainException).errorCode).toBe(
        ErrorCode.COMMISSION_BREAKDOWN_NOT_FOUND,
      );
    });

    it('throws NOT_FOUND when no breakdown row exists', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findByTransactionId(new Types.ObjectId().toHexString()),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.COMMISSION_BREAKDOWN_NOT_FOUND,
      });
    });

    it('returns the breakdown when present', async () => {
      const doc = { _id: new Types.ObjectId(), agencyShare: 1000 };
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });
      const result = await service.findByTransactionId(
        new Types.ObjectId().toHexString(),
      );
      expect(result).toBe(doc);
    });
  });

  describe('aggregateByAgent', () => {
    it('builds a group pipeline and returns the rows verbatim', async () => {
      const rows = [
        {
          agentId: new Types.ObjectId(),
          currency: 'GBP',
          totalShare: 12345,
          transactionCount: 3,
        },
      ];
      model.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(rows),
      });

      const result = await service.aggregateByAgent();

      expect(result).toBe(rows);
      const pipeline = model.aggregate.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      expect(pipeline.some((s) => '$unwind' in s)).toBe(true);
      expect(pipeline.some((s) => '$group' in s)).toBe(true);
    });

    it('adds a per-agent match stage when agentId is provided', async () => {
      model.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });
      const agentId = new Types.ObjectId().toHexString();

      await service.aggregateByAgent({ agentId });

      const pipeline = model.aggregate.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      // Two $match stages: the initial one (parties.agentId) and the
      // post-$unwind one that narrows down to the specific agent.
      const matches = pipeline.filter((s) => '$match' in s);
      expect(matches).toHaveLength(2);
    });

    it('short-circuits to [] when agentId is invalid', async () => {
      const result = await service.aggregateByAgent({ agentId: 'nope' });
      expect(result).toEqual([]);
      expect(model.aggregate).not.toHaveBeenCalled();
    });

    it('applies calculatedAt range when from/to provided', async () => {
      model.aggregate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');

      await service.aggregateByAgent({ from, to });

      const pipeline = model.aggregate.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      const initialMatch = pipeline[0] as {
        $match: { calculatedAt?: { $gte?: Date; $lte?: Date } };
      };
      expect(initialMatch.$match.calculatedAt?.$gte).toEqual(from);
      expect(initialMatch.$match.calculatedAt?.$lte).toEqual(to);
    });
  });
});
