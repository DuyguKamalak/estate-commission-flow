# ADR-002: Commission breakdowns are immutable, versioned snapshots

## Status

Accepted — 2026-04-17 (Sprint 3)

## Context

A commission breakdown is derived data: it can always be *re-calculated*
from the underlying transaction (`totalServiceFee`, `listingAgentId`,
`sellingAgentId`) using the rules in `calculateCommission`. This raises
a legitimate question: should we persist the breakdown at all, or compute
it on every read?

Two forces push us toward persistence:

1. **Audit & reproducibility.** The brief describes commission as the
   deliverable to the business. If the rules ever change (a tiered agency
   split, a bonus adjustment, a VAT change) we still need to be able to
   display historical payouts exactly as they were paid, not re-interpreted
   under new rules.
2. **Reporting performance.** The "Reports & Analytics" screen aggregates
   shares across agents and time windows. Aggregating over a stored field
   is trivial (`$group` on `parties.agentId`); re-running the calculator
   per row on every report view is wasteful.

## Decision

Persist commission breakdowns in a dedicated `commission_breakdowns`
collection with the following rules:

- **One breakdown per transaction** (unique index on `transactionId`).
- **Written once**, when the transaction transitions to `COMPLETED`.
- **`ruleVersion: 'v1'`** is burned into every row. The calculator exports
  `COMMISSION_RULE_VERSION` and new rule sets become `v2`, `v3`, ...
  Historical rows are never rewritten.
- Monetary fields mirror the transaction exactly (see ADR-003): integer
  minor units, with a 3-letter uppercase currency code. `parties` is a
  small embedded array (1–2 entries, enforced by validator) containing the
  per-party share and human-readable reason string.
- The row is written inside the same service-layer unit of work that
  marks the transaction `COMPLETED`, so the two cannot drift. (Session-
  scoped write is added in Sprint 5 when the orchestration service lands.)

## Consequences

**Easier**

- Financial breakdown page loads with a single document fetch — no
  recomputation.
- Reports aggregate directly over `parties.agentId` / `parties.share`
  without branching on rule scenarios.
- Rule changes are a non-event for historical data. Existing rows keep
  their `ruleVersion` and display correctly.
- The calculator itself stays a pure function, trivially unit-tested
  (48 tests in Sprint 3, all pass in ~14s).

**Harder / trade-offs**

- Small storage duplication — each transaction grows by ~300 bytes for
  the breakdown row. Acceptable at any realistic estate-agency scale.
- A bug in the calculator that makes it to production will bake incorrect
  payouts into history; mitigation is the comprehensive unit test suite
  plus the `ruleVersion` tag that makes a later corrective migration
  auditable.

**Revisit when**

- The business requires retroactively re-calculating a historical period
  (e.g. correcting a VAT error). At that point we add a dedicated
  migration job rather than mutating rows in place.
