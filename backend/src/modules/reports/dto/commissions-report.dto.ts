import { CommissionPartyRole } from '../../commissions/domain/commission-calculator';
import { TransactionStage } from '../../../common/enums/transaction-stage.enum';

/**
 * Output shape of the commissions report endpoint.
 *
 * Monetary fields stay in integer minor units end-to-end so the
 * frontend formatter sees the same numbers the aggregation produced
 * (no lossy float conversion in the middle).
 *
 * The payload is grouped around one idea per block:
 *   - `range` / `filters`: echo of the effective query (including
 *      the inclusive upper bound we applied server-side);
 *   - `currencyTotals`: one row per currency for the headline cards;
 *   - `agentTotals`: (agent, currency) pairs for the leaderboard;
 *   - `transactions`: completed deals in the window, each with its
 *      own mini breakdown so the UI can show a ledger view.
 */
export interface CommissionsReportDto {
  range: {
    from: string | null;
    to: string | null;
  };
  filters: {
    agentId: string | null;
    currency: string | null;
  };
  currencyTotals: CurrencyTotalRow[];
  agentTotals: AgentTotalRow[];
  transactions: ReportTransactionRow[];
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

export interface ReportTransactionPartyRow {
  agentId: string;
  agentName: string;
  role: CommissionPartyRole;
  share: number;
}
