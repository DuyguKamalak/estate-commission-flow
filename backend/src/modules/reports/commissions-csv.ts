import type {
  AgentTotalRow,
  CommissionsReportDto,
  CurrencyTotalRow,
  ReportTransactionRow,
} from './dto/commissions-report.dto';

/**
 * RFC 4180 CSV escaping.
 *
 * Quotes any field that contains a delimiter, newline, carriage
 * return, or the quote character itself; quotes are doubled. Leading
 * equal / plus / minus / at signs are also quoted to defuse CSV
 * injection into spreadsheet formulas (a surprisingly common gotcha
 * when a user opens the file in Excel).
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const risky = /[",\r\n]/.test(str) || /^[=+\-@]/.test(str);
  if (!risky) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function formatMinor(amountMinor: number, currency: string): string {
  /*
   * Intentionally formatted as "major.minor" with two decimals so the
   * CSV remains numerically friendly for pivots and SUMs. We don't
   * try to render currency-specific subunit counts here; the column
   * already includes the currency code, and the minor-unit integer
   * is also emitted alongside for lossless processing.
   */
  return (amountMinor / 100).toFixed(2);
}

/**
 * Serialise the full report into a single CSV document with three
 * stacked sections separated by blank lines. Operators typically
 * open these in Excel / Google Sheets and expect a readable layout
 * at the top of the file.
 */
export function buildCommissionsReportCsv(
  report: CommissionsReportDto,
): string {
  const lines: string[] = [];

  lines.push(
    `# Commissions report`,
    `# Range: ${report.range.from ?? 'start'} → ${report.range.to ?? 'now'}`,
    `# Agent filter: ${report.filters.agentId ?? 'all'}`,
    `# Currency filter: ${report.filters.currency ?? 'all'}`,
    '',
    'section,currency,transactionCount,totalServiceFee,agencyShare,agentPool,totalServiceFeeMinor,agencySharemMinor,agentPoolMinor',
  );
  for (const row of report.currencyTotals) {
    lines.push(currencyRow(row));
  }

  lines.push(
    '',
    'section,agentId,agentName,agentEmail,currency,totalShare,transactionCount,totalShareMinor',
  );
  for (const row of report.agentTotals) {
    lines.push(agentRow(row));
  }

  lines.push(
    '',
    'section,referenceCode,propertyTitle,stage,currency,totalServiceFee,agencyShare,agentPool,totalServiceFeeMinor,agencySharemMinor,agentPoolMinor,ruleVersion,calculatedAt,isSameAgent,parties',
  );
  for (const row of report.transactions) {
    lines.push(transactionRow(row));
  }

  return lines.join('\r\n') + '\r\n';
}

function currencyRow(row: CurrencyTotalRow): string {
  return [
    'currency_total',
    row.currency,
    row.transactionCount,
    formatMinor(row.totalServiceFee, row.currency),
    formatMinor(row.agencyShare, row.currency),
    formatMinor(row.agentPool, row.currency),
    row.totalServiceFee,
    row.agencyShare,
    row.agentPool,
  ]
    .map(csvEscape)
    .join(',');
}

function agentRow(row: AgentTotalRow): string {
  return [
    'agent_total',
    row.agentId,
    row.agentName,
    row.agentEmail ?? '',
    row.currency,
    formatMinor(row.totalShare, row.currency),
    row.transactionCount,
    row.totalShare,
  ]
    .map(csvEscape)
    .join(',');
}

function transactionRow(row: ReportTransactionRow): string {
  const parties = row.parties
    .map((p) => `${p.agentName} (${p.role}) ${formatMinor(p.share, row.currency)}`)
    .join(' | ');
  return [
    'transaction',
    row.referenceCode,
    row.propertyTitle,
    row.stage,
    row.currency,
    formatMinor(row.totalServiceFee, row.currency),
    formatMinor(row.agencyShare, row.currency),
    formatMinor(row.agentPool, row.currency),
    row.totalServiceFee,
    row.agencyShare,
    row.agentPool,
    row.ruleVersion,
    row.calculatedAt,
    row.isSameAgent,
    parties,
  ]
    .map(csvEscape)
    .join(',');
}
