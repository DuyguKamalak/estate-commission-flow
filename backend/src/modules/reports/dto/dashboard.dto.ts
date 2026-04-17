import { TransactionStage } from '../../../common/enums/transaction-stage.enum';

/**
 * Shape of the payload returned by `GET /reports/dashboard`.
 *
 * Designed as a single round-trip for the operations dashboard so the
 * frontend doesn't have to stitch together four separate list calls.
 * Monetary values are integer minor units — the UI formats them at the
 * very last moment.
 */
export interface DashboardSnapshotDto {
  /** Transactions currently not in COMPLETED stage. */
  activeTransactionsCount: number;

  /** Transactions that completed within the current calendar month (UTC). */
  completedThisMonthCount: number;

  /** Sum of every agencyShare persisted this calendar month (minor units). */
  agencyEarningsMtd: AgencyEarningsBucket[];

  /** Transactions sitting at TITLE_DEED awaiting completion. */
  pendingTitleDeedCount: number;

  /** Count of transactions in each stage — drives the distribution card. */
  stageDistribution: Record<TransactionStage, number>;

  /** Most recently created transactions, newest first. */
  recentTransactions: RecentTransactionDto[];
}

export interface AgencyEarningsBucket {
  currency: string;
  total: number;
}

export interface RecentTransactionDto {
  id: string;
  referenceCode: string;
  propertyTitle: string;
  stage: TransactionStage;
  transactionType: string;
  totalServiceFee: number;
  currency: string;
  createdAt: string;
}
