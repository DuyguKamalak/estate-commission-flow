# DESIGN.md — Estate Commission Flow

> Architecture, domain model, and design rationale for the Estate Commission Flow system.
> This document is the authoritative reference for why the system is built the way it is.

---

## 1. Problem Statement

Estate agency consultancies close sales and rentals every day. Once an agreement is
reached, a sequence of operational and financial steps follows: earnest money, title
deed, final completion. When the transaction completes, the total service fee must be
split between the agency and the agents who worked on it, according to fixed rules.

Today this is tracked in spreadsheets and chat messages. The result:

- No single source of truth for a transaction's current stage.
- Commission calculation is manual and prone to arithmetic errors.
- There is no audit trail — no record of who changed what, or why a given agent was
  paid a given amount.

**Goal:** a system that automates the lifecycle, applies the commission rules
deterministically, persists an audit trail, and exposes a clean UI for the operations
team.

---

## 2. Domain Model

> _To be completed in Sprint 3 after schema finalisation._

### 2.1 Agent
Represents a consultant who can earn commission.

### 2.2 Transaction
The root aggregate — a single property sale or rental, tracked from agreement through
to completion.

### 2.3 TransactionStageHistory
Append-only record of every stage change on a transaction. Provides the audit trail
required for traceability.

### 2.4 CommissionBreakdown
A snapshot of the financial split calculated at the moment a transaction is marked
`completed`. Stored in its own collection so that historical breakdowns remain stable
even if the commission rules evolve.

---

## 3. Key Architectural Decisions

> Each decision is expanded in [`docs/decisions/`](./docs/decisions/) as an ADR.

| # | Decision | Summary |
|---|----------|---------|
| 1 | Mongoose over the native driver | Cleaner NestJS integration, schema-level validation, less boilerplate. |
| 2 | Single repository | `/backend` and `/frontend` live side by side for review simplicity. |
| 3 | Commission stored as an immutable snapshot | Protects historical data from future rule changes. |
| 4 | Invalid stage transitions are blocked | Enforced in the domain layer, not just in the UI. |
| 5 | Monetary values in minor units (integers) | Avoids floating-point errors in commission splits. |
| 6 | Reference code format `TRX-YYYY-XXXXXX` | Human-readable, collision-resistant, filterable by year. |
| 7 | Deployment: Render + Vercel + Atlas | Fast, case-appropriate, low operational overhead. |

---

## 4. MongoDB Schema Strategy

> _Detailed schemas + indexes to be documented in Sprint 3._

High-level approach:

- `agents`, `transactions`, `transaction_stage_histories`, `commission_breakdowns` as
  separate collections.
- `transactions.referenceCode` — unique index.
- `commission_breakdowns.transactionId` — unique index.
- Indexes on `stage`, `listingAgentId`, `sellingAgentId`, `createdAt` to support the
  dashboard and reports queries.

---

## 5. Commission Calculation

### Rules
- Agency receives **50%** of the total service fee.
- Remaining **50%** is the agent pool.
- **Scenario A** — listing agent === selling agent: that agent receives the entire
  agent pool (100% of the 50%).
- **Scenario B** — listing agent ≠ selling agent: the agent pool is split **25% / 25%**
  between them.

### Implementation
- Calculated in a pure domain service (`CommissionCalculator`), no I/O, fully unit-testable.
- All arithmetic is performed on integer minor units (e.g. pennies for GBP) to
  eliminate floating-point drift.
- On transition to `completed`, the transactions service calls the calculator and
  persists the result as a `CommissionBreakdown` document.

---

## 6. Stage Transition Rules

Valid transitions:

```
agreement → earnest_money → title_deed → completed
```

Invalid transitions (rejected with `INVALID_STAGE_TRANSITION`):

- Any backward move.
- Skipping a stage.
- Any change after `completed`.
- Transitioning to the current stage.

Every successful transition appends a row to `transaction_stage_histories`.

---

## 7. API Design

> _Full endpoint catalogue finalised in Sprint 5._

REST, JSON, versionless for this case. Standardised error response:

```json
{
  "timestamp": "2026-04-17T12:34:56.789Z",
  "path": "/transactions/abc/stage-transition",
  "statusCode": 400,
  "errorCode": "INVALID_STAGE_TRANSITION",
  "message": "Cannot transition from completed to earnest_money"
}
```

---

## 8. Frontend Architecture

- **Nuxt 3** pages-based routing.
- **Pinia** stores one per domain aggregate (`agents`, `transactions`, `dashboard`,
  `reports`).
- **Composables** isolate data-fetching (`useApiFetch`, `useTransactions`, …).
- **Tailwind CSS** drives all styling; design tokens match the Stitch "Architectural
  Ledger" system.

### Page map
| Route                    | Purpose                                  |
|--------------------------|------------------------------------------|
| `/`                      | Dashboard overview                       |
| `/transactions`          | Transaction list / management            |
| `/transactions/new`      | Create transaction                       |
| `/transactions/[id]`     | Transaction detail & financial breakdown |
| `/agents`                | Agent directory                          |
| `/agents/[id]`           | Agent profile & performance              |
| `/reports`               | Reports & analytics                      |
| `/settings`              | Settings & configuration                 |

---

## 9. State Management

- Server state lives in Pinia stores, cached in memory for the session.
- Mutations refetch the affected resource rather than doing optimistic updates — the
  dataset is small enough that correctness beats speed here.
- Loading and error state are modelled explicitly per store, surfaced as `isLoading`
  / `error` getters and consumed by UI shells.

---

## 10. Testing Strategy

- **Unit tests (mandatory):** commission calculator (both scenarios), stage transition
  rules (happy + invalid paths), core service methods.
- **DTO validation tests:** key inputs (negative fee, missing agent).
- **Manual smoke checklist** before each deployment push.

---

## 11. Trade-offs & Known Limitations

- No authentication / authorisation in MVP — the case does not require it, and adding
  it would dilute focus away from the domain rules.
- No multi-tenant isolation — single-agency assumption.
- No soft delete — records are immutable once created; `isActive` flags handle retirement.
- Reports use live aggregations (no materialised views) — fine at the scale expected
  for this case.

---

## 12. Future Improvements

- OpenAPI / Swagger documentation.
- Role-based access control.
- CSV / PDF export of financial breakdowns.
- Real-time stage updates via WebSockets.
- Commission rule versioning with configurable policies.
- CI pipeline with automated test + deploy.

---

_This document evolves alongside the code. Every architectural decision is expected to
land here (or as an ADR under `docs/decisions/`) before the corresponding implementation._
