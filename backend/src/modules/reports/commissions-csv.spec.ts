import { buildCommissionsReportCsv, csvEscape } from './commissions-csv';
import { TransactionStage } from '../../common/enums/transaction-stage.enum';
import type { CommissionsReportDto } from './dto/commissions-report.dto';

/**
 * Unit tests for the CSV serialiser.
 *
 * The escape helper carries most of the risk (delimiters, quotes,
 * newlines, and formula-injection defences), so we pin down its
 * behaviour directly. The `buildCommissionsReportCsv` function is
 * then tested end-to-end on a representative payload to catch any
 * drift in the header columns or section ordering.
 */
describe('csvEscape', () => {
  it('passes through safe strings untouched', () => {
    expect(csvEscape('TRX-2026-ABCDEF')).toBe('TRX-2026-ABCDEF');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(true)).toBe('true');
  });

  it('returns an empty string for null/undefined so blank cells stay blank', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes and doubles embedded quote characters', () => {
    expect(csvEscape('John "JR" Roe')).toBe('"John ""JR"" Roe"');
  });

  it('quotes fields containing commas or newlines', () => {
    expect(csvEscape('London, UK')).toBe('"London, UK"');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('quotes leading =, +, -, @ to defuse spreadsheet formula injection', () => {
    expect(csvEscape('=SUM(A1:A3)')).toBe('"=SUM(A1:A3)"');
    expect(csvEscape('+1-555-0100')).toBe('"+1-555-0100"');
    expect(csvEscape('-42')).toBe('"-42"');
    expect(csvEscape('@admin')).toBe('"@admin"');
  });
});

describe('buildCommissionsReportCsv', () => {
  it('emits metadata header, currency totals, agent totals, and ledger sections in order', () => {
    const report: CommissionsReportDto = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.000Z',
      },
      filters: { agentId: null, currency: 'GBP' },
      currencyTotals: [
        {
          currency: 'GBP',
          transactionCount: 2,
          totalServiceFee: 200_000,
          agencyShare: 100_000,
          agentPool: 100_000,
        },
      ],
      agentTotals: [
        {
          agentId: 'agent-1',
          agentName: 'Jane Doe',
          agentEmail: 'jane@iceberg.test',
          currency: 'GBP',
          totalShare: 50_000,
          transactionCount: 2,
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          referenceCode: 'TRX-2026-ABCDEF',
          propertyTitle: 'Sunny, spacious flat',
          stage: TransactionStage.COMPLETED,
          currency: 'GBP',
          totalServiceFee: 100_000,
          agencyShare: 50_000,
          agentPool: 50_000,
          ruleVersion: 'v1',
          calculatedAt: '2026-04-12T09:00:00.000Z',
          isSameAgent: false,
          parties: [
            {
              agentId: 'agent-1',
              agentName: 'Jane Doe',
              role: 'listing',
              share: 25_000,
            },
            {
              agentId: 'agent-2',
              agentName: 'John Roe',
              role: 'selling',
              share: 25_000,
            },
          ],
        },
      ],
    };

    const csv = buildCommissionsReportCsv(report);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('# Commissions report');
    expect(lines[1]).toBe(
      '# Range: 2026-04-01T00:00:00.000Z → 2026-04-30T23:59:59.000Z',
    );
    expect(lines[2]).toBe('# Agent filter: all');
    expect(lines[3]).toBe('# Currency filter: GBP');

    const sectionMarkers = lines.filter((l) => l.startsWith('section,'));
    expect(sectionMarkers).toHaveLength(3);

    const currencyRow = lines.find((l) => l.startsWith('currency_total,'));
    expect(currencyRow).toBe(
      'currency_total,GBP,2,2000.00,1000.00,1000.00,200000,100000,100000',
    );

    const agentRow = lines.find((l) => l.startsWith('agent_total,'));
    expect(agentRow).toBe(
      'agent_total,agent-1,Jane Doe,jane@iceberg.test,GBP,500.00,2,50000',
    );

    const txRow = lines.find((l) => l.startsWith('transaction,'));
    expect(txRow).toContain('TRX-2026-ABCDEF');
    expect(txRow).toContain('"Sunny, spacious flat"');
    expect(txRow).toContain('Jane Doe (listing) 250.00 | John Roe (selling) 250.00');
    expect(txRow).toContain('v1');
  });
});
