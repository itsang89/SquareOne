# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard. Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`). Stack: **React 19**, **Vite 6**, **TypeScript** (`strict`), **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind** (PostCSS + `styles/globals.css`), **Lucide**, **react-number-format**. Tooling: **Vitest** (utils tests), **ESLint** flat config. Modals use **NeoModal** with dialog semantics, focus trap, and Escape-to-close. Supabase OAuth and email confirmation use **hash redirects** (`origin/#/dashboard`) via `authRedirectTo` in `context/AuthContext.tsx`. **Load failures:** `AppContext` sets `error` on friends/transactions query failure, preserves partial snapshots (`transactionsRef` for balances), and **Home / Friends / History** show `DataLoadErrorBanner` with Retry.

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [ ] **1.** Group expenses — split one bill across multiple friends at once
- [ ] **2.** Guest-to-account data migration — migrate localStorage data to Supabase on sign-up
- [ ] **3.** Profile state sync — name/avatar update in Settings doesn't refresh the in-app header
- [ ] **4.** Spending trend chart — add a monthly bar/line chart to the dashboard using existing Recharts
- [ ] **5.** Nudge button — share/copy a payment-request message from `FriendDetail`
- [ ] **6.** History: date-range filter and custom-type chips — extend current Poker/Meals/Loans filters
- [ ] **7.** FriendDetail: per-friend transaction search/filter — no filtering on a single friend's ledger
- [ ] **8.** Bell notification panel — notification bell in the header has no click handler
- [ ] **9.** Friend aggregate stats — totals (# transactions, cumulative spent) on `FriendDetail`
- [ ] **10.** Receipt photo upload — Camera button in `AddTransaction` has no handler
- [ ] **11.** Currency/locale preference — `formatCurrency` is hard-coded to USD
- [ ] **12.** Settle-up smart presets — quick-amount chips are hard-coded to `$100 / $500`

---

## Recently completed (reference)

- **Global search:** `components/GlobalSearch.tsx` + `utils/search.ts`; full-screen overlay searches friends and transactions from `AppContext`; `searchTransactions` util extracted from `History.tsx`; mounted in top-level layout.
- **Custom transaction title:** Free-text `customTitle` field in `AddTransaction`; defaults to selected tag; persisted to `Transaction.title` via `v.customTitle.trim() || v.selectedTag`; no schema change required.
- **Supabase load errors:** `error` + `refetch`, `DataLoadErrorBanner` on Home/Friends/History, partial data not overwritten with empty arrays when one query fails; friend balances use last good transactions when the transactions query fails.
- **Dependencies:** run `npm audit` before releases (last check: 0 vulnerabilities).
- **Code splitting:** `React.lazy` + `Suspense` in `App.tsx`; `manualChunks` in `vite.config.ts`.
- **Profile load:** `loadUserProfile` clears timeout on success; on timeout ignores late query via `Promise.resolve(queryPromise).catch`; `profileRequestIdRef` guards concurrent loads.

---

## Improvement proposals

### 1. Group expenses (split one bill across multiple friends)

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

### 2. Guest-to-account data migration

| Field | Detail |
|--------|--------|
| **What** | When a guest session converts to a real account (via sign-up or sign-in), `clearGuestLocalData()` is called in `AuthContext` (lines 107, 143, 176) and all local friends/transactions are permanently discarded — the user sees an empty app after registering. |
| **Why** | Guests who have built up a ledger will lose all their data the moment they try to create a real account; this is the single biggest drop-off risk in the guest → registered conversion funnel. |
| **How** | After successful auth but before `clearGuestLocalData()`, read the guest snapshot; if it is non-empty, batch-insert friends and transactions into Supabase under the new `user.id`; call `clearGuestLocalData()` only on success. Wrap in a try/catch so a migration failure doesn't block login. |
| **Logic** | `readGuestSnapshot()` returns `{ friends: GuestPersistedFriend[], transactions: Transaction[] }`. Insert friends with `supabase.from('friends').insert(friends.map(f => ({ ...f, user_id: uid })))`. Then insert transactions mapping `payerId`/`friendId` back to DB columns (mirror the logic already in `addTransaction`). Run both inserts inside `Promise.all` for speed. |
| **UI** | Add a `LoadingSpinner` overlay during migration with text "Importing your data…". On success, toast "Your guest data has been saved." On failure, toast a warning but don't block login — data remains in localStorage for a manual retry. |
| **Placement** | `context/AuthContext.tsx` — extract a `migrateGuestData(uid)` async function called in `signUp`, `signInWithPassword`, and `signInWithGoogle`/`signInWithApple` success branches before the `clearGuestLocalData()` call. |
| **Conflicts** | `clearGuestLocalData()` calls in `AuthContext.tsx` must be deferred to after migration. Ensure duplicate `friend_id` inserts are handled (Supabase upsert or `onConflict: 'ignore'`). |

---

### 3. Profile state sync after update

| Field | Detail |
|--------|--------|
| **What** | After a user edits their name or avatar in `Profile.tsx` (`handleUpdateProfile`), the Supabase `profiles` table is updated but `AuthContext.user` is never refreshed. The header on `Home` ("Hello, {user.name}") continues to display the old name until sign-out/sign-in. The source comment reads: *"Wait for AuthContext to pick up changes or we could force refresh user profile if needed."* |
| **Why** | Editing your name and seeing no change is immediately noticeable and erodes trust in the app's data reliability. |
| **How** | Expose a `refreshUser()` method from `AuthContext` that re-runs `loadUserProfile(supabaseUser)` and updates `user` state. Call it from `Profile.handleUpdateProfile` on success. |
| **Logic** | `refreshUser` wraps the existing `loadUserProfile` logic: fetch from `profiles`, map to `User`, call `setUser(mapped)`. This is a read-only call with no side effects. |
| **UI** | No UI change required — the header and profile card will reactively update once `user` state changes. |
| **Placement** | `context/AuthContext.tsx` (`AuthContextType` interface + provider body), `screens/Profile.tsx` (`handleUpdateProfile` success branch). |
| **Conflicts** | No regressions — `refreshUser` is an additive method on the context. The profile `isUpdating` guard already prevents double-submits. |

---

### 4. Spending trend chart on the dashboard

| Field | Detail |
|--------|--------|
| **What** | The `Home` dashboard shows a "Debt Origins" pie chart (by transaction type) but has no time-based view. Users have no way to see whether they are spending more or less than previous months. |
| **Why** | Spending trends are the core value-add of a financial tracker; the app already imports Recharts and renders one chart — adding a second costs almost nothing in bundle size. |
| **How** | Below "Debt Origins", add a "Monthly Spending" `BarChart` (or `AreaChart`) section. Compute data client-side from `transactions`: group by `YYYY-MM`, sum amounts for the last 6 months, produce an array `[{ month: 'Oct', total: 240 }, …]`. Render via `<BarChart>` with `<Bar>` and `<XAxis>`/`<YAxis>` from the already-imported Recharts package. |
| **Logic** | New util `calculateMonthlyTotals(transactions, months = 6): { month: string; total: number }[]` in `utils/calculations.ts`. Filter out `isSettlement` records; bucket by `tx.date.slice(0, 7)`; fill any missing months with 0. |
| **UI** | Neo-styled card with a `BarChart` constrained to `h-40`; bars in `neo-purple`; x-axis shows abbreviated month names; y-axis shows dollar amounts. Toggle between "I Paid" / "They Paid" with the existing radio-button pattern. |
| **Placement** | `screens/Home.tsx` (new `<section>` after "Debt Origins"), `utils/calculations.ts` (new util + test). |
| **Conflicts** | Recharts is already a dependency and code-split via `screens/Home`; no bundle impact on other routes. |

---

### 5. Nudge button — share/copy payment-request message

| Field | Detail |
|--------|--------|
| **What** | The "Nudge" button in `FriendDetail.tsx` (line 144) has `onClick={() => {}}` — it is a fully inert placeholder. Tapping it does nothing. |
| **Why** | Sending a polite reminder to a debtor is the social mechanic that makes expense-sharing apps sticky; it is the primary reason people open the app after logging a transaction. |
| **How** | On tap, format a message: *"Hey {name}, just a reminder — you owe me {amount} on SquareOne 👋"*. Call `navigator.share({ title: 'SquareOne nudge', text: message })` if `navigator.share` is supported (mobile); otherwise fall back to `navigator.clipboard.writeText(message)` and show a "Copied!" toast. |
| **Logic** | `const message = buildNudgeMessage(friend.name, formatCurrency(Math.abs(calculatedBalance)))` — a one-line pure function, testable. Show the nudge button only when `calculatedBalance < 0` (friend owes you), matching the `"They Owe"` display state. |
| **UI** | No screen change; the existing button already has the 👋 icon and "Nudge" label. Add a brief scale animation (`Framer Motion whileTap`) and swap the toast for "Nudge sent!" or "Copied!". |
| **Placement** | `screens/FriendDetail.tsx` (replace `onClick={() => {}}` with `handleNudge`); optionally extract to `utils/nudge.ts` for testability. |
| **Conflicts** | `calculatedBalance` is already derived in `FriendDetail`; no state changes required. |

---

### 6. History: date-range filter and custom-type chips

| Field | Detail |
|--------|--------|
| **What** | `History.tsx` filter chips are hard-coded to `['All', 'Poker', 'Meals', 'Loans', 'Unsettled']`. Users who add custom transaction types (e.g. "Rent", "Holiday") cannot filter by them. There is also no date-range filter beyond the display grouping ("Today / This Week / This Month"). |
| **Why** | As the ledger grows, being locked to five static filters makes the history screen increasingly hard to navigate; custom types are a first-class feature but they are invisible to the filter system. |
| **How** | (a) Build the filter chip list dynamically from `[...TRANSACTION_TAGS.map(t => t.label), ...customTypes]` read from `AppContext`, deduplicated and sorted. (b) Add a date-range dropdown or calendar pair (reuse the existing `DatePicker` component) with presets: "Last 7 days / Last 30 days / Last 3 months / All time". (c) Keep `FilterType` as a union of `string | 'All' | 'Unsettled'` to allow any type value. |
| **Logic** | Replace the hard-coded `FilterType` union with `type FilterType = string`. The existing `typeMap` lookup in `filteredTransactions` is replaced with a direct string comparison (`tx.type === activeFilter`). Date-range filtering: `filteredTransactions.filter(tx => new Date(tx.date) >= rangeStart)`. |
| **UI** | Filter chips remain horizontal scrollable; add a calendar icon button at the end that opens a date-range popover. A "Clear filters" pill appears when any non-default filter is active. |
| **Placement** | `screens/History.tsx` (state, filter logic, chip rendering), `context/AppContext.tsx` (`customTypes` already exposed), `components/AddTransaction/DatePicker.tsx` (reuse for range selection). |
| **Conflicts** | The existing `FilterType` type alias and `typeMap` object in `History.tsx` are replaced; `handleFilterReset` must also clear the date range state. |

---

### 7. FriendDetail: per-friend transaction search and sort

| Field | Detail |
|--------|--------|
| **What** | `FriendDetail` shows all transactions with a given friend in a flat list with no search input and no sort controls. For long-standing friendships with dozens of entries, finding a specific transaction requires scrolling the entire list. |
| **Why** | `History.tsx` already has local search and sort — the same UX should be available scoped to a single friend. |
| **How** | Add a collapsible search bar (toggle with a search icon button in `DetailHeader`) that filters `friendTransactions` by `title`, `note`, and `amount.toString()` using the existing `matchesTransactionQuery` util from `utils/search.ts`. Add a sort toggle (Date ↑↓) mirroring `History.tsx`. |
| **Logic** | `filteredFriendTransactions = useMemo(() => friendTransactions.filter(tx => matchesTransactionQuery(tx, normalizedQuery, [])), [friendTransactions, query])`. Sorting: `.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())` vs the inverse — already done in History. |
| **UI** | Search bar slides in below `DetailHeader` when toggled (Framer Motion `height` animation). Sort toggle sits beside the search icon. Zero-result empty state consistent with `History.tsx`. |
| **Placement** | `components/FriendDetail/DetailHeader.tsx` (search icon button), `screens/FriendDetail.tsx` (search state + filtered memos), `components/FriendDetail/TransactionList.tsx` (accept filtered list). |
| **Conflicts** | `TransactionList` currently receives `transactions` prop directly; replacing it with a filtered list is additive. `matchesTransactionQuery` is already tested in `utils/search.test.ts`. |

---

### 8. Bell → outstanding debts panel

| Field | Detail |
|--------|--------|
| **What** | The notification bell in `Home.tsx` (line 85) shows a red dot when `unsettledCount > 0` but has no `onClick` handler — tapping it does nothing. The `unsettledCount` itself is also misleading: it counts every non-settlement transaction (including already-balanced ones) rather than friends with a net outstanding balance. |
| **Why** | Users tapping the bell expect to see a summary of what they owe and what is owed to them; the silent button creates confusion and a missed engagement opportunity. |
| **How** | On tap, open a `NeoModal` (or a bottom-sheet style panel) listing: (a) friends who owe you, sorted by descending balance; (b) friends you owe, sorted by descending magnitude. Each row shows avatar + name + amount + a "Settle Up" shortcut link. Fix `unsettledCount` to `friends.filter(f => f.balance !== 0).length`. |
| **Logic** | Derive panels from `friends`: `owedToMe = friends.filter(f => f.balance > 0)`, `iOwe = friends.filter(f => f.balance < 0)`. No new data fetching required — `friends` is already in context with live balances. |
| **UI** | Standard `NeoModal` with two labelled sections ("Owed to You" / "You Owe"), each with a scrollable friend list row. A "View All" link at the bottom navigates to `/friends`. |
| **Placement** | `screens/Home.tsx` (add `showNotifications` state + `onClick={...}` on bell button + correct `unsettledCount` formula), `components/` (optionally extract to `DebtSummaryPanel.tsx`). |
| **Conflicts** | The `unsettledCount` formula change may alter the red-dot visibility — only friends with a net non-zero balance will trigger it (more accurate, not a regression). |

---

### 9. Friend aggregate stats in FriendDetail

| Field | Detail |
|--------|--------|
| **What** | The `FriendDetail` header section shows balance and avatar, but there are no aggregate statistics: total number of transactions, cumulative amount exchanged, or largest single transaction. |
| **Why** | Stats like "42 transactions • $1,240 total" give the user context about the depth of the relationship and make the balance figure more meaningful. |
| **How** | Below the balance display in `FriendDetail.tsx` (inside the hero section), add a 3-column stats row: **Transactions** (count), **Total** (sum of all amounts), **Largest** (max single transaction amount). Compute via `useMemo` from `friendTransactions`. |
| **Logic** | `const stats = useMemo(() => ({ count: friendTransactions.length, total: friendTransactions.reduce((s, t) => s + t.amount, 0), largest: Math.max(...friendTransactions.map(t => t.amount), 0) }), [friendTransactions])`. Use `formatCurrency` for monetary values; format count as plain integer. |
| **UI** | Three `NeoCard`-style stat cells in a `grid grid-cols-3` row with bold uppercase label and large font value — consistent with the net position widget on `Home`. |
| **Placement** | `screens/FriendDetail.tsx` — new `useMemo` + stat row JSX between the balance display and the action buttons. No new files required. |
| **Conflicts** | None — purely additive JSX in the hero section. |

---

### 10. Receipt photo upload via Supabase Storage

| Field | Detail |
|--------|--------|
| **What** | The Camera button in `AddTransaction.tsx` (line 271) imports `Camera` from Lucide and renders the icon but has no `onClick` handler — tapping it does nothing. |
| **Why** | Attaching a photo of a receipt or bill is the most-requested feature in expense apps; it eliminates disputes and provides a paper trail for larger amounts. |
| **How** | On tap, open a native `<input type="file" accept="image/*" capture="environment">` triggered via a hidden ref. On file select, upload to Supabase Storage bucket `receipts/{user_id}/{uuid}.jpg` via `supabase.storage.from('receipts').upload(path, file)`. Store the returned public URL in a new optional `receiptUrl?: string` field on `Transaction`. Display a thumbnail preview in the form and a small camera icon badge on the transaction row in `History` / `FriendDetail`. |
| **Logic** | New `receiptUrl` field on the `Transaction` interface (nullable). `AddTransaction` form state gains a `receiptFile: File | null` and `receiptPreview: string`. Upload runs in `onSubmit` before `addTransaction` is called; the URL is passed into the transaction object. Add `receipt_url text nullable` column to the `transactions` table. |
| **UI** | Camera button gets an `onClick` that triggers the hidden file input. A 64×64 preview thumbnail replaces the camera icon once a photo is selected. A small 📷 badge appears on transaction rows in `History`/`FriendDetail` when `receiptUrl` is set; tapping opens the image in a `NeoModal`. |
| **Placement** | `screens/AddTransaction.tsx`, `types.ts` (`Transaction`), `context/AppContext.tsx` (pass `receiptUrl` in `dbTransaction`), `utils/guestStorage.ts` (store URL string — no file in localStorage), `components/FriendDetail/TransactionList.tsx`, `screens/History.tsx`. Database: `receipt_url` column + Supabase Storage bucket with RLS. |
| **Conflicts** | `guestStorage` cannot store binary files; store the object URL (`URL.createObjectURL`) for the guest session only with a warning that it is temporary. Supabase Storage RLS must allow authenticated users to read/write under their own `user_id` path. |

---

### 11. Currency/locale preference

| Field | Detail |
|--------|--------|
| **What** | `utils/formatters.ts` hard-codes `currency: 'USD'` and `style: 'currency'` in `formatCurrency`. All monetary displays across the app show `$` regardless of the user's locale or preference. |
| **Why** | Users outside the US cannot use the app with their own currency; the hardcoded `$` is the single biggest barrier to international adoption. |
| **How** | Add a "Currency" selector to `Profile.tsx` (User Preferences section) with a list of common currencies (`USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, `INR`, `MXN`, `BRL`). Persist the selection to `localStorage` (`squareone_currency`, default `'USD'`). `formatCurrency` reads this value and passes it to `Intl.NumberFormat`. |
| **Logic** | `export function formatCurrency(amount: number, currency = getCurrency()): string` where `getCurrency()` returns `localStorage.getItem('squareone_currency') ?? 'USD'`. The change is backward-compatible; all existing call-sites that pass no second argument continue to work. For authenticated users, also sync the preference to a `settings` column (or a dedicated `user_settings` table) in Supabase so it persists across devices. |
| **UI** | A single-select `<select>` in the Preferences `NeoCard`, styled to match the existing theme toggle. Changes apply immediately across the whole app via a React context (`CurrencyContext`) or by listening to a `storage` event. |
| **Placement** | `utils/formatters.ts`, `screens/Profile.tsx`, new `context/CurrencyContext.tsx` (optional but cleaner than re-reading localStorage on every render). |
| **Conflicts** | Existing `formatCurrency` call-sites need no changes if the default is preserved. Guest mode stores the preference in localStorage (already aligned); authenticated mode requires a Supabase schema addition. |

---

### 12. Settle-up smart presets

| Field | Detail |
|--------|--------|
| **What** | The settle-up quick-amount chips in `SettleUp.tsx` are hard-coded to `['100', '500', 'Full']` regardless of the actual balance. For a $15 lunch debt, `$100` and `$500` are useless options. |
| **Why** | The presets are meant to speed up entry; when they are larger than the balance or unrelated to typical transaction sizes they add noise rather than value. |
| **How** | Replace the hard-coded array with dynamically computed presets based on `Math.abs(balance)`: `[Math.round(balance * 0.25), Math.round(balance * 0.5), balance]` formatted as `['25%', '50%', 'Full']`. If the balance is an even number, also offer the exact value. Cap the displayed precision to 2 decimal places. |
| **Logic** | `const presets = useMemo(() => [ { label: '25%', value: (Math.abs(balance) * 0.25).toFixed(2) }, { label: '50%', value: (Math.abs(balance) * 0.5).toFixed(2) }, { label: 'Full', value: Math.abs(balance).toFixed(2) }, ], [balance])`. |
| **UI** | The 3-chip grid layout stays identical; only the labels (`$100` → `25%`) and the values they set change. "Full" always remains as the last chip. |
| **Placement** | `screens/SettleUp.tsx` — replace the `['100', '500', 'Full']` constant with the `presets` memo; update `handleQuickAmount` to read from the memo's `value` field. |
| **Conflicts** | None — self-contained to `SettleUp.tsx`. `isValidAmount` already validates the resulting string. |

---

## Signals reviewed

| Signal | Finding |
|--------|---------|
| **TODO / FIXME** | None in `*.ts` / `*.tsx`. |
| **Inert buttons** | 3 found: Bell (Home.tsx:85 — no onClick), Nudge (FriendDetail.tsx:144 — `onClick={() => {}}`), Camera (AddTransaction.tsx:271 — no onClick). Proposals #5, #8, #10 address these. |
| **Dead-code comment** | Profile.tsx:127 — *"Wait for AuthContext to pick up changes"*. Proposal #3 fixes this. |
| **Data loss on sign-up** | `clearGuestLocalData()` called in 3 places in AuthContext before migration. Proposal #2 addresses this. |
| **Hard-coded USD** | `formatters.ts:7 currency: 'USD'`. Proposal #11 addresses this. |
| **Hard-coded presets** | SettleUp.tsx `['100', '500', 'Full']`. Proposal #12 addresses this. |
| **`npm audit`** | Run before releases; last run reported 0 vulnerabilities. |
| **Context `error`** | Set when friends/transactions queries fail; banner + Retry on Home, Friends, History. |

---

*Last updated: 2026-03-27 — full reanalysis; 11 new proposals added; group expenses retained; all verified against current source.*
