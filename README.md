# Fwitter

A mobile-first social app for football discussion — a "Football Twitter".

This is a monorepo with two packages:

- [`api/`](./api) — NestJS + Prisma + PostgreSQL backend, with AWS Cognito auth.
- [`mobile/`](./mobile) — Expo (React Native) mobile app.

See [`dev.md`](./dev.md) for the product/build spec, [`api_routes.md`](./api_routes.md) for the API surface, [`DB_schema.md`](./DB_schema.md) for the data model, and [`FOLLOWUPS.md`](./FOLLOWUPS.md) for known follow-up work.

## Getting started

### API
```
cd api
npm install
cp .env.example .env   # fill in your DATABASE_URL and Cognito settings
npx prisma generate
npm run start:dev
```

### Mobile
```
cd mobile
npm install
cp .env.example .env    # point EXPO_PUBLIC_API_URL at your running API
npx expo start
```

Neither package's real `.env` file is committed — see each package's `.env.example` (to be added) for the variables it needs.
