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

- Tracks every transaction through a strict, validated lifecycle.
- Produces a deterministic financial breakdown for every completed transaction.
- Persists an immutable snapshot of each breakdown for long-term traceability.
- Provides a premium, operations-focused dashboard to manage and visualise everything.

---

## Tech Stack

### Backend
- **Runtime:** Node.js (LTS)
- **Language:** TypeScript
- **Framework:** NestJS
- **Database:** MongoDB Atlas
- **ODM:** Mongoose
- **Validation:** class-validator, class-transformer
- **Testing:** Jest

### Frontend
- **Framework:** Nuxt 3
- **State management:** Pinia
- **Styling:** Tailwind CSS
- **Design system:** "The Architectural Ledger" (Manrope + Inter, navy/white editorial)

### Infrastructure
- **Backend host:** Render
- **Frontend host:** Vercel
- **Database:** MongoDB Atlas

---

## Repository layout

```
estate-commission-flow/
├── backend/           NestJS API
├── frontend/          Nuxt 3 application
├── docs/              Architecture notes, ADRs, diagrams
│   └── decisions/     Architecture Decision Records
├── .gitignore
├── README.md          (this file)
└── DESIGN.md          Architecture & design rationale
```

---

## Getting started

> Detailed setup instructions will be filled in as each part of the system is implemented.

### Prerequisites
- Node.js LTS (v20+)
- npm (v10+)
- A MongoDB Atlas cluster & connection string

### 1. Clone

```bash
git clone <repo-url>
cd estate-commission-flow
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # fill in MONGODB_URI, PORT, etc.
npm run start:dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # fill in NUXT_PUBLIC_API_BASE_URL
npm run dev
```

---

## Environment variables

### Backend (`backend/.env`)
| Key             | Description                         |
|-----------------|-------------------------------------|
| `PORT`          | API port (default `3001`)           |
| `MONGODB_URI`   | MongoDB Atlas connection string     |
| `NODE_ENV`      | `development` / `production`        |
| `FRONTEND_URL`  | Allowed CORS origin                 |

### Frontend (`frontend/.env`)
| Key                        | Description                    |
|----------------------------|--------------------------------|
| `NUXT_PUBLIC_API_BASE_URL` | Base URL of the backend API    |

---

## Testing

```bash
# Backend unit tests
cd backend
npm run test
npm run test:cov
```

Commission rules and stage transition rules are covered by dedicated unit tests.

---

## Deployment

| Layer     | Platform       | URL                 |
|-----------|----------------|---------------------|
| Backend   | Render         | _(to be filled)_    |
| Frontend  | Vercel         | _(to be filled)_    |
| Database  | MongoDB Atlas  | _(cluster)_         |

---

## Documentation

- [`DESIGN.md`](./DESIGN.md) — architecture, domain model, business rules, trade-offs.
- [`docs/decisions/`](./docs/decisions/) — individual Architecture Decision Records.

---

## License

Private — internal technical case submission.
