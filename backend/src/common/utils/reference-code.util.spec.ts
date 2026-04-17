import {
  generateReferenceCode,
  isValidReferenceCode,
} from './reference-code.util';

describe('reference-code.util', () => {
  describe('generateReferenceCode', () => {
    it('produces a TRX-YYYY-XXXXXX shape', () => {
      const code = generateReferenceCode(new Date('2026-04-17T12:00:00Z'));
      expect(code).toMatch(/^TRX-2026-[A-Z2-9]{6}$/);
    });

    it('uses the UTC year of the provided date', () => {
      const code = generateReferenceCode(new Date('2026-01-01T00:30:00Z'));
      expect(code.startsWith('TRX-2026-')).toBe(true);
    });

    it('excludes visually ambiguous characters (0, O, 1, I, L)', () => {
      // Run a batch to increase the chance of catching a leaked character.
      for (let i = 0; i < 200; i += 1) {
        const code = generateReferenceCode();
        const suffix = code.split('-')[2];
        expect(suffix).not.toMatch(/[01OIL]/);
      }
    });

    it('is effectively unique across calls', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 500; i += 1) {
        seen.add(generateReferenceCode());
      }
      // We tolerate the astronomically unlikely single collision; the real
      // uniqueness guarantee comes from the DB index.
      expect(seen.size).toBeGreaterThanOrEqual(499);
    });
  });

  describe('isValidReferenceCode', () => {
    it('accepts well-formed codes', () => {
      expect(isValidReferenceCode('TRX-2026-ABC234')).toBe(true);
      expect(isValidReferenceCode(generateReferenceCode())).toBe(true);
    });

    it('rejects malformed codes', () => {
      expect(isValidReferenceCode('trx-2026-ABC234')).toBe(false); // lowercase prefix
      expect(isValidReferenceCode('TRX-26-ABC234')).toBe(false); // short year
      expect(isValidReferenceCode('TRX-2026-ABC23')).toBe(false); // short suffix
      expect(isValidReferenceCode('TRX-2026-ABCDEFG')).toBe(false); // long suffix
      expect(isValidReferenceCode('TRX-2026-abcdef')).toBe(false); // lowercase suffix
      expect(isValidReferenceCode('')).toBe(false);
    });
  });
});
