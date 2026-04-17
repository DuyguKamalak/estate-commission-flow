# ADR-001: Use Mongoose (via `@nestjs/mongoose`) over the native MongoDB driver

## Status

Accepted — 2026-04-17 (Sprint 3)

## Context

The brief requires MongoDB as the persistence layer. Within the Node.js ecosystem
we had two realistic options:

1. **Native driver (`mongodb` package)** — minimal abstraction, direct BSON
   manipulation, hand-rolled validation.
2. **Mongoose ODM (via `@nestjs/mongoose`)** — schema-driven modelling,
   first-class NestJS integration (`@InjectModel`, `forFeature`,
   `forRootAsync`), built-in validators, middleware hooks, typed
   `HydratedDocument`.

The transaction + commission domain has a handful of strict rules that
benefit from schema-level enforcement:

- `referenceCode` must match `TRX-YYYY-XXXXXX` exactly.
- `totalServiceFee` and all derived shares must be **non-negative integers**
  (minor units — see ADR-003).
- `stage` is constrained to a fixed enum.
- Cross-document references (`listingAgentId`, `sellingAgentId`,
  `transactionId`) are always `ObjectId` and benefit from `ref` metadata
  when we reach for `populate` on the reporting endpoints.

## Decision

Use **Mongoose via `@nestjs/mongoose`**. All domain schemas are defined with
the `@Schema` / `@Prop` decorators and registered through
`MongooseModule.forFeature` inside the module they belong to. Connection
setup lives in `src/infrastructure/database/database.module.ts` using
`MongooseModule.forRootAsync` so the URI is resolved through `ConfigService`
rather than read directly from `process.env`.

## Consequences

**Easier**

- Schema-level validation (`min`, `maxlength`, `match`, custom `validator`)
  means malformed data is rejected at the boundary, not mid-calculation.
- `@nestjs/mongoose` ties cleanly into the module system; every feature
  module declares its own schemas and exports `MongooseModule` so siblings
  can inject the model without circular imports.
- Indexes (unique, compound, sort-friendly) are declared alongside the
  schema and survive code review — no out-of-band DBA work.
- `HydratedDocument<T>` gives us typed documents that flow through the
  service layer with minimal ceremony.

**Harder / trade-offs**

- One extra dependency to maintain, plus the occasional version drift
  between `mongoose` and `@nestjs/mongoose` (pinned to compatible majors).
- Mongoose's automatic `_id` handling means our `toJSON` transform has to
  explicitly alias `_id` → `id` to keep the public API shape clean.
- `autoIndex` is disabled in production (indexes must be built deliberately
  via a migration step) to avoid surprise index-build traffic on Atlas.

**Revisit when**

- We hit a query that Mongoose materially slows down and raw aggregation
  would be faster. In that case we drop to the native driver *locally* for
  that one query, not globally.
