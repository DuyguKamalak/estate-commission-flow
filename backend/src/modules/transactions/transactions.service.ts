import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  ClientSession,
  Connection,
  isValidObjectId,
  Model,
  Types,
} from 'mongoose';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../common/enums/transaction-stage.enum';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import {
  generateReferenceCode,
  isValidReferenceCode,
} from '../../common/utils/reference-code.util';
import { AgentsService } from '../agents/agents.service';
import { calculateCommission } from '../commissions/domain/commission-calculator';
import {
  CommissionBreakdown,
  CommissionBreakdownDocument,
} from '../commissions/schemas/commission-breakdown.schema';
import { assertValidStageTransition } from './domain/stage-machine';
import { AdvanceStageDto } from './dto/advance-stage.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  TransactionStageHistory,
  TransactionStageHistoryDocument,
} from './schemas/transaction-stage-history.schema';
import {
  Transaction,
  TransactionDocument,
} from './schemas/transaction.schema';

const MAX_REFERENCE_CODE_RETRIES = 5;

/**
 * Transactions service — aggregate root over Transaction,
 * TransactionStageHistory, and (on completion) CommissionBreakdown.
 *
 * Atomicity matters here: creation writes BOTH the transaction and its
 * first stage-history row; advancing to COMPLETED additionally persists
 * the commission breakdown. All three writes happen inside a single
 * Mongo session so a partial failure never leaves the system in a
 * half-migrated state.
 *
 * MongoDB Atlas M0 is a replica-set under the hood, so multi-document
 * transactions are supported. Local dev needs a replica-set-enabled
 * mongod; in-memory test servers expose this through `mongodb-memory-server`
 * with a replica-set config.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(TransactionStageHistory.name)
    private readonly stageHistoryModel: Model<TransactionStageHistoryDocument>,
    @InjectModel(CommissionBreakdown.name)
    private readonly commissionBreakdownModel: Model<CommissionBreakdownDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly agentsService: AgentsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Create                                                              */
  /* ------------------------------------------------------------------ */

  async create(dto: CreateTransactionDto): Promise<TransactionDocument> {
    await this.agentsService.assertActiveAgentExists(dto.listingAgentId);
    if (dto.listingAgentId !== dto.sellingAgentId) {
      await this.agentsService.assertActiveAgentExists(dto.sellingAgentId);
    }

    const agreementDate = dto.agreementDate
      ? new Date(dto.agreementDate)
      : new Date();
    const currency = (dto.currency ?? 'GBP').toUpperCase();

    for (let attempt = 1; attempt <= MAX_REFERENCE_CODE_RETRIES; attempt += 1) {
      const referenceCode = generateReferenceCode(agreementDate);
      try {
        return await this.runInSession(async (session) => {
          const [tx] = await this.transactionModel.create(
            [
              {
                referenceCode,
                propertyTitle: dto.propertyTitle,
                propertyAddress: dto.propertyAddress,
                transactionType: dto.transactionType,
                totalServiceFee: dto.totalServiceFee,
                currency,
                stage: TransactionStage.AGREEMENT,
                listingAgentId: new Types.ObjectId(dto.listingAgentId),
                sellingAgentId: new Types.ObjectId(dto.sellingAgentId),
                agreementDate,
                notes: dto.notes,
              },
            ],
            { session },
          );

          await this.stageHistoryModel.create(
            [
              {
                transactionId: tx._id,
                fromStage: null,
                toStage: TransactionStage.AGREEMENT,
                changedAt: agreementDate,
                reason: 'Transaction created',
                triggeredBy: 'system',
              },
            ],
            { session },
          );

          return tx;
        });
      } catch (err) {
        if (
          isDuplicateKeyError(err) &&
          attempt < MAX_REFERENCE_CODE_RETRIES
        ) {
          this.logger.warn(
            `Reference code collision on attempt ${attempt}, retrying…`,
          );
          continue;
        }
        if (isDuplicateKeyError(err)) {
          throw new ConflictDomainException(
            ErrorCode.REFERENCE_CODE_COLLISION,
            `Failed to allocate a unique transaction reference after ${MAX_REFERENCE_CODE_RETRIES} attempts. Please retry.`,
          );
        }
        throw err;
      }
    }
    // Unreachable, but TypeScript can't prove it; the loop either
    // returns or throws on every iteration.
    throw new ConflictDomainException(
      ErrorCode.REFERENCE_CODE_COLLISION,
      'Reference code allocation loop exited unexpectedly.',
    );
  }

  /* ------------------------------------------------------------------ */
  /* Read                                                                */
  /* ------------------------------------------------------------------ */

  async findAll(
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedResult<TransactionDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.stage) filter.stage = query.stage;
    if (query.transactionType) filter.transactionType = query.transactionType;
    if (query.referenceCode) filter.referenceCode = query.referenceCode;

    if (query.anyAgentId) {
      filter.$or = [
        { listingAgentId: new Types.ObjectId(query.anyAgentId) },
        { sellingAgentId: new Types.ObjectId(query.anyAgentId) },
      ];
    } else {
      if (query.listingAgentId)
        filter.listingAgentId = new Types.ObjectId(query.listingAgentId);
      if (query.sellingAgentId)
        filter.sellingAgentId = new Types.ObjectId(query.sellingAgentId);
    }

    if (query.search) {
      const escaped = escapeRegex(query.search);
      const orClauses = [
        { propertyTitle: { $regex: escaped, $options: 'i' } },
        { propertyAddress: { $regex: escaped, $options: 'i' } },
      ];
      // Combine with any existing $or (from anyAgentId) using $and.
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: orClauses }];
        delete filter.$or;
      } else {
        filter.$or = orClauses;
      }
    }

    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) range.$lte = new Date(query.to);
      filter.createdAt = range;
    }

    const { page, pageSize } = query;

    const [items, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async findById(id: string): Promise<TransactionDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundDomainException(
        ErrorCode.TRANSACTION_NOT_FOUND,
        `Transaction ${id} not found.`,
      );
    }
    const doc = await this.transactionModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundDomainException(
        ErrorCode.TRANSACTION_NOT_FOUND,
        `Transaction ${id} not found.`,
      );
    }
    return doc;
  }

  async findByReferenceCode(code: string): Promise<TransactionDocument> {
    if (!isValidReferenceCode(code)) {
      throw new DomainException(
        ErrorCode.INVALID_REFERENCE_CODE,
        `"${code}" is not a valid transaction reference code.`,
      );
    }
    const doc = await this.transactionModel
      .findOne({ referenceCode: code.toUpperCase() })
      .exec();
    if (!doc) {
      throw new NotFoundDomainException(
        ErrorCode.TRANSACTION_NOT_FOUND,
        `Transaction ${code} not found.`,
      );
    }
    return doc;
  }

  async findStageHistory(
    transactionId: string,
  ): Promise<TransactionStageHistoryDocument[]> {
    // Touching findById first ensures we return NOT_FOUND instead of an
    // empty array when the transaction itself doesn't exist.
    await this.findById(transactionId);
    return this.stageHistoryModel
      .find({ transactionId: new Types.ObjectId(transactionId) })
      .sort({ changedAt: 1 })
      .exec();
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  async update(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundDomainException(
        ErrorCode.TRANSACTION_NOT_FOUND,
        `Transaction ${id} not found.`,
      );
    }
    const update: Record<string, unknown> = {};
    if (dto.propertyTitle !== undefined)
      update.propertyTitle = dto.propertyTitle;
    if (dto.propertyAddress !== undefined)
      update.propertyAddress = dto.propertyAddress;
    if (dto.notes !== undefined) update.notes = dto.notes;

    const doc = await this.transactionModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
    if (!doc) {
      throw new NotFoundDomainException(
        ErrorCode.TRANSACTION_NOT_FOUND,
        `Transaction ${id} not found.`,
      );
    }
    return doc;
  }

  /* ------------------------------------------------------------------ */
  /* Stage advancement (atomic with history + optional breakdown)        */
  /* ------------------------------------------------------------------ */

  async advanceStage(
    id: string,
    dto: AdvanceStageDto,
  ): Promise<TransactionDocument> {
    const tx = await this.findById(id);
    assertValidStageTransition(tx.stage, dto.toStage);

    const now = new Date();
    const stageDateField = stageDateFieldFor(dto.toStage);

    return this.runInSession(async (session) => {
      const update: Record<string, unknown> = { stage: dto.toStage };
      if (stageDateField) {
        update[stageDateField] = now;
      }

      const updatedTx = await this.transactionModel
        .findByIdAndUpdate(tx._id, update, {
          new: true,
          runValidators: true,
          session,
        })
        .exec();
      if (!updatedTx) {
        // Shouldn't happen — we just loaded it — but defensively surface
        // the same error shape rather than returning null.
        throw new NotFoundDomainException(
          ErrorCode.TRANSACTION_NOT_FOUND,
          `Transaction ${id} disappeared mid-update.`,
        );
      }

      await this.stageHistoryModel.create(
        [
          {
            transactionId: tx._id,
            fromStage: tx.stage,
            toStage: dto.toStage,
            changedAt: now,
            reason: dto.reason,
            triggeredBy: dto.triggeredBy ?? 'system',
          },
        ],
        { session },
      );

      if (dto.toStage === TransactionStage.COMPLETED) {
        await this.persistCommissionBreakdown(updatedTx, session);
      }

      return updatedTx;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  private async persistCommissionBreakdown(
    tx: TransactionDocument,
    session: ClientSession,
  ): Promise<void> {
    const breakdown = calculateCommission({
      totalServiceFee: tx.totalServiceFee,
      currency: tx.currency,
      listingAgentId: tx.listingAgentId.toString(),
      sellingAgentId: tx.sellingAgentId.toString(),
    });

    try {
      await this.commissionBreakdownModel.create(
        [
          {
            transactionId: tx._id,
            totalServiceFee: breakdown.totalServiceFee,
            currency: breakdown.currency,
            agencyShare: breakdown.agencyShare,
            agentPool: breakdown.agentPool,
            isSameAgent: breakdown.isSameAgent,
            parties: breakdown.parties.map((p) => ({
              agentId: new Types.ObjectId(p.agentId),
              role: p.role,
              share: p.share,
              reason: p.reason,
            })),
            ruleVersion: breakdown.ruleVersion,
            calculatedAt: breakdown.calculatedAt,
          },
        ],
        { session },
      );
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictDomainException(
          ErrorCode.COMMISSION_BREAKDOWN_ALREADY_EXISTS,
          `Commission breakdown already exists for transaction ${tx._id.toString()}.`,
        );
      }
      throw err;
    }
  }

  /**
   * Runs the given callback inside a Mongo transaction. Uses
   * `session.withTransaction` so duplicate-key / network retries are
   * handled transparently by the driver.
   */
  private async runInSession<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}

function stageDateFieldFor(stage: TransactionStage): string | null {
  switch (stage) {
    case TransactionStage.EARNEST_MONEY:
      return 'earnestMoneyDate';
    case TransactionStage.TITLE_DEED:
      return 'titleDeedDate';
    case TransactionStage.COMPLETED:
      return 'completedAt';
    default:
      return null;
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
}

/**
 * Re-export for tests that need to construct a known stage order without
 * pulling in the enum module directly.
 */
export const STAGE_ORDER_FOR_TESTS = TRANSACTION_STAGE_ORDER;
