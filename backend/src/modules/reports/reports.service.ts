import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../common/enums/transaction-stage.enum';
import {
  CommissionBreakdown,
  CommissionBreakdownDocument,
} from '../commissions/schemas/commission-breakdown.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import {
  AgencyEarningsBucket,
  DashboardSnapshotDto,
  RecentTransactionDto,
} from './dto/dashboard.dto';

const RECENT_TRANSACTIONS_LIMIT = 6;

/**
 * Read-only reporting service. Produces the single payload that drives
 * the operations dashboard so the frontend only makes one round-trip.
 *
 * All aggregations run as MongoDB pipelines against indexed fields
 * (stage, createdAt, calculatedAt) so the endpoint stays cheap even as
 * the dataset grows.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(CommissionBreakdown.name)
    private readonly breakdownModel: Model<CommissionBreakdownDocument>,
  ) {}

  async getDashboardSnapshot(
    referenceDate: Date = new Date(),
  ): Promise<DashboardSnapshotDto> {
    const monthStart = startOfMonthUtc(referenceDate);

    const [
      stageDistribution,
      completedThisMonthCount,
      agencyEarningsMtd,
      recentTransactions,
    ] = await Promise.all([
      this.aggregateStageDistribution(),
      this.transactionModel
        .countDocuments({
          stage: TransactionStage.COMPLETED,
          completedAt: { $gte: monthStart },
        })
        .exec(),
      this.aggregateAgencyEarnings(monthStart),
      this.fetchRecentTransactions(),
    ]);

    const activeTransactionsCount =
      (stageDistribution[TransactionStage.AGREEMENT] ?? 0) +
      (stageDistribution[TransactionStage.EARNEST_MONEY] ?? 0) +
      (stageDistribution[TransactionStage.TITLE_DEED] ?? 0);

    return {
      activeTransactionsCount,
      completedThisMonthCount,
      agencyEarningsMtd,
      pendingTitleDeedCount:
        stageDistribution[TransactionStage.TITLE_DEED] ?? 0,
      stageDistribution,
      recentTransactions,
    };
  }

  private async aggregateStageDistribution(): Promise<
    Record<TransactionStage, number>
  > {
    const rows = await this.transactionModel
      .aggregate<{ _id: TransactionStage; count: number }>([
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ])
      .exec();

    const distribution = TRANSACTION_STAGE_ORDER.reduce<
      Record<TransactionStage, number>
    >(
      (acc, stage) => {
        acc[stage] = 0;
        return acc;
      },
      {} as Record<TransactionStage, number>,
    );

    for (const row of rows) {
      if (row._id in distribution) {
        distribution[row._id] = row.count;
      }
    }
    return distribution;
  }

  private async aggregateAgencyEarnings(
    from: Date,
  ): Promise<AgencyEarningsBucket[]> {
    const rows = await this.breakdownModel
      .aggregate<{ _id: string; total: number }>([
        { $match: { calculatedAt: { $gte: from } } },
        {
          $group: {
            _id: '$currency',
            total: { $sum: '$agencyShare' },
          },
        },
        { $sort: { total: -1 } },
      ])
      .exec();

    return rows.map((row) => ({ currency: row._id, total: row.total }));
  }

  private async fetchRecentTransactions(): Promise<RecentTransactionDto[]> {
    const docs = await this.transactionModel
      .find()
      .sort({ createdAt: -1 })
      .limit(RECENT_TRANSACTIONS_LIMIT)
      .lean()
      .exec();

    return docs.map((doc) => {
      const createdAt = (doc as unknown as { createdAt?: Date }).createdAt;
      return {
        id: String(doc._id),
        referenceCode: doc.referenceCode,
        propertyTitle: doc.propertyTitle,
        stage: doc.stage,
        transactionType: doc.transactionType,
        totalServiceFee: doc.totalServiceFee,
        currency: doc.currency,
        createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      };
    });
  }
}

function startOfMonthUtc(reference: Date): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}
