import { DomainException } from '../../../common/exceptions/domain.exception';
import {
  calculateCommission,
  COMMISSION_RULE_VERSION,
  CommissionCalculationInput,
} from './commission-calculator';

describe('calculateCommission', () => {
  const baseInput: CommissionCalculationInput = {
    totalServiceFee: 10_000_000, // £100,000.00 in pence
    currency: 'GBP',
    listingAgentId: 'agent-a',
    sellingAgentId: 'agent-b',
  };

  describe('Scenario B — different listing & selling agents', () => {
    it('splits 50% agency, 25% listing, 25% selling on a clean total', () => {
      const r = calculateCommission(baseInput);

      expect(r.isSameAgent).toBe(false);
      expect(r.agencyShare).toBe(5_000_000);
      expect(r.agentPool).toBe(5_000_000);
      expect(r.parties).toHaveLength(2);
      expect(r.parties[0]).toMatchObject({
        agentId: 'agent-a',
        role: 'listing',
        share: 2_500_000,
      });
      expect(r.parties[1]).toMatchObject({
        agentId: 'agent-b',
        role: 'selling',
        share: 2_500_000,
      });
    });

    it('routes odd pennies deterministically: agency floor, pool ceil, listing absorbs inner remainder', () => {
      // £100.01 -> agency £50.00, agent pool £50.01, then listing £25.01 / selling £25.00
      const r = calculateCommission({ ...baseInput, totalServiceFee: 10_001 });

      expect(r.agencyShare).toBe(5_000);
      expect(r.agentPool).toBe(5_001);
      expect(r.parties[0].share).toBe(2_501);
      expect(r.parties[1].share).toBe(2_500);
    });

    it('conserves the total across a wide range of inputs', () => {
      const samples = [0, 1, 99, 100, 101, 9_999, 12_345, 999_999, 10_000_000];
      for (const total of samples) {
        const r = calculateCommission({ ...baseInput, totalServiceFee: total });
        const sum =
          r.agencyShare + r.parties.reduce((s, p) => s + p.share, 0);
        expect(sum).toBe(total);
      }
    });

    it('handles zero fee without exploding', () => {
      const r = calculateCommission({ ...baseInput, totalServiceFee: 0 });
      expect(r.agencyShare).toBe(0);
      expect(r.agentPool).toBe(0);
      expect(r.parties.every((p) => p.share === 0)).toBe(true);
    });
  });

  describe('Scenario A — same listing & selling agent', () => {
    const sameAgentInput: CommissionCalculationInput = {
      ...baseInput,
      sellingAgentId: baseInput.listingAgentId,
    };

    it('emits a single consolidated party with 100% of the agent pool', () => {
      const r = calculateCommission(sameAgentInput);

      expect(r.isSameAgent).toBe(true);
      expect(r.agencyShare).toBe(5_000_000);
      expect(r.agentPool).toBe(5_000_000);
      expect(r.parties).toHaveLength(1);
      expect(r.parties[0]).toMatchObject({
        agentId: 'agent-a',
        role: 'listing_and_selling',
        share: 5_000_000,
      });
    });

    it('still preserves odd pennies on the same-agent path', () => {
      const r = calculateCommission({
        ...sameAgentInput,
        totalServiceFee: 10_001,
      });

      expect(r.agencyShare).toBe(5_000);
      expect(r.parties[0].share).toBe(5_001);
      expect(r.agencyShare + r.parties[0].share).toBe(10_001);
    });

    it('conserves the total across same-agent inputs', () => {
      for (const total of [0, 1, 99, 100, 101, 9_999, 999_999]) {
        const r = calculateCommission({
          ...sameAgentInput,
          totalServiceFee: total,
        });
        const sum =
          r.agencyShare + r.parties.reduce((s, p) => s + p.share, 0);
        expect(sum).toBe(total);
      }
    });
  });

  describe('metadata', () => {
    it('uppercases the currency code', () => {
      const r = calculateCommission({ ...baseInput, currency: 'gbp' });
      expect(r.currency).toBe('GBP');
    });

    it('stamps the rule version and calculation timestamp', () => {
      const before = Date.now();
      const r = calculateCommission(baseInput);
      const after = Date.now();

      expect(r.ruleVersion).toBe(COMMISSION_RULE_VERSION);
      expect(r.calculatedAt).toBeInstanceOf(Date);
      expect(r.calculatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(r.calculatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('returns human-readable reason strings for each party', () => {
      const r = calculateCommission(baseInput);
      for (const party of r.parties) {
        expect(party.reason).toMatch(/[A-Z]/);
        expect(party.reason.length).toBeGreaterThan(10);
      }
    });
  });

  describe('invalid input — rejected as DomainException', () => {
    it.each<[string, Partial<CommissionCalculationInput>]>([
      ['negative fee', { totalServiceFee: -1 }],
      ['fractional fee', { totalServiceFee: 100.5 }],
      ['NaN fee', { totalServiceFee: Number.NaN }],
      ['Infinity fee', { totalServiceFee: Number.POSITIVE_INFINITY }],
    ])('rejects %s', (_label, override) => {
      expect(() =>
        calculateCommission({ ...baseInput, ...override }),
      ).toThrow(DomainException);
    });

    it('rejects empty agent IDs', () => {
      expect(() =>
        calculateCommission({ ...baseInput, listingAgentId: '' }),
      ).toThrow(DomainException);
      expect(() =>
        calculateCommission({ ...baseInput, sellingAgentId: '' }),
      ).toThrow(DomainException);
    });

    it('rejects invalid currency codes', () => {
      expect(() =>
        calculateCommission({ ...baseInput, currency: 'GB' }),
      ).toThrow(DomainException);
      expect(() =>
        calculateCommission({ ...baseInput, currency: '' }),
      ).toThrow(DomainException);
      expect(() =>
        calculateCommission({
          ...baseInput,
          currency: undefined as unknown as string,
        }),
      ).toThrow(DomainException);
    });
  });
});
