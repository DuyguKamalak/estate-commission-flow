# Estate Commission Flow — Frontend

Nuxt 3 + Pinia + Tailwind CSS v4. Implements the "Architectural Ledger"
design system exported from Stitch.

## Scripts

```bash
npm run dev         # dev server on http://localhost:3000
npm run build       # production build
npm run preview     # serve the production build locally
npm run typecheck   # vue-tsc project-wide check
npm run lint        # eslint --fix
```

## Environment

Copy `.env.example` to `.env` and set:

| Key                        | Required | Description                                                    |
|----------------------------|----------|----------------------------------------------------------------|
| `NUXT_PUBLIC_API_BASE_URL` | **yes**  | Base URL of the backend API (default `http://localhost:3001/api`) |

## Project shape

```
frontend/
├── app.vue
├── layouts/
│   └── default.vue          sidebar + header shell
├── pages/
│   ├── index.vue            dashboard (KPIs + live snapshot)
│   ├── transactions/
│   │   ├── index.vue        filterable list
│   │   ├── new.vue          creation form (live commission preview)
│   │   └── [id].vue         details + stage timeline + advance modal
│   ├── agents/index.vue     directory + create + deactivate
│   ├── reports.vue          commissions report + CSV download
│   └── settings.vue         runtime info
├── stores/                  Pinia (dashboard, transactions, agents)
├── composables/             useApiClient, useApiFetch, useCommissionPreview, useToast, useCurrency
├── components/              StageBadge, PageHeader, MoneyCell, EmptyState,
│                            PaginationBar, DataStateBoundary, StageTimeline,
│                            CommissionBreakdownCard, ModalShell, FormField, ToastStack
├── types/api.ts             Shared API contract types
├── assets/css/main.css      Tailwind v4 + Stitch design tokens (@theme)
└── nuxt.config.ts
```

## Design tokens

All colours, radii, shadows and typography tokens are declared in
`assets/css/main.css` inside `@theme { … }`, so any Tailwind utility
(`bg-primary`, `text-on-surface-variant`, `rounded-md`, etc.) consumes
them directly. Edit that file — not a `tailwind.config.*` — to tune the
design system.

## Money handling

Monetary values are carried over the wire as integer **minor units**
(e.g. pence for GBP). The `useCurrency` composable is the single place
that converts them to display strings, and `useCommissionPreview`
mirrors the backend calculator so the transaction creation form can
show a live, trustworthy preview without a round-trip.
