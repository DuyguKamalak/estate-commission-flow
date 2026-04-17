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

Copy `.env.example` to `.env` and set `NUXT_PUBLIC_API_BASE_URL` to point
at the running backend (default `http://localhost:3001/api`).

## Project shape

```
frontend/
├── app.vue
├── layouts/
│   └── default.vue      # sidebar + header shell
├── pages/
│   └── index.vue        # dashboard (scaffold)
├── stores/              # Pinia stores
├── composables/         # useApiFetch, useCurrency, …
├── assets/css/main.css  # Tailwind v4 + Stitch design tokens
└── nuxt.config.ts
```

## Design tokens

All colours, radii, shadows and typography tokens are declared in
`assets/css/main.css` inside `@theme { … }`, so any Tailwind utility
(`bg-primary`, `text-on-surface-variant`, `rounded-md`, etc.) consumes
them directly. Edit that file — not a `tailwind.config.*` — to tune the
design system.
