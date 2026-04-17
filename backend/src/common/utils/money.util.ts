/**
 * Money utilities.
 *
 * Monetary values are persisted as *minor units* (integers) — e.g. GBP is
 * stored in pence, so £1,234.50 is `123450`. This avoids floating-point
 * drift when splitting commissions (50 % of an odd number, for instance).
 *
 * Commission calculations must always use these helpers; never use
 * JavaScript `number` arithmetic directly on monetary values expressed
 * as decimals.
 */

export type MinorUnits = number;

/**
 * Converts a major-unit decimal (e.g. 1234.5) into minor units (123450).
 * Rounds half-away-from-zero.
 */
export function toMinorUnits(major: number): MinorUnits {
  if (!Number.isFinite(major)) {
    throw new TypeError('Monetary value must be a finite number');
  }
  return Math.round(major * 100);
}

/**
 * Converts minor units back to major units as a decimal (for display / DTOs).
 */
export function toMajorUnits(minor: MinorUnits): number {
  return minor / 100;
}

/**
 * Integer-safe 50% split that preserves the total.
 *
 * Example: splitHalfInteger(125001) -> [62500, 62501]
 * The second value absorbs the odd-penny remainder so the two halves
 * always sum back to the original.
 */
export function splitHalfInteger(total: MinorUnits): [MinorUnits, MinorUnits] {
  assertWholeMinorUnits(total);
  const half = Math.trunc(total / 2);
  const remainder = total - half * 2;
  return [half, half + remainder];
}

/**
 * Integer-safe equal split into N parts that preserves the total.
 *
 * Any remainder pennies are distributed to the first slots, so:
 *   splitEqual(100, 3) -> [34, 33, 33]
 *   splitEqual(101, 3) -> [34, 34, 33]
 */
export function splitEqual(total: MinorUnits, parts: number): MinorUnits[] {
  assertWholeMinorUnits(total);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new TypeError('Parts count must be a positive integer');
  }
  const base = Math.trunc(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => (i < remainder ? base + 1 : base));
}

function assertWholeMinorUnits(value: MinorUnits): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`Monetary minor units must be a non-negative integer, got: ${value}`);
  }
}
