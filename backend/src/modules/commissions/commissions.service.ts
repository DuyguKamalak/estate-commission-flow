import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, PipelineStage, Types } from 'mongoose';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import {
  CommissionBreakdown,
  CommissionBreakdownDocument,
} from './schemas/commission-breakdown.schema';

/**
 * Commissions service — read side.
 *
 * Breakdowns are *written* inside `TransactionsService.advanceStage` when
 * a transaction reaches the COMPLETED stage, within the same Mongo
 * transaction that updates the Transaction itself (see ADR-002). This
 * service is therefore intentionally read-only: it exposes lookup by
 * transaction id and aggregation by agent, which is what the financial-
 * breakdown and reporting screens need.
 */
@Injectable()
export class CommissionsService {
  constructor(
    @InjectModel(CommissionBreakdown.name)
    private readonly breakdownModel: Model<CommissionBreakdownDocument>,
  ) {}

  /**
   * Fetches the breakdown for a given transaction id, or throws
   * COMMISSION_BREAKDOWN_NOT_FOUND if the transaction either has no
   * breakdown yet (still pre-completion) or does not exist at all.
   */
  async findByTransactionId(
    transactionId: string,
  ): Promise<CommissionBreakdownDocument> {
    if (!isValidObjectId(transactionId)) {
      throw new NotFoundDomainException(
        ErrorCode.COMMISSION_BREAKDOWN_NOT_FOUND,
        `No commission breakdown for transaction ${transactionId}.`,
      );
    }
    const doc = await this.breakdownModel
      .findOne({ transactionId: new Types.ObjectId(transactionId) })
      .exec();
    if (!doc) {
      throw new NotFoundDomainException(
        ErrorCode.COMMISSION_BREAKDOWN_NOT_FOUND,
        `No commission breakdown for transaction ${transactionId}.`,
      );
    }
    return doc;
  }

  /**
   * Aggregates total earnings per agent over an optional date window.
   * Drives the "Reports & Analytics" and "Agent Profile" screens.
   *
   * Currency is grouped into the result as well — mixing currencies in
   * a single total would be meaningless, so the caller gets one row per
   * (agentId, currency) pair and decides how to present them.
   */
  async aggregateByAgent(options?: {
    agentId?: string;
    from?: Date;
    to?: Date;
  }): Promise<AgentCommissionTotal[]> {
    const match: Record<string, unknown> = {};
    if (options?.from || options?.to) {
      const range: Record<string, Date> = {};
      if (options?.from) range.$gte = options.from;
      if (options?.to) range.$lte = options.to;
      match.calculatedAt = range;
    }
    if (options?.agentId) {
      if (!isValidObjectId(options.agentId)) {
        return [];
      }
      match['parties.agentId'] = new Types.ObjectId(options.agentId);
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $unwind: '$parties' },
    ];
    if (options?.agentId) {
      pipeline.push({
        $match: { 'parties.agentId': new Types.ObjectId(options.agentId) },
      });
    }
    pipeline.push(
      {
        $group: {
          _id: { agentId: '$parties.agentId', currency: '$currency' },
          totalShare: { $sum: '$parties.share' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          agentId: '$_id.agentId',
          currency: '$_id.currency',
          totalShare: 1,
          transactionCount: 1,
        },
      },
      { $sort: { totalShare: -1 } },
    );

    return this.breakdownModel.aggregate<AgentCommissionTotal>(pipeline).exec();
  }
}

export interface AgentCommissionTotal {
  agentId: Types.ObjectId;
  currency: string;
  totalShare: number;
  transactionCount: number;
}
