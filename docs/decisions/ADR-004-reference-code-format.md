# ADR-004: Transaction reference code format `TRX-YYYY-XXXXXX`

## Status

Accepted — 2026-04-17 (Sprint 3)

## Context

Every transaction needs a **human-friendly** identifier that appears on
the UI, on financial breakdowns, and in any report an estate agent might
read aloud on a phone call. The raw Mongo `_id` ObjectId is unsuitable
for this: it's 24 hex characters, impossible to dictate, and leaks
timestamp information that isn't meaningful to the user.

Requirements for the reference code:

1. **Unique** across the life of the system (at least to the end of the
   decade, at realistic volumes).
2. **Unambiguous when spoken or written by hand** — no `O`/`0`,
   `I`/`1`/`l` confusion.
3. **Self-describing year** so a code glanced at in isolation reveals its
   rough age.
4. **Short enough to fit in a table column** but long enough to look
   deliberate.
5. **Collision-resistant by design**, but with a safety net at the DB
   layer for the astronomical edge case.

## Decision

Reference codes follow the format:

```
TRX-YYYY-XXXXXX
```

- `TRX-` — static prefix, makes the identifier self-typing in search UIs
  and distinguishes it from any unrelated code we might introduce later.
- `YYYY` — four-digit UTC year at the moment of creation.
- `XXXXXX` — 6 characters drawn uniformly from the alphabet
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (excludes `0`, `O`, `1`, `I`, `L`).

That gives **31^6 ≈ 887 million** distinct suffixes per year — more than
enough headroom; the *realistic* collision probability at 100 k
transactions per year is ~5 × 10^-3 total, and the DB guarantees no
duplicates ever ship.

**Implementation** (`src/common/utils/reference-code.util.ts`):

- `generateReferenceCode(now?)` uses `crypto.randomBytes(6)` and maps
  each byte modulo the alphabet length. The mod-bias is negligible at
  this alphabet size (31 divides 256 unevenly by less than one part in
  eight, which is irrelevant for a 6-character human identifier).
- `isValidReferenceCode(value)` is used by DTOs / route guards to reject
  malformed input before it reaches any query.

**Uniqueness is belt-and-braces:**

- Belt: The alphabet + random source makes *generated* collisions
  vanishingly rare in practice.
- Braces: `transactions.referenceCode` has a **unique index** in Mongo
  (`uniq_transactions_referenceCode`). The transaction service retries
  with a freshly generated code on duplicate-key errors (implementation
  lands in Sprint 5 with the `TransactionsService`).

## Consequences

**Easier**

- Agents can read codes aloud without "is that an O or a zero?" clarifying
  questions.
- The year prefix makes filtering by year trivial even without a dedicated
  index: `referenceCode: /^TRX-2026-/`.
- Validation regex is straightforward and reusable (DTO + guard + unit
  tests).

**Harder / trade-offs**

- Codes are not monotonic, so they cannot be used for sort order. We sort
  by `createdAt` instead (already indexed).
- A naive regex-based search doesn't match "TRX2026ABC234" without the
  dashes. Acceptable — the frontend normalises input to the canonical
  form before querying.

**Revisit when**

- The system needs to generate >100 M transactions a year and the
  birthday-collision retry rate becomes measurable. The fix is trivial:
  extend the suffix from 6 to 8 characters, bumping the space to ~900 billion
  per year. Existing codes remain valid because the regex is length-anchored.
