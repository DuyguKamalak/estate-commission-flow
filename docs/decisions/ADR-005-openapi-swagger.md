# ADR-005: OpenAPI / Swagger for the HTTP surface

## Status

Accepted — 2026-04-17 (Sprint 8)

## Context

The backend exposes a REST API that will be consumed by multiple clients
over the lifetime of the product: the Nuxt frontend (today), future
native mobile clients, third-party integrations (e.g. CRM syncs), and
internal automation / back-office scripts. Without a machine-readable
contract we pay a tax every time we onboard a new consumer:

- Frontend engineers hand-type TypeScript interfaces that drift from
  the server's DTOs.
- Integrators have to grep source files to discover which endpoints
  exist, which query params are optional, and what the error envelope
  looks like.
- QA have no "source of truth" to smoke test against — they recreate
  requests in Postman collections that silently diverge from the API.
- Reviewers cannot inspect the API surface without cloning the repo.

Requirements for the contract format:

1. **Generated from code** so it cannot lie. Hand-maintained docs rot
   within weeks.
2. **Interactive** enough for a non-technical reviewer to try a request
   against a local dev instance.
3. **Exportable** as plain JSON/YAML so it can be piped into codegen
   tools, Postman, Insomnia, or stored as an artifact per release.
4. **Cheap to maintain** — the decoration cost per endpoint must be
   small enough that contributors don't treat it as optional.

## Decision

Adopt **OpenAPI 3** via `@nestjs/swagger`, mounted at
`/${apiPrefix}/docs` (Swagger UI) with the machine-readable spec
available at `/${apiPrefix}/docs-json`.

Concretely:

- `SwaggerModule` is wired in `src/main.ts` after `ConfigService` is
  read, so the spec's `server` URL reflects the actual port / prefix
  the process is listening on.
- Every controller is tagged (`@ApiTags`) and every endpoint carries a
  one-line `@ApiOperation` summary plus a longer description that
  explains the *invariant* (not just the shape).
- All DTOs carry `@ApiProperty` / `@ApiPropertyOptional` with a
  realistic `example`. Validation rules (`minLength`, `maxLength`,
  `enum`, `minimum`) are expressed on the DTO so they are enforced by
  both `ValidationPipe` AND rendered in the docs — one source of truth.
- Error envelopes are documented through a shared `ApiErrorDto` class
  (`src/common/dto/api-error.dto.ts`). Every controller registers the
  common failure responses at class level (`@ApiBadRequestResponse`,
  etc.) so the per-endpoint noise stays minimal.
- The `errorCode` field is typed with the `ErrorCode` enum, so
  integrators can see the exact strings they'll receive (`AGENT_NOT_FOUND`,
  `INVALID_STAGE_TRANSITION`, etc.) directly in the generated schema.
- The CSV export endpoint (`/reports/commissions.csv`) is annotated with
  `@ApiProduces('text/csv')` and a binary response schema, so tooling
  doesn't try to generate a JSON model for it.

## Consequences

**Easier**

- Frontend typing can now be generated (or manually kept in sync with a
  well-known contract). The `frontend/types/api.ts` interfaces map 1:1
  to documented DTOs.
- Reviewers hitting `http://localhost:3001/api/docs` can try every
  endpoint without cloning the repo or reading code.
- QA / integrators can import the spec into Postman for regression
  suites and diff it between releases to catch accidental breaking
  changes.
- The `errorCode` enum is surfaced in one place; consumers can branch
  on stable codes without scraping the service layer.

**Harder / trade-offs**

- Adding a new endpoint now requires `@ApiOperation` + `@ApiProperty`
  decoration. This is cheap per-endpoint but must become a code-review
  expectation.
- DTO classes are slightly noisier than the pure class-validator
  version. We accept this because it centralises validation, typing,
  and docs in one place.
- We did NOT convert the existing response interfaces
  (`DashboardSnapshotDto`, `CommissionsReportDto`, …) to classes.
  Swagger therefore lists those endpoints without a detailed response
  schema. This is acceptable today because they're read-only, internal
  to our Nuxt client, and the shape is captured in the frontend
  `types/api.ts`. If we open the API to third parties we will convert
  them to classes and register `@ApiOkResponse({ type: ... })`.

**Revisit when**

- We add an external API tier (partner integrations): at that point
  convert all response interfaces to classes and enable spec-based
  codegen (e.g. `openapi-typescript`) in CI.
- We introduce authentication: add `DocumentBuilder.addBearerAuth(...)`
  and mark authenticated endpoints with `@ApiBearerAuth()`.
