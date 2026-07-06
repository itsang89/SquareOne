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

SquareOne is a **client-side React 19 / Vite SPA** backed by **Supabase** (Auth, PostgreSQL, Realtime). Guest users bypass Supabase entirely.

### Routing

Uses **React Router 7 `HashRouter`** — all routes are `/#/path` (e.g. `/#/dashboard`). This is a hard constraint for Supabase Auth: all OAuth and email confirmation `redirectTo` values must include the hash (`window.location.origin + '/#/dashboard'`). The helper `authRedirectTo(path)` in `context/AuthContext.tsx` handles this.

All screen-level routes are **code-split** via `React.lazy` in `App.tsx`; Vite `manualChunks` groups vendor libraries into separate bundles.

### State Management

Four React Context providers hold all global state:

**`AuthContext`** (`context/AuthContext.tsx`)
- Holds `user: User | null` and `session`.
- `user.id === 'guest'` is the sentinel for guest mode — no Supabase calls anywhere.
- Profile load uses `Promise.race` with a 5 s timeout and a `profileRequestIdRef` counter to discard stale responses from superseded requests.
- `migrateGuestData(uid)` runs before clearing guest data — see Guest Mode below.
- Auth redirect URLs always use the hash form via `authRedirectTo`.

**`AppContext`** (`context/AppContext.tsx`)
- Holds `friends`, `transactions`, `customTypes`, `loading`, `error`, `isProcessing`.
- On mount, branches on `user.id === 'guest'`: guest reads/writes `localStorage` via `utils/guestStorage.ts`; authenticated reads/writes Supabase.
- For authenticated sessions, subscribes to three Supabase Realtime channels (`friends-changes`, `transactions-changes`, `custom-types-changes`). All three feed a single 400 ms debounced refresh (`scheduleRealtimeRefresh`) that calls `loadData()`.
- `loadedUserIdRef` prevents showing the loading skeleton on background refreshes after first load.
- On partial query failure, `error` is set but the successful snapshot is preserved (never overwritten with `[]`). `transactionsRef` keeps the last good transactions for balance calculations when only the transactions query fails.
- All CRUD methods return `{ success: boolean; error?: Error }`.

**`SearchContext`** (`context/SearchContext.tsx`) — single `open` flag + `openSearch()`/`closeSearch()` for the global command palette (`components/GlobalSearch.tsx`).

**`ToastContext`** (`context/ToastContext.tsx`) — `useToast()` hook with `success()`/`error()`/`show()`, auto-dismissing after 5 s.

### Data / DB Field Mapping

The frontend `Transaction` type uses camelCase (`payerId`, `friendId`, `isSettlement`), but the Supabase columns are snake_case (`payer_id`, `friend_id`, `is_settlement`). The mapping happens in `loadData()` inside `AppContext`. The `payer_id` column stores the user's UUID or a friend's UUID — never the string `'me'`; that sentinel is re-introduced on read.

### Guest Mode

- Sentinel: `user.id === 'guest'` (set by `signInAsGuest()` in `AuthContext`).
- Persisted to `localStorage` under key `squareone_guest_data` as `{ friends: GuestPersistedFriend[], transactions: Transaction[] }`.
- `utils/guestStorage.ts` owns all read/write helpers.
- Custom types for guests use a separate key (`squareone_custom_types`) via `utils/customTypesStorage.ts`.
- **Guest → account migration**: `migrateGuestData(uid)` in `AuthContext` runs on every successful sign-in/sign-up and on `onAuthStateChange`. It upserts friends and transactions to Supabase under the new `user.id` (using `ignoreDuplicates`), then calls `clearGuestLocalData()`. Wrapped in try/catch — a migration failure logs a warning and leaves local data in place for retry; login is never blocked.

### Balance Calculations

Friend balances are computed **entirely on the client** from raw transaction history — there are no balance columns in the DB. `utils/calculations.ts` is the single source of truth:
- `calculateFriendBalancesMap(transactions)` — one pass over all transactions, returns a `Map<friendId, balance>`.
- `calculateFriendBalance(friendId, transactions)` — single-friend convenience.
- `calculateTotalOwed` / `calculateTotalOwing` / `calculateNetBalance` — aggregate across all friends.
- `getLastActivity(friendId, transactions)` — human-readable "Today / Yesterday / N days ago / N weeks ago".
- `calculateMonthlyTotals(transactions, months = 6)` — last-N-months series for the home dashboard chart.
- `shouldGrayTransaction(tx, friendId, transactions)` — used by `History` to dim rows that have been settled since.
- Positive balance = friend owes you; negative = you owe them.
- Settlement transactions (`isSettlement: true`) reverse the balance direction.

### Design System

The app uses a **Neo-brutalist** design system:
- Component primitives each live in their own file (`components/NeoButton.tsx`, `components/NeoInput.tsx`, `components/NeoModal.tsx`); `components/NeoComponents.tsx` re-exports `NeoButton` and adds `NeoCard`, `BackButton`, plus a few composed wrappers — import the specific file when possible.
- Feature components live in their own folders (`components/AddTransaction/`, `components/FriendDetail/`, etc.) — keep `screens/` focused on layout/composition.
- Tailwind custom colors are under the `neo` key (`neo-yellow`, `neo-green`, `neo-red`, `neo-blue`, `neo-purple`, `neo-pink`, `neo-orange`, `neo-bg`, `neo-surface`) — defined in `tailwind.config.js`.
- Box shadows: `shadow-neo`, `shadow-neo-sm`, `shadow-neo-lg`, `shadow-neo-pressed`.
- Font: Space Grotesk.
- Dark mode uses the `class` strategy.

### Animation

All motion via **Framer Motion**:
- Shared spring configs and variants (fade, slide, bounce, shake, stagger) in `utils/animations.ts`.
- `hooks/useAnimations.ts` wraps `useReducedMotion()` and converts all variants to instant when `prefers-reduced-motion` is set.
- Only GPU-accelerated properties (`transform`, `opacity`) are animated.
- `components/AnimatedNumber.tsx` / `hooks/useNumberCounter.ts` for counting number displays.
- `utils/confetti.ts` for settlement success celebrations.

### Amount Input

The amount field in `AddTransaction` accepts **arithmetic expressions** (e.g. `12+8`). `utils/calculator.ts` evaluates them safely (whitelist sanitization, no `eval`). `utils/validation.ts` calls `isCompleteNumericExpression` to reject trailing operators before submission.

### Known Inert UI

Two buttons exist with no handlers (see `improvement.md` items #5 and #9):
- Nudge button on `FriendDetail` (around `screens/FriendDetail.tsx:170`) — `onClick={() => {}}`.
- Camera button on `AddTransaction` (around `screens/AddTransaction.tsx:287`) — no `onClick` prop.

(The earlier Bell icon on `Home` and its `unsettledCount` miscount have since been removed.)

## Deeper Reference

- `docs/architecture.md` — system diagrams, routing, state management, animation layer.
- `docs/database.md` — full Postgres schema, RLS policies, real-time setup.

## Key Conventions

- All CRUD context methods are `async` and return `{ success: boolean; error?: Error }` — never throw from the UI layer.
- New Supabase queries must always filter by `user_id` (RLS enforces this server-side too, but do it client-side for clarity).
- Supabase Auth redirect URLs must always use `authRedirectTo(path)` — never construct them ad-hoc.
- `TransactionType` is `string` (open union) — built-in labels live in `constants.ts`; user-defined ones come from `customTypes` in `AppContext`.
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
