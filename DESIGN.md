# DESIGN.md — Estate Commission Flow

> Architecture, domain model, and design rationale for the Estate Commission Flow system.
> This document is the authoritative reference for **why** the system is built the way it is.

**Live demo:** https://estate-commission-flow.vercel.app/
**Repository layout:** `backend/` (NestJS) + `frontend/` (Nuxt 3) in a single Git repo.

---

## 1. Problem Statement

Estate agency consultancies close sales and rentals every day. Once an agreement is
reached, a sequence of operational and financial steps follows: earnest money, title
deed, final completion. When the transaction completes, the total service fee must be
split between the agency and the agents who worked on it, according to fixed rules.

Today this is tracked in spreadsheets and chat messages. The result:

- No single source of truth for a transaction's current stage.
- Commission calculation is manual and prone to arithmetic errors.
- No audit trail — no record of who changed what, or why a given agent was paid a
  given amount.

**Goal:** a system that automates the lifecycle, applies the commission rules
deterministically, persists an audit trail, and exposes a clean operations UI.

---

## 2. Domain Model

### 2.1 Agent
A consultant who can earn commission. Carries contact details and an `isActive` flag
so retired agents stay in historical records but are hidden from the create-transaction
flow.

### 2.2 Transaction — root aggregate
A single property sale or rental, tracked from agreement to completion. Holds the
property metadata, references to the listing and selling agents, the total service
fee in minor units, the current stage, and the per-stage timestamps.

### 2.3 TransactionStageHistory
Append-only record of every stage change. Provides the audit trail required for
traceability — who moved the transaction, when, from which stage to which stage, and
optionally why.

### 2.4 CommissionBreakdown
A snapshot of the financial split calculated at the moment a transaction is marked
`completed`. Stored in its own collection so historical breakdowns remain stable
even if the commission rules evolve (rule versioning via `ruleVersion`).

---

## 3. Key Architectural Decisions

| #  | Decision | Rationale |
|----|----------|-----------|
| 1  | **Mongoose over the native driver** | Cleaner NestJS integration, schema-level validation, less boilerplate. Clear separation between domain logic and persistence. |
| 2  | **Single repository, two folders** | `backend/` and `frontend/` side by side. No monorepo tooling — keeps setup friction minimal for reviewers. |
| 3  | **Commission stored as immutable snapshot** | Written on transition to `completed`. Protects historical financial data from future rule changes. |
| 4  | **Invalid stage transitions blocked at domain layer** | Enforced in a pure service, not just in the UI. Single source of truth for the lifecycle. |
| 5  | **Monetary values in minor units (integer pennies/cents)** | Eliminates floating-point drift across the 50/25/25 split. Odd-penny rounding is deterministic. |
| 6  | **Reference code format `TRX-YYYY-XXXXXX`** | Human-readable, collision-resistant, filterable by year. Generated server-side. |
| 7  | **Deployment: Render + Vercel + Atlas** | Each component on a platform it fits: NestJS on Render, Nuxt on Vercel, MongoDB on Atlas. No container orchestration overhead for a case-scale system. |
| 8  | **Multi-currency supported per transaction** | Each transaction carries its own `currency`. Reports aggregate per-currency rather than forcing conversion — no FX assumptions baked into historical data. |
| 9  | **Forward-only stage machine** | Backward and skip transitions are rejected with `INVALID_STAGE_TRANSITION`. Mirrors real operational flow. |
| 10 | **Odd-penny routing rule** | When the agent pool doesn't divide evenly, the extra penny is routed to the **listing agent**. This rule is documented in UI copy so it is transparent to operators. |

---

## 4. MongoDB Schema Strategy

### Collections
- `agents`
- `transactions`
- `transaction_stage_histories`
- `commission_breakdowns`

### Indexes
| Collection | Index | Purpose |
|------------|-------|---------|
| `transactions` | `referenceCode` (unique) | External lookup, collision prevention |
| `transactions` | `stage` | Dashboard stage distribution, list filter |
| `transactions` | `listingAgentId` | Agent filter, per-agent reports |
| `transactions` | `sellingAgentId` | Agent filter, per-agent reports |
| `transactions` | `createdAt` desc | Recent transactions, pagination |
| `commission_breakdowns` | `transactionId` (unique) | Snapshot lookup, prevents double-write |
| `transaction_stage_histories` | `transactionId` | Timeline rendering |

### Why snapshot over live recalculation
The commission breakdown is computed once, on the `title_deed → completed`
transition, and persisted. Rationale:

- **Historical stability**: if rules change later (e.g. agency share drops to 45%),
  already-completed transactions remain reported as they were paid out.
- **Report performance**: aggregations read a pre-computed document instead of
  recalculating on each query.
- **Auditability**: the snapshot carries `ruleVersion` and `calculatedAt` for
  provenance.

---

## 5. Commission Calculation

### Rules
- Agency receives **50%** of the total service fee.
- Remaining **50%** is the agent pool.
- **Scenario A** — `listingAgentId === sellingAgentId`: that agent receives the
  entire agent pool (100% of the 50%, i.e. 50% of the total service fee).
- **Scenario B** — `listingAgentId ≠ sellingAgentId`: the agent pool is split
  **25% / 25%** between them. Any odd penny is routed to the listing agent.

### Implementation
- Computed in a pure domain service (`CommissionCalculator`), no I/O, fully
  unit-testable.
- All arithmetic performed on integer **minor units** (pennies/cents) to
  eliminate floating-point drift.
- On transition to `completed`, `TransactionsService` invokes the calculator and
  persists the result as a `CommissionBreakdown` document, then attaches a summary
  onto the transaction response.

### Same-agent reporting
When Scenario A applies, the UI surfaces the agent once with a
**"Listing + Selling Agent"** role label instead of listing the same person twice.
The breakdown document still records both `listingAgentShare` and
`sellingAgentShare` for symmetry with Scenario B.

---

## 6. Stage Transition Rules

Valid transitions:

```
agreement → earnest_money → title_deed → completed
```

Rejected with `INVALID_STAGE_TRANSITION`:
- Any backward move.
- Skipping a stage (e.g. `agreement → title_deed`).
- Any change after `completed`.
- Transitioning to the current stage.

Every successful transition:
1. Updates `transaction.stage` and the corresponding date field
   (`agreementDate`, `earnestMoneyDate`, …).
2. Appends a row to `transaction_stage_histories`.
3. On `title_deed → completed`, triggers commission calculation and snapshot.

---

## 7. API Design

REST, JSON, unversioned for the case scope.

### Endpoint summary

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/agents` | Create agent |
| `GET` | `/agents` | List agents (pagination, `isActive` filter) |
| `GET` | `/agents/:id` | Agent detail |
| `PATCH` | `/agents/:id` | Update agent |
| `POST` | `/transactions` | Create transaction |
| `GET` | `/transactions` | List transactions (stage/type/agent filters, pagination, search) |
| `GET` | `/transactions/:id` | Transaction detail (agents resolved client-side from the agents store) |
| `PATCH` | `/transactions/:id` | Update transaction metadata |
| `POST` | `/transactions/:id/stage-transition` | Move to next stage (triggers snapshot at `completed`) |
| `GET` | `/transactions/:id/financial-breakdown` | Commission snapshot |
| `GET` | `/reports/dashboard` | Dashboard KPIs |
| `GET` | `/reports/completed` | Per-currency completed deal aggregation + agent earnings |

### Standard error response

```json
{
  "timestamp": "2026-04-17T12:34:56.789Z",
  "path": "/transactions/abc/stage-transition",
  "statusCode": 400,
  "errorCode": "INVALID_STAGE_TRANSITION",
  "message": "Cannot transition from completed to earnest_money"
}
```

Defined `errorCode`s: `VALIDATION_ERROR`, `TRANSACTION_NOT_FOUND`,
`AGENT_NOT_FOUND`, `INVALID_STAGE_TRANSITION`, `COMMISSION_CALCULATION_ERROR`.

### Pagination contract
All list endpoints accept `page` (1-based) and `pageSize` (max 100, default 25).
Requests exceeding the max are rejected with `VALIDATION_ERROR`. Frontend clamps
input to the server limit rather than relying on server errors to drive UX.

---

## 8. Frontend Architecture

- **Nuxt 3** with pages-based routing.
- **Pinia** stores per domain aggregate: `agents`, `transactions`, `dashboard`,
  `reports`.
- **Composables** isolate data-fetching and formatting: `useApiFetch`,
  `useTransactions`, `useCurrency`.
- **Tailwind CSS** drives all styling; a small set of shared UI primitives
  (`ErrorState`, `LoadingSkeleton`, `EmptyState`, `StageBadge`) provides
  consistent feedback across pages.

### Page map

| Route | Purpose |
|-------|---------|
| `/` | Dashboard overview — KPIs, stage distribution, recent transactions |
| `/transactions` | Transaction list with stage/type/agent filters |
| `/transactions/new` | Create transaction form |
| `/transactions/[id]` | Detail — stage timeline, agents, commission breakdown |
| `/agents` | Agent directory |
| `/agents/new` | Create agent |
| `/reports` | Per-currency aggregation, agent earnings, completed deals |
| `/settings` | Placeholder for future configuration |

---

## 9. State Management

- Server state lives in Pinia; UI state (form drafts, modals) lives in components.
- Mutations **refetch** the affected resource rather than doing optimistic
  updates — the dataset size and the financial nature of the domain both favour
  correctness over latency.
- Every store exposes `isLoading` and `error` state explicitly; pages render
  `LoadingSkeleton` / `ErrorState` / `EmptyState` accordingly rather than falling
  back to a generic boundary.

---

## 10. Testing Strategy

### Mandatory unit tests
- **Commission calculator**
  - Agency share is always 50%.
  - Same-agent scenario: entire pool to that agent, no odd-penny drift.
  - Different-agent scenario: even split, odd penny routed to listing agent.
- **Stage transition rules**
  - All three forward transitions succeed.
  - Backward, skip, same-stage, and post-`completed` transitions are rejected.
- **Transaction service**
  - Create succeeds with valid input.
  - Transition to `completed` writes a `CommissionBreakdown`.
  - Missing agent references raise `AGENT_NOT_FOUND`.
- **DTO validation**
  - Negative service fee rejected.
  - Missing required fields rejected.
  - `pageSize > 100` rejected.

### Manual smoke checklist (pre-deploy)
1. `/` dashboard loads, KPIs non-zero.
2. `/agents` renders a list without errors.
3. `/transactions` list, filter, pagination work.
4. Create transaction → advance through all four stages → verify breakdown
   appears at `completed`.
5. `/reports` renders per-currency aggregation.

---

## 11. Trade-offs & Known Limitations

- **No authentication / authorisation** in the MVP. The case does not require it
  and adding it would dilute focus from the domain rules.
- **Single-tenant assumption** — no multi-agency isolation.
- **No soft delete** — records are immutable once created; `isActive` flags handle
  retirement.
- **Live aggregations in reports** — no materialised views. Acceptable at case
  scale; would need pre-aggregation at production scale.
- **FX not modelled** — per-currency aggregation only. A real system would need
  rate snapshots at completion time.
- **No background jobs** — commission snapshot runs synchronously on the
  `completed` transition. A production system would move this to an event handler.

---

## 12. Future Improvements

- OpenAPI / Swagger documentation.
- Role-based access control.
- CSV / PDF export of financial breakdowns.
- Real-time stage updates via WebSockets.
- Commission rule versioning with configurable policies.
- FX-aware cross-currency reports.
- CI pipeline with automated test + deploy gates.
- Event-driven commission snapshot (outbox pattern).

---

_This document evolves alongside the code. Every architectural decision is
expected to land here (or as an ADR under `docs/decisions/`) before the
corresponding implementation._
