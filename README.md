# Rep AI

Minimal notes for running the app.

## Install
```bash
npm install
```

## Environments
- `.env` (production) → copy from `env.example`
- `.env.test` (test/Supabase project `fmwakvonzplhypklnsak`)

## Run
```bash
npm start         # production Supabase
npm run start:test -- --clear   # test Supabase
```

## Migrations
- Production: apply `supabase/migrations/*.sql` in timestamp order
- Test: apply `supabase/migrations/migrations-test/20251112T0001_*` → `20251112T0011_*`

## Reset starter app
```bash
npm run reset-project
```
