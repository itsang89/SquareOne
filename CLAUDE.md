# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build (Vite)
npm run typecheck    # TypeScript type check (no emit)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

Tests live exclusively in `utils/**/*.test.ts`. To run a single test file:
```bash
npx vitest run utils/calculations.test.ts
```

Environment variables required (`.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture

SquareOne is a **client-side React 19 / Vite SPA** backed by **Supabase** (Auth, PostgreSQL, Realtime). It is a personal money tracker (plan: `docs/plans/2026-11-20-money-tracker.md`). There is no guest mode.

### Routing

React Router 7 uses `HashRouter`. The signed-in landing route is `/#/dashboard`. The helper `authRedirectTo(path)` in `context/AuthContext.tsx` builds OAuth and email confirmation URLs. See [the route list](docs/architecture.md#screens-and-routes).

All screen-level routes are **code-split** via `React.lazy` in `App.tsx`; Vite `manualChunks` groups vendor libraries into separate bundles.

### State Management

Four React Context providers hold all global state:

**`AuthContext`** (`context/AuthContext.tsx`)
- Holds `user: User | null` and `session`.
- Profile load uses `Promise.race` with a 5 s timeout and a `profileRequestIdRef` counter to discard stale responses from superseded requests.
- Auth redirect URLs always use the hash form via `authRedirectTo`.

**`AppContext`** (`context/AppContext.tsx`)
- Holds `friends` (with computed `balance`), `accounts`, `categories`, `entries` (each with `shares`), `subscriptions`, `loading`, `error`, `isProcessing`.
- Pages through five tables, with shares nested under entries. Six Realtime channels feed one 400 ms debounced `loadData()`.
- `loadedUserIdRef` prevents the loading skeleton on background refreshes. On partial query failure `error` is set but good snapshots are kept.
- Offline (`utils/offline.ts`, `public/sw.js`): the last good load is cached per user in `localStorage`; new entries saved offline go to an outbox with a client-made `id` (`save_entry` upserts on `id`, so replay is idempotent) and sync on reconnect / every 30 s. All other writes are blocked offline. The service worker (production only) precaches every chunk from `dist/asset-manifest.json`.
- Entry writes go through the `save_entry(p_entry, p_shares)` RPC (atomic entry + shares). CRUD methods return `{ success: boolean; error?: Error }`. Saving an entry or adding an account, category, or subscription can also return an ID.

**`SearchContext`** (`context/SearchContext.tsx`) — single `open` flag + `openSearch()`/`closeSearch()` for the global command palette (`components/GlobalSearch.tsx`).

**`ToastContext`** (`components/ToastContext.tsx`) — `useToast()` hook with `success()`/`error()`/`show()`, auto-dismissing after 5 s.

### Data Model

Tables (all `user_id` + owner-only RLS): `accounts`, `categories`, `entries`, `entry_shares`, `subscriptions`, plus `friends`. Entry kinds are `expense | income | transfer | settlement`. An expense stores the full `amount`; friends' exact shares live in `entry_shares` (they owe me); my own cost = amount − shares. A settlement with no account is an offset. DB checks enforce per-kind shape; a deferred trigger enforces `sum(shares) ≤ amount`. `currency` + `fx_rate` (to HKD) per entry.

Legacy `transactions` and `custom_types` are a read-only snapshot. See [the cutover record](docs/cutover.md).

### Balance Calculations

`utils/calculations.ts` is the single source of truth — pure functions over `Entry[]`: `friendBalancesMap`, `friendBalance`, `totalOwed`/`totalOwing`, `accountBalances`, `netWorth`, `netWorthSeries`, `myExpense`, `rangeTotals`, `totalsByCategory`, `dailySeries`, `monthlySeries`, `getLastActivity`. Positive friend balance = friend owes you. Spending totals use `(amount − shares) × fx_rate`. Day/month bucketing is local time.

### Design System

The app uses a **Neo-brutalist** design system:
- Component primitives each live in their own file (`components/NeoButton.tsx`, `components/NeoInput.tsx`, `components/NeoModal.tsx`). Import primitives directly.
- Feature components live in their own folders (`components/AddEntry/`, `components/FriendDetail/`, etc.) — keep `screens/` focused on layout/composition.
- Tailwind custom colors are under the `neo` key (`neo-yellow`, `neo-green`, `neo-red`, `neo-blue`, `neo-purple`, `neo-pink`, `neo-orange`, `neo-bg`, `neo-surface`) — defined in `tailwind.config.js`.
- Box shadows: `shadow-neo`, `shadow-neo-sm`, `shadow-neo-lg`, `shadow-neo-pressed`.
- Font: Space Grotesk.
- Dark mode uses the `class` strategy.

### Animation

Shared motion uses Framer Motion.

- Shared spring configs and variants (fade, slide, bounce, shake, stagger) in `utils/animations.ts`.
- `hooks/useAnimations.ts` wraps `useReducedMotion()` and converts all variants to instant when `prefers-reduced-motion` is set.
- `components/AnimatedNumber.tsx` / `hooks/useNumberCounter.ts` for counting number displays.

### Amount Input

The amount field in `AddEntry` accepts **arithmetic expressions** (e.g. `12+8`). `utils/calculator.ts` sanitizes expressions before evaluating them. `utils/validation.ts` calls `isCompleteNumericExpression` to reject trailing operators before submission.

### Known Inert UI

None documented.

### Deploy

Vercel deploys the frontend from `main`. Use Vercel Instant Rollback for frontend rollbacks. For production updates on hosted Supabase, apply SQL in filename order with one `psql` transaction per file and run `supabase/tests/privileges.sql` after each migration. Production has no `supabase_migrations` history table. Align history before using `supabase db push`. Deploy `agent-transactions` with the Supabase CLI. `supabase/config.toml` sets `verify_jwt = false`. GitHub Actions runs nightly encrypted backups. See [Deploy](README.md#deploy) for commands and backup settings.

## Deeper Reference

- `docs/architecture.md` — routing, state, and data flow.
- `docs/database.md` — ledger tables, RPCs, and subscription posting.

## Key Conventions

- All CRUD context methods are `async` and return `{ success: boolean; error?: Error }` — never throw from the UI layer.
- New Supabase queries must always filter by `user_id` (RLS enforces this server-side too, but do it client-side for clarity).
- Supabase Auth redirect URLs must always use `authRedirectTo(path)` — never construct them ad-hoc.
- Tests go in `utils/*.test.ts` only (Vitest is configured to include only that path).
- `@/` is aliased to the repo root (`vite.config.ts`).
- Supabase auth session storage is custom (`utils/supabase.ts`): tokens go to `localStorage` by default, or `sessionStorage` when `localStorage['squareone_remember_me'] === 'false'`. Toggling that key flips persistence without code changes.

## Behavioral Guidelines

### Think Before Coding

Before implementing, state assumptions explicitly. If multiple interpretations exist, present them rather than picking silently. If a simpler approach exists, say so. If something is unclear, name what's confusing and ask rather than guessing.

### Simplicity First

Write the minimum code that solves the problem — no features beyond what was asked, no abstractions for single-use code, no "flexibility" that wasn't requested. If a solution is 200 lines and could be 50, rewrite it.

### Surgical Changes

Touch only what the task requires. Don't improve adjacent code, comments, or formatting that wasn't part of the request. Match existing style. If a change makes a pre-existing import or variable unused, remove it; don't remove other pre-existing dead code unless asked.

### Goal-Driven Execution

Transform tasks into verifiable goals before starting. For multi-step tasks, state a brief plan with a verify step for each item. Clarifying questions should come before implementation, not after mistakes.
