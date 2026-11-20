# SquareOne

SquareOne is Isaac's personal money tracker. It replaced the Money+ iOS app.
It is a single-user app and requires sign-in.

## Features

- Record expenses, income, transfers, loans to friends, and repayments. Split expenses equally or by exact amount.
- Track accounts in their own currencies and view spending and net worth in HKD.
- Manage categories and subscriptions. Due subscriptions post automatically.
- Browse entries by week, filter the ledger, and search entries and friends.
- Import Money+ CSV files, export entries as CSV, and connect an agent through the CLI.

## Stack

React 19, TypeScript, Vite, React Router, Tailwind CSS built via `tailwind.config.js`, and Recharts. Supabase provides Auth, PostgreSQL, Realtime, pg_cron, and the `agent-transactions` Edge Function.

## Local development

Install dependencies with `npm ci`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

- `npm run dev` starts Vite at http://localhost:3000.
- `npm run typecheck`, `npm run lint`, and `npm test` check the project.
- `npm run build` builds the frontend. `npm run preview` serves the build locally.

For an isolated local demo, run `bash supabase/demo/start.sh` and use the printed Vite command. It overrides both Supabase variables. See [Agent access](docs/agent.md#isolated-local-demo).

## Deploy

- Vercel auto-deploys the frontend from `main`. A push to `main` deploys to production. Use Vercel Instant Rollback to roll back the frontend.
- For production updates on hosted Supabase, apply migrations in filename order, one file per transaction, using `psql "$DB_URL" -X -v ON_ERROR_STOP=1 -1 -f FILE`. After each migration, run [the privilege checks](supabase/tests/privileges.sql). Production has no `supabase_migrations` history table. Align migration history before using `supabase db push`.
- Deploy the Edge Function with `supabase functions deploy agent-transactions --project-ref <ref>`. [supabase/config.toml](supabase/config.toml) sets `verify_jwt = false`.
- [The backup workflow](.github/workflows/backup.yml) runs nightly and encrypts the dump. Its `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets are configured. The passphrase is in Isaac's password manager.

## Docs

- [Architecture](docs/architecture.md) covers screens, state, and data flow.
- [Database](docs/database.md) covers tables, RPCs, privileges, and scheduled posting.
- [Agent access](docs/agent.md) covers CLI setup, permissions, and the local demo.
- [Backups](docs/backups.md) covers backups, restore, import, and subscriptions.
- [Cutover](docs/cutover.md) records the legacy ledger migration.
- [Money tracker spec](docs/plans/2026-11-20-money-tracker.md) records the redesign plan.
- [Agent connection eval](docs/evals/2026-11-20-agent-connections.md) records the connection evaluation.
