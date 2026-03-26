# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard. Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`). Stack: **React 19**, **Vite 6**, **TypeScript** (`strict`), **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind** (PostCSS + `styles/globals.css`), **Lucide**, **react-number-format**. Tooling: **Vitest** (utils tests), **ESLint** flat config. Modals use **NeoModal** with dialog semantics, focus trap, and Escape-to-close. Supabase OAuth and email confirmation use **hash redirects** (`origin/#/dashboard`) via `authRedirectTo` in `context/AuthContext.tsx`. **Load failures:** `AppContext` sets `error` on friends/transactions query failure, preserves partial snapshots (`transactionsRef` for balances), and **Home / Friends / History** show `DataLoadErrorBanner` with Retry.

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [ ] **1.** Global search across friends, transactions, and notes (single search bar)
- [ ] **2.** Custom transaction title — separate free-text `title` field from the `type` tag
- [ ] **3.** Group expenses — split one bill across multiple friends at once

---

## Recently completed (reference)

- **Supabase load errors:** `error` + `refetch`, `DataLoadErrorBanner` on Home/Friends/History, partial data not overwritten with empty arrays when one query fails; friend balances use last good transactions when the transactions query fails.
- **Dependencies:** run `npm audit` before releases (last check: 0 vulnerabilities).
- **Code splitting:** `React.lazy` + `Suspense` in `App.tsx`; `manualChunks` in `vite.config.ts`.
- **Profile load:** `loadUserProfile` clears timeout on success; on timeout ignores late query via `Promise.resolve(queryPromise).catch`; `profileRequestIdRef` guards concurrent loads.

---

## Improvement proposals

### 1. Global search

| Field | Detail |
|--------|--------|
| **What** | No cross-screen search exists; `History.tsx` has its own local search bar but it is scoped to that screen only. Users cannot find a friend or transaction from a single entry point. |
| **Why** | As the ledger grows, scanning for a specific transaction or friend across tabs becomes tedious; a global search box makes the app feel cohesive. |
| **How** | Add a search trigger (magnifier icon) to the sticky header or `BottomNav`; open a full-screen overlay that queries `friends` and `transactions` from `AppContext` in real time, grouping results into "Friends" and "Transactions" sections; navigate to `FriendDetail` or `History` on tap. Reuse the `NeoInput` component and existing `formatters`. |
| **Logic** | Filter `friends` by `name`; filter `transactions` by `title`, `note`, `amount.toString()`, and friend name lookup — the same logic already in `History.tsx` can be extracted to a shared `searchTransactions(query, transactions, friends)` util. |
| **UI** | Full-screen modal overlay with two labelled result groups, `LoadingSpinner` while debouncing, and a "No results" empty state consistent with Neo styling. |
| **Placement** | New `components/GlobalSearch.tsx`; new `utils/search.ts` (extracted from `History.tsx`); mount in `App.tsx` or top-level layout. |
| **Conflicts** | `History.tsx` local search can delegate to the shared util after extraction — no regression if the refactor is additive. |

---

### 2. Custom transaction title

| Field | Detail |
|--------|--------|
| **What** | `AddTransaction` sets `title` equal to `type` (e.g. `title: v.selectedTag`), so every Meal is titled "Meal" and every Transport is titled "Transport". There is no way to write a descriptive name like "Taylor's birthday dinner". |
| **Why** | The `History` and `FriendDetail` screens show `title` as the primary label; generic type names make the ledger hard to scan and force users to open the note field for basic context. |
| **How** | Add an optional free-text `title` input to `AddTransaction` between the amount and the type selector; default its placeholder to the selected tag (e.g. "Meal") so it is non-breaking; persist the user-entered value to `Transaction.title`. Keep `type` as the separate categorisation field it already is. |
| **Logic** | `Transaction` type already has a `title: string` field — no schema change required. `AddTransaction` form values need a `title` field; `onSubmit` uses `v.title || v.selectedTag` as the title. Update guest storage and Supabase insert accordingly. |
| **UI** | Single `NeoInput` with placeholder matching the selected tag; appears inline in the form flow without disrupting the existing step order. |
| **Placement** | `screens/AddTransaction.tsx`, `hooks/useForm.ts` initial values, `utils/guestStorage.ts` (no structural change). |
| **Conflicts** | Existing transactions already stored with tag-as-title are unaffected — display remains the same. |

---

### 3. Group expenses (split one bill across multiple friends)

| Field | Detail |
|--------|--------|
| **What** | Every transaction is strictly one-to-one (one payer, one friend). Splitting a restaurant bill or Airbnb across three or more friends requires logging separate transactions manually. |
| **Why** | Multi-person splitting is the most common real-world use case; without it users must do the mental math themselves and enter N transactions — friction that pushes them toward Splitwise. |
| **How** | Extend `AddTransaction` with a "Split with multiple" toggle; when active, show a multi-select friend list (checkboxes over `FriendSelector`) and a split-mode picker (Equal / Custom per-person). On submit, create one `Transaction` record per selected friend with the correct per-person amount, all sharing a `groupId` UUID. Display grouped transactions in `History` under a collapsible row. |
| **Logic** | New optional `groupId: string` field on `Transaction` (nullable — does not affect existing records). New `utils/splitCalculations.ts`: `splitEqually(total, n)` and `splitCustom(total, shares[])`. `addTransaction` in `AppContext` accepts an array and inserts in batch (Supabase supports multi-row insert). Guest storage `addTransaction` loops the array. |
| **UI** | Toggle button in `AddTransaction` header; multi-select friend list with per-person amount preview; summary line "Split $90 → $30 each × 3". In `History`, grouped rows show a stacked avatar cluster and an expand chevron. |
| **Placement** | `screens/AddTransaction.tsx`, `components/AddTransaction/FriendSelector.tsx`, new `utils/splitCalculations.ts`, `context/AppContext.tsx` (`addTransaction`), `utils/guestStorage.ts`, `screens/History.tsx` (grouped row rendering). Database: add nullable `group_id uuid` column to `transactions` table. |
| **Conflicts** | `calculateFriendBalance` and settle-up remain per-friend and are unaffected — group records are just multiple normal transactions with a shared tag. Ensure `FriendDetail` correctly sums all group-member transactions for a given friend. |

---

## Signals reviewed

| Signal | Finding |
|--------|---------|
| **TODO / FIXME** | None in `*.ts` / `*.tsx`. |
| **Commented-out code** | No large dead blocks; normal JSX section comments and inline notes only. |
| **`npm audit`** | Run `npm audit` before releases; last run reported 0 vulnerabilities. |
| **Context `error`** | Set when friends/transactions queries fail; banner + Retry on Home, Friends, History. |

---

*Last updated: 2026-03-27 — checklist trimmed to open items; completed load-error UX, audit hygiene, code splitting, and profile timeout handling documented above.*
