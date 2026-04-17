import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, PipelineStage, Types } from 'mongoose';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../common/enums/transaction-stage.enum';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';
import {
  CommissionBreakdown,
  CommissionBreakdownDocument,
} from '../commissions/schemas/commission-breakdown.schema';
import { CommissionPartyRole } from '../commissions/domain/commission-calculator';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import {
  AgencyEarningsBucket,
  DashboardSnapshotDto,
  RecentTransactionDto,
} from './dto/dashboard.dto';
import {
  AgentTotalRow,
  CommissionsReportDto,
  CurrencyTotalRow,
  ReportTransactionPartyRow,
  ReportTransactionRow,
} from './dto/commissions-report.dto';

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
    @InjectModel(Agent.name)
    private readonly agentModel: Model<AgentDocument>,
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

  /**
   * Commissions report — filtered, aggregated view of the breakdown
   * collection for the reports console.
   *
   * Returns four blocks in one payload so the frontend can render
   * headline totals, a per-agent leaderboard, and the underlying
   * transaction ledger without chaining extra round-trips. The CSV
   * export endpoint consumes the same DTO.
   *
   * Filters are additive and all optional:
   *   - `from` / `to`: inclusive `calculatedAt` bounds.
   *   - `agentId`: narrows to breakdowns where that agent received a
   *     share; the per-agent leaderboard is also scoped to them.
   *   - `currency`: a specific ISO code (already uppercased at the
   *     DTO layer).
   */
  async getCommissionsReport(filters: {
    from?: Date;
    to?: Date;
    agentId?: string;
    currency?: string;
  }): Promise<CommissionsReportDto> {
    const match: Record<string, unknown> = {};

    if (filters.from || filters.to) {
      const range: Record<string, Date> = {};
      if (filters.from) range.$gte = filters.from;
      if (filters.to) range.$lte = filters.to;
      match.calculatedAt = range;
    }
    if (filters.currency) {
      match.currency = filters.currency.toUpperCase();
    }

    /*
     * `agentId` acts as a soft pre-filter on the aggregation pipeline
     * (`parties.agentId` is indexed, so the optimiser can use it) but
     * we still re-filter unwound rows in the agent leaderboard below,
     * because otherwise a breakdown involving two different agents
     * would still contribute both of them to the per-agent list.
     */
    if (filters.agentId) {
      if (!isValidObjectId(filters.agentId)) {
        return emptyReport(filters);
      }
      match['parties.agentId'] = new Types.ObjectId(filters.agentId);
    }

    const [currencyTotals, agentTotals, transactions] = await Promise.all([
      this.aggregateCurrencyTotals(match),
      this.aggregateAgentTotals(match, filters.agentId),
      this.fetchReportTransactions(match),
    ]);

    return {
      range: {
        from: filters.from ? filters.from.toISOString() : null,
        to: filters.to ? filters.to.toISOString() : null,
      },
      filters: {
        agentId: filters.agentId ?? null,
        currency: filters.currency ?? null,
      },
      currencyTotals,
      agentTotals,
      transactions,
    };
  }

  private async aggregateCurrencyTotals(
    match: Record<string, unknown>,
  ): Promise<CurrencyTotalRow[]> {
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: '$currency',
          transactionCount: { $sum: 1 },
          totalServiceFee: { $sum: '$totalServiceFee' },
          agencyShare: { $sum: '$agencyShare' },
          agentPool: { $sum: '$agentPool' },
        },
      },
      { $sort: { totalServiceFee: -1 } },
    ];

    const rows = await this.breakdownModel
      .aggregate<{
        _id: string;
        transactionCount: number;
        totalServiceFee: number;
        agencyShare: number;
        agentPool: number;
      }>(pipeline)
      .exec();

    return rows.map((r) => ({
      currency: r._id,
      transactionCount: r.transactionCount,
      totalServiceFee: r.totalServiceFee,
      agencyShare: r.agencyShare,
      agentPool: r.agentPool,
    }));
  }

  private async aggregateAgentTotals(
    match: Record<string, unknown>,
    agentId: string | undefined,
  ): Promise<AgentTotalRow[]> {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $unwind: '$parties' },
    ];
    if (agentId && isValidObjectId(agentId)) {
      pipeline.push({
        $match: { 'parties.agentId': new Types.ObjectId(agentId) },
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
      { $sort: { totalShare: -1 } },
    );

    const rows = await this.breakdownModel
      .aggregate<{
        _id: { agentId: Types.ObjectId; currency: string };
        totalShare: number;
        transactionCount: number;
      }>(pipeline)
      .exec();

    if (rows.length === 0) return [];

    const uniqueAgentIds = Array.from(
      new Set(rows.map((r) => String(r._id.agentId))),
    );
    const agentDocs = await this.agentModel
      .find({ _id: { $in: uniqueAgentIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();
    const agentsById = new Map<
      string,
      { name: string; email: string | null }
    >();
    for (const a of agentDocs) {
      agentsById.set(String(a._id), {
        name: `${a.firstName} ${a.lastName}`.trim(),
        email: a.email ?? null,
      });
    }

    return rows.map((r) => {
      const id = String(r._id.agentId);
      const meta = agentsById.get(id);
      return {
        agentId: id,
        agentName: meta?.name ?? 'Unknown agent',
        agentEmail: meta?.email ?? null,
        currency: r._id.currency,
        totalShare: r.totalShare,
        transactionCount: r.transactionCount,
      };
    });
  }

  private async fetchReportTransactions(
    match: Record<string, unknown>,
  ): Promise<ReportTransactionRow[]> {
    const breakdowns = await this.breakdownModel
      .find(match)
      .sort({ calculatedAt: -1 })
      .limit(500)
      .lean()
      .exec();

    if (breakdowns.length === 0) return [];

    const txIds = Array.from(
      new Set(breakdowns.map((b) => String(b.transactionId))),
    );
    const agentIds = Array.from(
      new Set(
        breakdowns.flatMap((b) => b.parties.map((p) => String(p.agentId))),
      ),
    );

    const [txDocs, agentDocs] = await Promise.all([
      this.transactionModel
        .find({ _id: { $in: txIds.map((id) => new Types.ObjectId(id)) } })
        .lean()
        .exec(),
      this.agentModel
        .find({ _id: { $in: agentIds.map((id) => new Types.ObjectId(id)) } })
        .lean()
        .exec(),
    ]);

    const txById = new Map(txDocs.map((t) => [String(t._id), t]));
    const agentNameById = new Map<string, string>();
    for (const a of agentDocs) {
      agentNameById.set(String(a._id), `${a.firstName} ${a.lastName}`.trim());
    }

    return breakdowns.map((b) => {
      const tx = txById.get(String(b.transactionId));
      const parties: ReportTransactionPartyRow[] = b.parties.map((p) => ({
        agentId: String(p.agentId),
        agentName: agentNameById.get(String(p.agentId)) ?? 'Unknown agent',
        role: p.role as CommissionPartyRole,
        share: p.share,
      }));
      return {
        id: String(b.transactionId),
        referenceCode: tx?.referenceCode ?? '—',
        propertyTitle: tx?.propertyTitle ?? '—',
        stage: (tx?.stage ?? TransactionStage.COMPLETED) as TransactionStage,
        currency: b.currency,
        totalServiceFee: b.totalServiceFee,
        agencyShare: b.agencyShare,
        agentPool: b.agentPool,
        ruleVersion: b.ruleVersion,
        calculatedAt: b.calculatedAt.toISOString(),
        isSameAgent: b.isSameAgent,
        parties,
      };
    });
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

function emptyReport(filters: {
  from?: Date;
  to?: Date;
  agentId?: string;
  currency?: string;
}): CommissionsReportDto {
  return {
    range: {
      from: filters.from ? filters.from.toISOString() : null,
      to: filters.to ? filters.to.toISOString() : null,
    },
    filters: {
      agentId: filters.agentId ?? null,
      currency: filters.currency ?? null,
    },
    currencyTotals: [],
    agentTotals: [],
    transactions: [],
  };
}
