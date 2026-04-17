import { randomBytes } from 'node:crypto';

/**
 * Alphabet for the random portion of a reference code.
 *
 * - Uppercase alphanumerics only (matches the "TRX-" prefix's uppercase feel).
 * - Excludes visually ambiguous characters: 0/O, 1/I/L.
 *
 * 31 characters × 6 positions = ~887M combinations per year, which is
 * collision-safe at the expected scale of this case.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generates a transaction reference code of the form `TRX-YYYY-XXXXXX`.
 *
 * Uniqueness is also enforced at the persistence layer via a unique index;
 * callers should retry on duplicate-key errors.
 */
export function generateReferenceCode(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const bytes = randomBytes(CODE_LENGTH);
  let suffix = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `TRX-${year}-${suffix}`;
}

/**
 * Validates the shape of a reference code. Used by DTOs / guards when
 * callers pass a referenceCode in route parameters.
 */
export function isValidReferenceCode(value: string): boolean {
  return /^TRX-\d{4}-[A-Z0-9]{6}$/.test(value);
}
