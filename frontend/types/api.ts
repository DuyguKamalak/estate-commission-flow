/**
 * Type contracts shared between frontend and backend.
 *
 * These mirror the backend's DTOs, schemas, and enum values exactly.
 * Keeping them in one place means stores, composables, and components
 * all reference the same shape — if the backend adds a field, we
 * update it here once and TypeScript surfaces every call-site that
 * needs to react.
 *
 * Monetary values travel over the wire as integer MINOR UNITS
 * (e.g. pence for GBP). Formatting to major units happens in the
 * `useCurrency` composable at the very last moment before rendering.
 */

/* ------------------------------------------------------------------ */
/* Enums (mirrors backend `src/common/enums/*`)                       */
/* ------------------------------------------------------------------ */

export const TransactionStage = {
  AGREEMENT: 'agreement',
  EARNEST_MONEY: 'earnest_money',
  TITLE_DEED: 'title_deed',
  COMPLETED: 'completed',
} as const;
export type TransactionStage =
  (typeof TransactionStage)[keyof typeof TransactionStage];

export const TRANSACTION_STAGE_ORDER: readonly TransactionStage[] = [
  TransactionStage.AGREEMENT,
  TransactionStage.EARNEST_MONEY,
  TransactionStage.TITLE_DEED,
  TransactionStage.COMPLETED,
] as const;

export const TRANSACTION_STAGE_LABEL: Record<TransactionStage, string> = {
  [TransactionStage.AGREEMENT]: 'Agreement',
  [TransactionStage.EARNEST_MONEY]: 'Earnest money',
  [TransactionStage.TITLE_DEED]: 'Title deed',
  [TransactionStage.COMPLETED]: 'Completed',
};

export const TransactionType = {
  SALE: 'sale',
  RENT: 'rent',
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const CommissionPartyRole = {
  LISTING: 'listing',
  SELLING: 'selling',
  LISTING_AND_SELLING: 'listing_and_selling',
} as const;
export type CommissionPartyRole =
  (typeof CommissionPartyRole)[keyof typeof CommissionPartyRole];

/* ------------------------------------------------------------------ */
/* Envelopes                                                           */
/* ------------------------------------------------------------------ */

/** Envelope returned by every paginated list endpoint. */
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Shape of the standardised error body from GlobalExceptionFilter. */
export interface ApiErrorBody {
  statusCode: number;
  errorCode: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/* ------------------------------------------------------------------ */
/* Domain resources                                                    */
/* ------------------------------------------------------------------ */

export interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  referenceCode: string;
  propertyTitle: string;
  propertyAddress: string;
  transactionType: TransactionType;
  totalServiceFee: number;
  currency: string;
  stage: TransactionStage;
  listingAgentId: string;
  sellingAgentId: string;
  agreementDate: string;
  earnestMoneyDate?: string;
  titleDeedDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionStageHistory {
  id: string;
  transactionId: string;
  fromStage: TransactionStage | null;
  toStage: TransactionStage;
  changedAt: string;
  reason?: string;
  triggeredBy?: string;
}

export interface CommissionParty {
  agentId: string;
  role: CommissionPartyRole;
  share: number;
  reason: string;
}

export interface CommissionBreakdown {
  id: string;
  transactionId: string;
  totalServiceFee: number;
  currency: string;
  agencyShare: number;
  agentPool: number;
  isSameAgent: boolean;
  parties: CommissionParty[];
  ruleVersion: string;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface AgencyEarningsBucket {
  currency: string;
  total: number;
}

export interface RecentTransactionSummary {
  id: string;
  referenceCode: string;
  propertyTitle: string;
  stage: TransactionStage;
  transactionType: string;
  totalServiceFee: number;
  currency: string;
  createdAt: string;
}

export interface DashboardSnapshot {
  activeTransactionsCount: number;
  completedThisMonthCount: number;
  agencyEarningsMtd: AgencyEarningsBucket[];
  pendingTitleDeedCount: number;
  stageDistribution: Record<TransactionStage, number>;
  recentTransactions: RecentTransactionSummary[];
}

export interface CommissionsReportFilters {
  from?: string;
  to?: string;
  agentId?: string;
  currency?: string;
}

export interface CurrencyTotalRow {
  currency: string;
  transactionCount: number;
  totalServiceFee: number;
  agencyShare: number;
  agentPool: number;
}

export interface AgentTotalRow {
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  currency: string;
  totalShare: number;
  transactionCount: number;
}

export interface ReportTransactionPartyRow {
  agentId: string;
  agentName: string;
  role: CommissionPartyRole;
  share: number;
}

export interface ReportTransactionRow {
  id: string;
  referenceCode: string;
  propertyTitle: string;
  stage: TransactionStage;
  currency: string;
  totalServiceFee: number;
  agencyShare: number;
  agentPool: number;
  ruleVersion: string;
  calculatedAt: string;
  isSameAgent: boolean;
  parties: ReportTransactionPartyRow[];
}

export interface CommissionsReport {
  range: { from: string | null; to: string | null };
  filters: { agentId: string | null; currency: string | null };
  currencyTotals: CurrencyTotalRow[];
  agentTotals: AgentTotalRow[];
  transactions: ReportTransactionRow[];
}

/* ------------------------------------------------------------------ */
/* Query DTOs (frontend → backend)                                     */
/* ------------------------------------------------------------------ */

export interface ListTransactionsQuery {
  page?: number;
  pageSize?: number;
  stage?: TransactionStage;
  transactionType?: TransactionType;
  listingAgentId?: string;
  sellingAgentId?: string;
  anyAgentId?: string;
  referenceCode?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface ListAgentsQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  search?: string;
}
