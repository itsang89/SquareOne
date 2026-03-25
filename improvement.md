# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard. Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`). Stack: **React 19**, **Vite 6**, **TypeScript**, **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind via CDN** in `index.html`, **Lucide**, **react-number-format**.

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [ ] **1.** Auth redirect URLs must work with **HashRouter** (OAuth **and** email confirmation `emailRedirectTo`)
- [ ] **2.** Supabase friends/transactions **query errors** must not look like an empty ledger (surface retry / message)
- [ ] **3.** Address `npm audit` (react-router-dom / rollup, etc.) with tested upgrades
- [ ] **4.** Code-split heavy routes (e.g. Recharts `Home`, modals-heavy screens) to shrink initial JS
- [ ] **5.** Harden `loadUserProfile` after `Promise.race` timeout (ignore stale results / abort if supported)
- [ ] **6.** Relax `index.html` viewport (`user-scalable` / `maximum-scale`) for accessibility
- [ ] **7.** Refresh **llms.txt** guest description (localStorage, not “fallback only”)
- [ ] **8.** (Optional) Replace Tailwind CDN with PostCSS build for production parity
- [ ] **9.** (Optional) Enable TypeScript `strict` incrementally
- [ ] **10.** **NeoModal** accessibility: `role="dialog"`, focus trap, Escape, labelled close
- [ ] **11.** **Vitest** (or similar) unit tests for `calculator`, `validation`, `calculations`
- [ ] **12.** (Optional) **ESLint** flat config for React/TS/hooks (enable incrementally)
- [ ] **13.** Global search across friends, transactions, and notes (single search bar)
- [ ] **14.** Custom transaction title — separate free-text `title` field from the `type` tag
- [ ] **15.** Group expenses — split one bill across multiple friends at once

---

## Improvement proposals

### 1. HashRouter vs Supabase auth redirects

| Field | Detail |
|--------|--------|
| **What** | `signUp` uses `emailRedirectTo: \`${window.location.origin}/dashboard\``; Google/Apple use `redirectTo` the same. The SPA routes live under `/#/...`. Depending on hosting and Supabase Site URL config, return paths can miss the hash route. |
| **Why** | OAuth and email-confirm users must land in the authenticated app; broken redirects block access and inflate support cost. |
| **How** | Use hashes in allowed redirect URLs, e.g. `window.location.origin + '/#/dashboard'`, and register matching URLs in the Supabase dashboard. Alternatively migrate to `BrowserRouter` with static hosting fallback to `index.html`. |
| **Logic** | Supabase Auth `redirectTo` / `emailRedirectTo` + project URL allowlist. |
| **UI** | Successful landing on dashboard (no new components). |
| **Placement** | `context/AuthContext.tsx` (`signUp`, `signInWithGoogle`, `signInWithApple`). |
| **Conflicts** | Dev (`localhost:3000`) vs production origins—document both in README. |

---

### 2. Silent failure when friends or transactions queries error

| Field | Detail |
|--------|--------|
| **What** | In `loadData`, `friendsError` / `transactionsError` are only `console.warn`’d; the UI shows **empty** friends/transactions, which reads like “no activity” rather than “couldn’t load.” |
| **Why** | Wrong empty state undermines trust for balances and settle-up; users may misconfigure RLS or schema without feedback. |
| **How** | If either query returns an error, set `error` (or a dedicated `loadWarning`) in context, show a **Neo** banner or full-page retry on `Home` / `Friends` / `History` with `refetch`, and avoid overwriting good partial data if one of two queries succeeds (optional follow-up). |
| **Logic** | `AppContext` `loadData`; existing `error` + `refetch` already exposed; `Home` currently `throw error` for some paths—align so recoverable load errors use inline retry instead of only ErrorBoundary. |
| **UI** | Banner with `NeoButton` “Retry” + short copy; optional toast on transient recovery. |
| **Placement** | `context/AppContext.tsx`, `screens/Home.tsx`, possibly `Friends.tsx` / `History.tsx` if they should not depend only on dashboard. |
| **Conflicts** | Today “table may not exist” is swallowed—decide whether dev-only messaging vs user-safe generic error. |

---

### 3. Dependency security upgrades

| Field | Detail |
|--------|--------|
| **What** | `npm audit` reports issues (e.g. `react-router` / `react-router-dom`, `rollup` via Vite). |
| **Why** | Reduces known vulnerability exposure; advisories include CSRF/XSS classes (severity varies for static Hash SPA, but upgrades remain prudent). |
| **How** | `npm audit fix` or targeted minor bumps; run `npm run build`, `npm run typecheck`, smoke-test auth, navigation, settle-up. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `package.json` / lockfile. |
| **Conflicts** | Major bumps may need router API adjustments—prefer patched minors first. |

---

### 4. Route-level code splitting

| Field | Detail |
|--------|--------|
| **What** | `App.tsx` eagerly imports all screens; production chunk stays large (Recharts on `Home`, Framer on multiple views). |
| **Why** | Faster first paint on mobile matches on-the-go expense use. |
| **How** | `React.lazy` for `Home`, `History`, `FriendDetail`, `SettleUp`, `AddTransaction`, `Profile`; wrap routes in `Suspense` with `LoadingSpinner` / skeletons; optional `manualChunks` in `vite.config.ts`. |
| **Logic** | None if split is import-only. |
| **UI** | Loading fallbacks consistent with existing neo styling. |
| **Placement** | `App.tsx`; optionally `vite.config.ts`. |
| **Conflicts** | Ensure `ErrorBoundary` still wraps lazy trees as intended. |

---

### 5. Profile load: timeout and stale completion

| Field | Detail |
|--------|--------|
| **What** | `loadUserProfile` races the Supabase query against a timeout; the query is not cancelled and may resolve after fallback is applied. |
| **Why** | Prevents rare state flicker or duplicate work if the flow grows (e.g. writes keyed off profile). |
| **How** | Pass `AbortSignal` if the Supabase client version supports it, or use a monotonically increasing request id / `mounted` guard and ignore late responses. |
| **Logic** | `context/AuthContext.tsx` profile fetch only. |
| **UI** | None (fallback profile already exists). |
| **Placement** | `context/AuthContext.tsx`. |
| **Conflicts** | Verify `@supabase/supabase-js` API for abort/cancel. |

---

### 6. Viewport accessibility

| Field | Detail |
|--------|--------|
| **What** | `index.html` sets `maximum-scale=1` and `user-scalable=0`. |
| **Why** | Zoom restrictions hurt low-vision users and common a11y expectations. |
| **How** | Use a standard viewport allowing user scaling; verify no layout breaks on small screens. |
| **Logic** | N/A |
| **UI** | Browser zoom behavior only. |
| **Placement** | `index.html`. |
| **Conflicts** | Possible pinch-zoom on fixed layouts—spot-check `Home` / modals. |

---

### 7. llms.txt accuracy (guest mode)

| Field | Detail |
|--------|--------|
| **What** | `llms.txt` still frames guest mode as a loose “fallback” rather than **localStorage-backed** CRUD aligned with `guestStorage` / `AppContext`. |
| **Why** | AI and contributor context should match runtime behavior to avoid wrong edits (e.g. reintroducing Supabase writes for guests). |
| **How** | One short paragraph: guest = no session, data in `squareone_guest_data`, cleared when a real session attaches (`clearGuestLocalData`). |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `llms.txt`. |
| **Conflicts** | None. |

---

### 8. (Optional) Tailwind production pipeline

| Field | Detail |
|--------|--------|
| **What** | Tailwind loads from CDN in `index.html`. |
| **Why** | Build step gives tree-shaking, pinned versions, and predictable offline builds. |
| **How** | Add `tailwindcss` + PostCSS, extract theme extensions from the inline script into `tailwind.config`, remove CDN script after parity check. |
| **Logic** | N/A |
| **UI** | Must preserve neo palette, shadows, `darkMode: 'class'`. |
| **Placement** | `index.html`, new config files, `package.json`. |
| **Conflicts** | Full visual regression pass required. |

---

### 9. (Optional) Stricter TypeScript

| Field | Detail |
|--------|--------|
| **What** | `strict` is not enabled in `tsconfig.json`. |
| **Why** | Stronger guarantees for money-related types over time. |
| **How** | After keeping `tsc` green, enable `strict` or individual flags and fix surfaced errors file by file. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `tsconfig.json`, then call sites across `context/`, `utils/`, `screens/`. |
| **Conflicts** | Can be large—schedule deliberately. |

---

### 10. NeoModal accessibility

| Field | Detail |
|--------|--------|
| **What** | `NeoModal` uses a fixed overlay but no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or Escape-to-close. |
| **Why** | Modals are used for money-adjacent confirmations and forms; keyboard and screen-reader users need predictable behavior. |
| **How** | Add dialog semantics; trap focus while open and restore on close; listen for `Escape`; ensure close button has accessible name. Prefer a small headless primitive or `react-focus-lock` if you want to avoid hand-rolling. |
| **Logic** | N/A |
| **UI** | `components/NeoModal.tsx` and consumers (`EditFriendModal`, `HowToUseModal`, etc.). |
| **Placement** | `components/NeoModal.tsx`; verify all modal call sites. |
| **Conflicts** | Nested modals (if any)—define stacking or disallow nesting. |

---

### 11. Unit tests for money math

| Field | Detail |
|--------|--------|
| **What** | No test runner in `package.json`; `calculator`, `validation`, and `calculations` are critical and already refined once for expression completeness. |
| **Why** | Prevents regressions in balances, settle-up caps, and amount parsing. |
| **How** | Add **Vitest** + small suites: `isValidAmount` / `evaluateExpression` / `isCompleteNumericExpression`; `calculateFriendBalance`, `calculateNetBalance`, settlement edge cases. Run in CI via `npm test`. |
| **Logic** | Pure functions in `utils/` — easy to test. |
| **UI** | N/A |
| **Placement** | `package.json`, `vitest.config.ts`, `utils/*.test.ts`. |
| **Conflicts** | None; keep tests fast and deterministic. |

---

### 12. (Optional) ESLint

| Field | Detail |
|--------|--------|
| **What** | No ESLint script; only `typecheck` gates types. |
| **Why** | Catches hooks dependency mistakes and inconsistent patterns in growing UI code. |
| **How** | Flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`; start with warn-only or limited paths. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | New `eslint.config.js`, `package.json` scripts. |
| **Conflicts** | Initial noise—enable incrementally. |

---

### 13. Global search

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

### 14. Custom transaction title

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

### 15. Group expenses (split one bill across multiple friends)

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
| **`npm audit`** | Run `npm audit` before releases; fixes available at time of last check (router/rollup). |
| **Context `error`** | Set on thrown load failures; partial Supabase errors still silent (see proposal **2**). |

---

*Last updated: 2026-03-25 — pruned completed checklist items (friend/settle route guards, guest local-only mode, amount validation, `typecheck` / `vite-env.d.ts`, `public/index.css` link, slim `vite.config`); checklist and proposals renumbered 1–15.*
