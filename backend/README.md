# Estate Commission Flow — Backend

NestJS 11 + MongoDB Atlas + Mongoose API for the Estate Commission Flow system.

## Scripts

```bash
npm run start:dev     # watch mode
npm run start         # plain start
npm run build         # compile to dist/
npm run start:prod    # run compiled output
npm run test          # jest
npm run test:cov      # jest with coverage
npm run lint          # eslint --fix
npm run format        # prettier
```

## Environment

Copy `.env.example` to `.env` and fill in values. `MONGODB_URI` is optional
in Sprint 2 (the app boots without it) and becomes required from Sprint 3
onwards.

## Health endpoint

After `npm run start:dev`:

```
GET http://localhost:3001/api/health
```

Returns a small JSON payload used by deployment liveness checks.
