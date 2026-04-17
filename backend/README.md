# Estate Commission Flow — Backend

NestJS 11 + MongoDB Atlas + Mongoose API for the Estate Commission Flow system.

## Scripts

```bash
npm run start:dev     # watch mode
npm run start         # plain start
npm run build         # compile to dist/
npm run start:prod    # run compiled output (dist/main)
npm run test          # jest (98 unit tests)
npm run test:cov      # jest with coverage
npm run lint          # eslint --fix
npm run format        # prettier
npm run seed          # populate MongoDB with demo agents + transactions
npm run cleanup:test-data  # remove stray HTML-tagged test rows (idempotent)
```

`SEED_RESET=true npm run seed` wipes the demo collections (agents,
transactions, stage history, commission breakdowns) before re-seeding.

`npm run cleanup:test-data` is a one-shot maintenance script: it finds
any transaction whose title or address contains HTML-like tags (left
over from pen-testing or manual API pokes) and removes it plus its
breakdown and stage-history rows. Safe to re-run — does nothing when
no suspicious rows exist.

## Environment

Copy `.env.example` to `.env` and fill in:

| Key            | Required | Description                                          |
|----------------|----------|------------------------------------------------------|
| `PORT`         | no       | API port (default `3001`)                            |
| `MONGODB_URI`  | **yes**  | MongoDB Atlas connection string (replica set)        |
| `NODE_ENV`     | no       | `development` / `production`                         |
| `FRONTEND_URL` | no       | Allowed CORS origin (default `http://localhost:3000`)|
| `API_PREFIX`   | no       | Global route prefix (default `api`)                  |

The env schema is validated by Joi at boot — an invalid config aborts
the process before any route is bound.

## API surface

With the server running (`npm run start:dev`):

- **Swagger UI (interactive):** `http://localhost:3001/api/docs`
- **OpenAPI JSON (codegen / Postman):** `http://localhost:3001/api/docs-json`
- **Liveness probe:** `GET /api/health`
- **Readiness probe:** `GET /api/health/ready` — returns 503 when the
  MongoDB connection is not `connected` or a `{ ping: 1 }` round-trip
  fails. Recommended target for the load-balancer health check.

Every controller is tagged (`Health`, `Agents`, `Transactions`,
`Commissions`, `Reports`) and every endpoint carries an operation summary
+ description in the spec. Errors share the `ApiErrorDto` envelope with a
machine-readable `errorCode` enum (see
`src/common/enums/error-code.enum.ts`).

## Module overview

| Module         | Public endpoints                                                     |
|----------------|----------------------------------------------------------------------|
| `agents`       | CRUD + soft-delete (deactivate)                                      |
| `transactions` | Create, list/filter, fetch by id or reference code, stage history, update, advance stage |
| `commissions`  | Read-only: fetch breakdown by transaction, aggregate totals per agent |
| `reports`      | Dashboard snapshot, filterable commissions report (JSON + CSV)       |

Transactional writes (transaction create, stage advance, commission
breakdown persistence) run inside a single Mongo session via
`session.withTransaction(...)`.

## Architectural notes

Key design decisions live under `../docs/decisions/` — in particular:

- **ADR-002** — Immutable, versioned commission snapshots
- **ADR-003** — Monetary values in integer minor units (pence, cents, …)
- **ADR-004** — Transaction reference code format `TRX-YYYY-XXXXXX`
- **ADR-005** — OpenAPI / Swagger for the HTTP surface

## Testing

```bash
npm test              # 98 unit tests
npm run test:cov      # coverage report under ../coverage/
```

Notable suites:

- `commission-calculator.spec.ts` — 50/50 split, odd-penny routing,
  same-agent case.
- `stage-machine.spec.ts` — valid and invalid lifecycle transitions.
- `transactions.service.spec.ts` — atomic create + advance + breakdown,
  reference-code collision retry.
- `reports.service.spec.ts` — aggregation filters, agent name hydration.
- `commissions-csv.spec.ts` — CSV escaping and full report serialisation.
