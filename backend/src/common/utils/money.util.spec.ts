import {
  splitEqual,
  splitHalfInteger,
  toMajorUnits,
  toMinorUnits,
} from './money.util';

describe('money.util', () => {
  describe('toMinorUnits', () => {
    it('converts whole pounds to pence', () => {
      expect(toMinorUnits(1234)).toBe(123400);
    });

    it('converts decimal pounds with half-away-from-zero rounding', () => {
      expect(toMinorUnits(1234.5)).toBe(123450);
      expect(toMinorUnits(0.01)).toBe(1);
      expect(toMinorUnits(0.005)).toBe(1); // round half up
    });

    it('handles zero', () => {
      expect(toMinorUnits(0)).toBe(0);
    });

    it('rejects non-finite values', () => {
      expect(() => toMinorUnits(Number.NaN)).toThrow(TypeError);
      expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    });
  });

  describe('toMajorUnits', () => {
    it('is the inverse of toMinorUnits for representable values', () => {
      expect(toMajorUnits(123450)).toBe(1234.5);
      expect(toMajorUnits(0)).toBe(0);
      expect(toMajorUnits(1)).toBe(0.01);
    });
  });

  describe('splitHalfInteger', () => {
    it('splits an even amount into equal halves', () => {
      expect(splitHalfInteger(100)).toEqual([50, 50]);
      expect(splitHalfInteger(0)).toEqual([0, 0]);
    });

    it('gives the odd penny to the second slot', () => {
      // An odd total (e.g. £1,250.01) should always have the second half
      // absorb the single-penny remainder. This is the documented rule that
      // routes odd pennies to the agent pool rather than agency.
      expect(splitHalfInteger(101)).toEqual([50, 51]);
      expect(splitHalfInteger(125001)).toEqual([62500, 62501]);
    });

    it('preserves the original total', () => {
      const samples = [0, 1, 99, 100, 12345, 999_999];
      for (const total of samples) {
        const [a, b] = splitHalfInteger(total);
        expect(a + b).toBe(total);
      }
    });

    it('rejects negative or fractional inputs', () => {
      expect(() => splitHalfInteger(-1)).toThrow(TypeError);
      expect(() => splitHalfInteger(1.5)).toThrow(TypeError);
    });
  });

  describe('splitEqual', () => {
    it('splits evenly when divisible', () => {
      expect(splitEqual(99, 3)).toEqual([33, 33, 33]);
      expect(splitEqual(100, 2)).toEqual([50, 50]);
    });

    it('distributes remainder pennies to the first slots', () => {
      // Documented rule: earlier slots absorb the remainder. This is why
      // the listing agent receives the odd penny on a same-pool B-split.
      expect(splitEqual(100, 3)).toEqual([34, 33, 33]);
      expect(splitEqual(101, 3)).toEqual([34, 34, 33]);
      expect(splitEqual(101, 2)).toEqual([51, 50]);
    });

    it('preserves the original total across any split', () => {
      for (const total of [0, 1, 99, 100, 12345]) {
        for (const parts of [1, 2, 3, 4, 7]) {
          const result = splitEqual(total, parts);
          expect(result.reduce((a, b) => a + b, 0)).toBe(total);
          expect(result).toHaveLength(parts);
        }
      }
    });

    it('rejects invalid parts count', () => {
      expect(() => splitEqual(100, 0)).toThrow(TypeError);
      expect(() => splitEqual(100, -1)).toThrow(TypeError);
      expect(() => splitEqual(100, 1.5)).toThrow(TypeError);
    });
  });
});
