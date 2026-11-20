# Architecture

SquareOne is a React SPA. The browser uses Supabase Auth and reads and writes owner-scoped data in PostgreSQL. The CLI uses the `agent-transactions` Edge Function. See [Database](database.md) for RPCs and [Agent access](agent.md) for CLI setup.

## Screens and routes

`App.tsx` lazy-loads screens with React Router's `HashRouter`. The paths below follow `/#` in the URL.

| Path | Screen |
| --- | --- |
| `/`, `/login` | Login. Signed-in users go to `/dashboard`. |
| `/connect-agent` | Browser approval for agent connections and protected actions. |
| `/dashboard` | Month summary and weekly entry browser. |
| `/ledger`, `/charts`, `/wallet` | Filtered entry history, charts, and accounts. |
| `/add`, `/entry/:id` | Add or edit an entry. |
| `/friends`, `/friends/:id` | Friend balances and history. |
| `/profile`, `/profile/import`, `/profile/agent-access` | Profile and data controls, Money+ import, and agent access. |
| `/settings/categories`, `/settings/subscriptions` | Category and subscription management. |

The app protects ledger and settings routes with a session check. `authRedirectTo` builds hash URLs for OAuth and email confirmation, including the return to agent approval when needed.

## State and data flow

- `AuthContext` manages the Supabase session and profile. Sign-in supports email/password, Google, and Apple.
- `AppContext` pages through friends, accounts, categories, entries with nested shares, and subscriptions. After a successful write it reloads data. On a partial read failure it keeps existing data for the failed query and exposes an error.
- Each of the six live tables has a `<table>-changes` Realtime channel filtered by `user_id`. All six feed the same 400 ms debounced reload. Channels are removed on session change or unmount.
- `utils/calculations.ts` computes balances and reports from entries. `utils/entryUi.ts` builds display data for entry rows and search results.
- `SearchContext` controls global search. `components/ToastContext.tsx` provides feedback for actions.

The shared UI uses Tailwind and Framer Motion. `hooks/useAnimations.ts` adjusts shared transitions for reduced motion.
