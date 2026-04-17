# ADR-003: Store all monetary values as integer minor units

## Status

Accepted — 2026-04-17 (Sprint 3)

## Context

IEEE-754 floating-point arithmetic is not associative and cannot exactly
represent most decimal fractions (`0.1 + 0.2 !== 0.3`). Commission
calculations repeatedly split totals in half and then in quarters; running
that arithmetic in `number` would accumulate errors and produce breakdowns
that don't sum back to the original fee.

Example of the problem with floating-point:

```
totalServiceFee = 100.01 (£)
agencyShare     = 50.005
agentPool       = 50.005
listingShare    = 25.0025   ← impossible to pay
sellingShare    = 25.0025
```

## Decision

All monetary values are persisted and transported **as non-negative
integer minor units** — pence for GBP, cents for EUR/USD, etc. The
currency itself is stored alongside as an uppercase ISO 4217 three-letter
code (`GBP` by default).

Helpers in `src/common/utils/money.util.ts`:

- `toMinorUnits(major)` — safe rounding from a display decimal.
- `toMajorUnits(minor)` — inverse for DTO / formatting.
- `splitHalfInteger(total)` — `[floor(total/2), ceil(total/2)]`; the
  second slot absorbs the odd penny. Used for agency vs agent-pool.
- `splitEqual(total, parts)` — evenly distributes `parts` slots, with
  the remainder going to the *earliest* slots. Used for listing vs
  selling split.

**Odd-penny routing is deterministic:**

1. Between agency and agent pool → **agent pool** gets the penny
   (favours the agents; agency keeps the floor).
2. Between listing and selling agent → **listing agent** gets the penny
   (arbitrary tie-break, but fixed and tested).

This is covered by `money.util.spec.ts` (conservation tests across
0, 1, 99, 100, 101, 12345, 999999) and `commission-calculator.spec.ts`
(end-to-end conservation on the £100.01 edge case).

Mongoose schemas enforce this at the persistence boundary:

```ts
@Prop({
  required: true,
  type: Number,
  min: 0,
  validate: {
    validator: (v: number) => Number.isInteger(v),
    message: 'totalServiceFee must be a non-negative integer (minor units).',
  },
})
totalServiceFee!: number;
```

The frontend converts to major units **only at the formatting layer**
(`composables/useCurrency.ts` using `Intl.NumberFormat`), so the network
boundary and all DB documents stay in integer units end-to-end.

## Consequences

**Easier**

- Arithmetic is exact. Conservation (sum of shares == total) is
  guaranteed by the splitter helpers, property-tested across many inputs.
- One representation everywhere: API, DB, calculator. No "half the
  codebase in major units, half in minor" ambiguity.
- Schema-level `Number.isInteger` validator catches accidental decimal
  writes from future code paths.

**Harder / trade-offs**

- DTOs must document clearly that `totalServiceFee: 12345` means
  `£123.45`. The frontend formatting composable and OpenAPI examples
  (Sprint 6) carry this explicitly.
- `Number.MAX_SAFE_INTEGER` is 2^53-1 = ~9 × 10^15. In pence that's
  £90 trillion — comfortable for any realistic estate-agency deal;
  no `BigInt` needed.

**Revisit when**

- The product enters a jurisdiction with a currency having more than
  two minor-unit digits (e.g. some Middle-Eastern currencies have three).
  The helpers stay correct; only the `toMinorUnits` / formatting layer
  needs a per-currency exponent.
