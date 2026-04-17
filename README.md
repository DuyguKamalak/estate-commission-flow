# Estate Commission Flow

> A full-stack transaction & commission management system for estate agency consultancies.
> Tracks the lifecycle of a property transaction from initial agreement to completion, and
> automatically distributes the service fee between the agency and its agents according to
> deterministic, auditable business rules.

---

## Overview

When an estate agency closes a sale or rental, a sequence of operational and financial
milestones follows — earnest money, title deed, final settlement — and the total service
fee must be split between the agency and the agents involved. Doing this manually is
slow, error-prone, and hard to audit.

**Estate Commission Flow** automates this process end-to-end:

- Tracks every transaction through a strict, validated lifecycle
  (`agreement → earnest_money → title_deed → completed`).
- Produces a deterministic financial breakdown for every completed transaction
  (50/50 agency / agent split, deterministic odd-penny routing).
- Persists an immutable snapshot of each breakdown for long-term traceability
  (see [ADR-002](./docs/decisions/ADR-002-immutable-commission-snapshots.md)).
- Exposes a live operations dashboard, a filterable commissions report with
  CSV export, and a fully documented REST API.

---

## Tech Stack

### Backend
- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Framework:** NestJS 11
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Validation:** class-validator, class-transformer, Joi (env schema)
- **API docs:** OpenAPI 3 via `@nestjs/swagger`
- **Testing:** Jest (98 unit tests at the time of writing)

### Frontend
- **Framework:** Nuxt 3 (Vue 3, `<script setup>`)
- **State management:** Pinia
- **Styling:** Tailwind CSS v4 (design tokens in `@theme`)
- **Design system:** "The Architectural Ledger" (Manrope + Inter, navy/white editorial)

### Infrastructure
- **Backend host:** Render
- **Frontend host:** Vercel
- **Database:** MongoDB Atlas

---

## Repository layout

```
estate-commission-flow/
├── backend/                  NestJS API
│   ├── src/
│   │   ├── common/           Shared enums, DTOs, exceptions, filters
│   │   ├── health/           Liveness + readiness probes
│   │   ├── infrastructure/   Database (Mongoose) module
│   │   ├── modules/
│   │   │   ├── agents/
│   │   │   ├── transactions/
│   │   │   ├── commissions/
│   │   │   └── reports/
│   │   ├── scripts/          Demo seed script
│   │   └── main.ts           Bootstrap (incl. Swagger mount)
│   └── package.json
├── frontend/                 Nuxt 3 application
│   ├── components/           Reusable UI primitives
│   ├── composables/          useApiClient, useCommissionPreview, …
│   ├── pages/                Dashboard, Transactions, Agents, Reports, Settings
│   ├── stores/               Pinia stores (dashboard, transactions, agents)
│   ├── layouts/default.vue   Sidebar + header shell
│   └── nuxt.config.ts
├── docs/
│   ├── decisions/            Architecture Decision Records (ADR-001..005)
│   └── ...
├── .gitignore
├── README.md                 (this file)
└── DESIGN.md                 Architecture & design rationale
```

---

## Quick start

### Prerequisites
- Node.js 20+
- npm 10+
- A MongoDB Atlas cluster (or a local replica-set-enabled `mongod`; multi-document
  transactions require a replica set).

### 1. Clone

```bash
git clone <repo-url>
cd estate-commission-flow
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # fill in MONGODB_URI, PORT, FRONTEND_URL
npm run start:dev
```

The API boots on `http://localhost:3001/api`.

### 3. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env    # NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
npm run dev
```

The UI boots on `http://localhost:3000`.

### 4. (Optional) Seed demo data

With the backend `.env` configured:

```bash
cd backend
npm run seed                 # append / reuse existing agents + transactions
SEED_RESET=true npm run seed # wipe demo collections first, then seed
```

The script creates four agents, five transactions at every lifecycle stage,
and two completed transactions across two currencies (GBP + EUR) so the
dashboard and commissions report have meaningful data on first load.

---

## Key endpoints

| Method | Path                                 | Purpose                                        |
|--------|--------------------------------------|------------------------------------------------|
| GET    | `/api/health`                        | Liveness probe (process-level)                 |
| GET    | `/api/health/ready`                  | Readiness probe (pings MongoDB, 503 on failure) |
| GET    | `/api/docs`                          | Swagger UI (interactive API explorer)          |
| GET    | `/api/docs-json`                     | OpenAPI 3 spec (JSON, for codegen / Postman)   |
| POST   | `/api/agents`                        | Create agent                                   |
| GET    | `/api/agents`                        | List agents (filter + paginate)                |
| POST   | `/api/transactions`                  | Create transaction (auto reference code)       |
| POST   | `/api/transactions/:id/advance-stage`| Advance one step; writes breakdown on completed |
| GET    | `/api/reports/dashboard`             | Single-call dashboard snapshot                 |
| GET    | `/api/reports/commissions`           | Filterable commissions report (JSON)           |
| GET    | `/api/reports/commissions.csv`       | Same report, serialised to CSV                 |

For the full, live surface with request/response schemas and example payloads
open `http://localhost:3001/api/docs` after starting the backend.

---

## Environment variables

### Backend (`backend/.env`)
| Key             | Required | Description                                    |
|-----------------|----------|------------------------------------------------|
| `PORT`          | no       | API port (default `3001`)                      |
| `MONGODB_URI`   | **yes**  | MongoDB Atlas connection string                |
| `NODE_ENV`      | no       | `development` / `production` (default `development`) |
| `FRONTEND_URL`  | no       | Allowed CORS origin (default `http://localhost:3000`) |
| `API_PREFIX`    | no       | Global route prefix (default `api`)            |

### Frontend (`frontend/.env`)
| Key                        | Required | Description                       |
|----------------------------|----------|-----------------------------------|
| `NUXT_PUBLIC_API_BASE_URL` | **yes**  | Base URL of the backend API       |

---

## Testing

```bash
cd backend
npm test              # all 98 unit tests
npm run test:cov      # with coverage
```

Coverage hot-spots:

- `commission-calculator.spec.ts` — exhaustive tests for the 50/50 split,
  odd-penny routing, same-agent case, and currency propagation.
- `stage-machine.spec.ts` — every valid and invalid stage transition.
- `transactions.service.spec.ts` — atomic create + advance + breakdown
  persistence, reference-code collision retry, agent inactivation.
- `reports.service.spec.ts` — aggregation filters, agent name hydration.
- `commissions-csv.spec.ts` — CSV escaping and full report serialisation.

---

## Deployment

| Layer     | Platform       | Notes                                               |
|-----------|----------------|-----------------------------------------------------|
| Backend   | Render         | `npm run build && npm run start:prod`. Health check: `/api/health/ready`. |
| Frontend  | Vercel         | `npm run build` with `NUXT_PUBLIC_API_BASE_URL` set to the Render URL. |
| Database  | MongoDB Atlas  | M0 (or higher). Replica-set is required for multi-document transactions. |

The readiness endpoint (`/api/health/ready`) is the recommended load-balancer
health check: it returns 503 when MongoDB is unreachable, so traffic is
removed from a degraded instance without restarting the process.

---

## Documentation

- [`DESIGN.md`](./DESIGN.md) — architecture, domain model, business rules, trade-offs.
- [`docs/decisions/`](./docs/decisions/) — Architecture Decision Records:
  - [ADR-001](./docs/decisions/ADR-001-mongoose-over-native-driver.md) — Mongoose over the native driver
  - [ADR-002](./docs/decisions/ADR-002-immutable-commission-snapshots.md) — Immutable, versioned commission snapshots
  - [ADR-003](./docs/decisions/ADR-003-monetary-minor-units.md) — Monetary values in integer minor units
  - [ADR-004](./docs/decisions/ADR-004-reference-code-format.md) — Transaction reference code format
  - [ADR-005](./docs/decisions/ADR-005-openapi-swagger.md) — OpenAPI / Swagger for the HTTP surface

---

## License

Private — internal technical case submission.
