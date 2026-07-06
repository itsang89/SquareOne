# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard (Pie "Debt Origins" + Bar "Monthly Spending"). Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`); custom types go to `squareone_custom_types`. Stack: **React 19**, **Vite 6**, **TypeScript** (`strict`), **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind**, **Lucide**, **react-number-format**. Tooling: **Vitest** (utils tests), **ESLint** flat config. Modals use **NeoModal** with dialog semantics, focus trap, and Escape-to-close. Supabase OAuth and email confirmation use **hash redirects** (`origin/#/dashboard`) via `authRedirectTo` in `context/AuthContext.tsx`. **Load failures:** `AppContext` sets `error` on friends/transactions query failure, preserves partial snapshots (`transactionsRef` for balances), and **Home / Friends / History** show `DataLoadErrorBanner` with Retry. **Friend detail** shows aggregate stats (count / total / largest) and a per-friend search bar. **History** has search + sort + filter chips. **Profile** has CSV export and clear-all-data.

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [ ] **1.** Group expenses — split one bill across multiple friends at once
- [ ] **2.** Nudge button — share/copy a payment-request message from `FriendDetail` *(still disabled with "Soon" badge; button at `screens/FriendDetail.tsx:173`)*
- [ ] **3.** History: date-range filter and custom-type chips — extend current Poker/Meals/Loans filters (still hard-coded to `['All', 'Poker', 'Meals', 'Loans', 'Unsettled']` at `screens/History.tsx:19,189`)
- [ ] **4.** Receipt photo upload — Camera button in `AddTransaction` has no handler (still inert at `screens/AddTransaction.tsx:287`)
- [ ] **5.** Currency/locale preference — `formatCurrency` is still hard-coded to USD (`utils/formatters.ts:4`)

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

### 2. Nudge button — share/copy payment-request message

| Field | Detail |
|--------|--------|
| **What** | The "Nudge" button in `FriendDetail.tsx:173` is `disabled` with a "Soon" badge and no `onClick`. Tapping it does nothing. |
| **Why** | Sending a polite reminder to a debtor is the social mechanic that makes expense-sharing apps sticky; it is the primary reason people open the app after logging a transaction. |
| **How** | On tap, format a message: *"Hey {name}, just a reminder — you owe me {amount} on SquareOne 👋"*. Call `navigator.share({ title: 'SquareOne nudge', text: message })` if `navigator.share` is supported (mobile); otherwise fall back to `navigator.clipboard.writeText(message)` and show a "Copied!" toast. |
| **Logic** | `const message = buildNudgeMessage(friend.name, formatCurrency(Math.abs(calculatedBalance)))` — a one-line pure function, testable. Show the nudge button only when `calculatedBalance < 0` (friend owes you), matching the `"They Owe"` display state. |
| **UI** | Remove the `disabled` and "Soon" badge; the existing button already has the 👋 icon and "Nudge" label. Add a brief scale animation (`Framer Motion whileTap`) and swap the toast for "Nudge sent!" or "Copied!". |
| **Placement** | `screens/FriendDetail.tsx` (replace the disabled variant with `onClick={handleNudge}`); optionally extract `buildNudgeMessage` to `utils/nudge.ts` for testability. |
| **Conflicts** | `calculatedBalance` is already derived in `FriendDetail`; no state changes required. |

---

### 3. History: date-range filter and custom-type chips

| Field | Detail |
|--------|--------|
| **What** | `screens/History.tsx:19,189` filter chips are hard-coded to `['All', 'Poker', 'Meals', 'Loans', 'Unsettled']`. Users who add custom transaction types (e.g. "Rent", "Holiday") cannot filter by them. There is also no date-range filter beyond the display grouping ("Today / This Week / This Month"). |
| **Why** | As the ledger grows, being locked to five static filters makes the history screen increasingly hard to navigate; custom types are a first-class feature but they are invisible to the filter system. |
| **How** | (a) Build the filter chip list dynamically from `[...TRANSACTION_TAGS.map(t => t.label), ...customTypes]` read from `AppContext`, deduplicated and sorted. (b) Add a date-range dropdown or calendar pair (reuse the existing `DatePicker` component) with presets: "Last 7 days / Last 30 days / Last 3 months / All time". (c) Keep `FilterType` as a union of `string | 'All' | 'Unsettled'` to allow any type value. |
| **Logic** | Replace the hard-coded `FilterType` union with `type FilterType = string`. The existing `typeMap` lookup in `filteredTransactions` (line 80) is replaced with a direct string comparison (`tx.type === activeFilter`). Date-range filtering: `filteredTransactions.filter(tx => new Date(tx.date) >= rangeStart)`. |
| **UI** | Filter chips remain horizontal scrollable; add a calendar icon button at the end that opens a date-range popover. A "Clear filters" pill appears when any non-default filter is active. |
| **Placement** | `screens/History.tsx` (state, filter logic, chip rendering), `context/AppContext.tsx` (`customTypes` already exposed), `components/AddTransaction/DatePicker.tsx` (reuse for range selection). |
| **Conflicts** | The existing `FilterType` type alias and `typeMap` object in `History.tsx` are replaced; `handleFilterReset` (line 151) must also clear the date range state. |

---

### 4. Receipt photo upload via Supabase Storage

| Field | Detail |
|--------|--------|
| **What** | The Camera button in `AddTransaction.tsx:287` imports `Camera` from Lucide and renders the icon but has no `onClick` handler — tapping it does nothing. |
| **Why** | Attaching a photo of a receipt or bill is the most-requested feature in expense apps; it eliminates disputes and provides a paper trail for larger amounts. |
| **How** | On tap, open a native `<input type="file" accept="image/*" capture="environment">` triggered via a hidden ref. On file select, upload to Supabase Storage bucket `receipts/{user_id}/{uuid}.jpg` via `supabase.storage.from('receipts').upload(path, file)`. Store the returned public URL in a new optional `receiptUrl?: string` field on `Transaction`. Display a thumbnail preview in the form and a small camera icon badge on the transaction row in `History` / `FriendDetail`. |
| **Logic** | New `receiptUrl` field on the `Transaction` interface (nullable, currently absent in `types.ts`). `AddTransaction` form state gains a `receiptFile: File | null` and `receiptPreview: string`. Upload runs in `onSubmit` before `addTransaction` is called; the URL is passed into the transaction object. Add `receipt_url text nullable` column to the `transactions` table (currently absent in `docs/database.md`). |
| **UI** | Camera button gets an `onClick` that triggers the hidden file input. A 64×64 preview thumbnail replaces the camera icon once a photo is selected. A small 📷 badge appears on transaction rows in `History`/`FriendDetail` when `receiptUrl` is set; tapping opens the image in a `NeoModal`. |
| **Placement** | `screens/AddTransaction.tsx`, `types.ts` (`Transaction`), `context/AppContext.tsx` (pass `receiptUrl` in `dbTransaction` via `utils/transactions.ts`), `utils/guestStorage.ts` (store URL string — no file in localStorage), `components/FriendDetail/TransactionList.tsx`, `screens/History.tsx`. Database: `receipt_url` column + Supabase Storage bucket with RLS. |
| **Conflicts** | `guestStorage` cannot store binary files; store the object URL (`URL.createObjectURL`) for the guest session only with a warning that it is temporary. Supabase Storage RLS must allow authenticated users to read/write under their own `user_id` path. |

---

### 5. Currency/locale preference

| Field | Detail |
|--------|--------|
| **What** | `utils/formatters.ts:4` hard-codes `currency: 'USD'` and `style: 'currency'` in `formatCurrency`. All monetary displays across the app show `$` regardless of the user's locale or preference. |
| **Why** | Users outside the US cannot use the app with their own currency; the hardcoded `$` is the single biggest barrier to international adoption. |
| **How** | Add a "Currency" selector to `Profile.tsx` (User Preferences section, currently at line 298) with a list of common currencies (`USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, `INR`, `MXN`, `BRL`). Persist the selection to `localStorage` (`squareone_currency`, default `'USD'`). `formatCurrency` reads this value and passes it to `Intl.NumberFormat`. |
| **Logic** | `export function formatCurrency(amount: number, currency = getCurrency()): string` where `getCurrency()` returns `localStorage.getItem('squareone_currency') ?? 'USD'`. The change is backward-compatible; all existing call-sites that pass no second argument continue to work. For authenticated users, also sync the preference to a `settings` column (or a dedicated `user_settings` table) in Supabase so it persists across devices. |
| **UI** | A single-select `<select>` in the Preferences `NeoCard`, styled to match the existing theme toggle. Changes apply immediately across the whole app via a React context (`CurrencyContext`) or by listening to a `storage` event. |
| **Placement** | `utils/formatters.ts`, `screens/Profile.tsx`, new `context/CurrencyContext.tsx` (optional but cleaner than re-reading localStorage on every render). |
| **Conflicts** | Existing `formatCurrency` call-sites need no changes if the default is preserved. Guest mode stores the preference in localStorage (already aligned); authenticated mode requires a Supabase schema addition. |

---

## Signals reviewed

| Signal | Finding |
|--------|---------|
| **TODO / FIXME** | None in `*.ts` / `*.tsx`. |
| **Inert buttons** | 2 remaining: Camera (`AddTransaction.tsx:287` — no onClick) and Nudge (`FriendDetail.tsx:173` — disabled with "Soon" badge). Proposals #2 and #4 address these. |
| **Hard-coded USD** | `formatters.ts:4 currency: 'USD'`. Proposal #5 addresses this. |
| **Hard-coded filter chips** | `History.tsx:19,189` — fixed 5-element union. Proposal #3 addresses this. |
| **`npm audit`** | Run before releases; last run reported 0 vulnerabilities. |
| **Context `error`** | Set when friends/transactions queries fail; banner + Retry on Home, Friends, History. |

---

*Last updated: 2026-07-06.*