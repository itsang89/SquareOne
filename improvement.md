# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard (Pie "Debt Origins" + Bar "Monthly Spending"). Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`); custom types go to `squareone_custom_types`. Stack: **React 19**, **Vite 6**, **TypeScript** (`strict`), **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind**, **Lucide**, **react-number-format**. Tooling: **Vitest** (utils tests), **ESLint** flat config. Modals use **NeoModal** with dialog semantics, focus trap, and Escape-to-close. Supabase OAuth and email confirmation use **hash redirects** (`origin/#/dashboard`) via `authRedirectTo` in `context/AuthContext.tsx`. **Load failures:** `AppContext` sets `error` on friends/transactions query failure, preserves partial snapshots (`transactionsRef` for balances), and **Home / Friends / History** show `DataLoadErrorBanner` with Retry. **Friend detail** shows aggregate stats (count / total / largest) and a per-friend search bar. **History** has search + sort + filter chips. **Profile** has CSV export and clear-all-data. Camera button removed from AddTransaction (2026-07-20).

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [ ] **1.** Group expenses — split one bill across multiple friends at once
- [ ] **2.** Nudge button — share/copy a payment-request message from `FriendDetail` *(still disabled with "Soon" badge; button at `screens/FriendDetail.tsx:173`)*
- [x] **3.** ~~History: date-range filter and custom-type chips~~ — *done (2026-07-20); dynamic chips from `customTypes`, date presets, custom range picker, clear pill*
- [ ] **4.** Currency/locale preference — `formatCurrency` is still hard-coded to USD (`utils/formatters.ts:4`)
- [ ] **5.** Double-click delete with no visual countdown — two-step delete (click once to arm, click again to confirm) has no countdown indicator; a stray second click permanently deletes the transaction
- [ ] **6.** "High-Low" filter label unclear — Friends filter tab shows `$$ High-Low` which most users won't understand; "Largest Balance" is clearer
- [ ] **7.** Note field requires extra modal tap — the Note is accessed via a separate modal in `AddTransaction`; inline the field in the main form
- [ ] **8.** Friend cards show first name only — "Owes You" and Friends list show `friend.name.split(' ')[0]`; name collisions when two friends share a first name cause confusion
- [ ] **9.** Empty states lack CTAs — Home and History show "No recent transactions" / "No transactions found" with no link to the creation flow
- [ ] **10.** Net position sign convention unclear — the `+$50.00` / `-$50.00` display doesn't label whether the user is ahead or behind; a "You're ahead" / "You're behind" label would reduce first-use confusion
- [ ] **11.** Settle Up at zero balance — settle screen shows 25%/50%/Full presets even when `balance === 0`; should disable or show "Already settled!"
- [ ] **12.** Global search results lack direction — transaction results in the command palette show the amount but not the direction (who paid)
- [ ] **13.** Profile has no sync status — the Profile screen (the settings hub) doesn't indicate whether data is local-only (guest) or synced to Supabase
- [ ] **14.** Bottom Nav no contextual actions — on Friend Detail the most relevant action (Settle Up) is buried in the page body instead of surfaced in the nav

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

### 4. Currency/locale preference

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

### 5. Visual countdown for two-step delete

| Field | Detail |
|--------|--------|
| **What** | In `screens/Home.tsx` and `screens/History.tsx`, delete confirmation uses a two-step pattern: click once to arm (button turns red), click again within 3 s to confirm. The timeout is silent with no visible countdown. |
| **Why** | Users who arm deletion then get distracted may not realize the action is still armed, leading to accidental deletion on a stray tap. The current `useTimeout` pattern also silently resets after 3 s with no user-visible timer. |
| **How** | Replace the silent `useTimeout` reset with a visible countdown. When `deletingId` is set, render a circular SVG progress ring (or animated width bar) around the trash icon that depletes over 3 s. When the timeout fires, reset `deletingId` and restore the normal button state. The animation should use Framer Motion or CSS `transition` on a `dashoffset` value. |
| **Logic** | No state changes needed — `deletingId` is already the source of truth. Add a `countdownProgress` state (0 → 1) driven by `useEffect` with `setInterval(100ms)`, clearing on reset. |
| **UI** | Replace the static red fill with a ring: `<svg viewBox="0 0 24 24"><circle r="10" fill="none" stroke="gray" stroke-width="2"/><circle r="10" fill="none" stroke="neo-red" stroke-width="2" stroke-dasharray={circumference} stroke-dashoffset={circumference * countdownProgress}/></svg>`. The ring depletes clockwise as time runs out. |
| **Placement** | `screens/Home.tsx` (delete button in recent transactions), `screens/History.tsx` (delete button on each row), `components/TransactionRow.tsx` (if extracted). |
| **Conflicts** | The pattern also exists in `screens/FriendDetail.tsx` — apply the same countdown there. No logic changes; purely presentational. |

---

### 6. Rename "$$ High-Low" filter to "Largest Balance"

| Field | Detail |
|--------|--------|
| **What** | `screens/Friends.tsx:124` renders a filter tab with the label `$$ High-Low`. This is clever but opaque — most users will not immediately understand it means "sort by absolute balance, descending." |
| **Why** | Cryptic labels reduce discoverability and increase onboarding friction. "Largest Balance" (or "Highest Amount") is unambiguous and self-explanatory. |
| **How** | Rename the tab label from `$$ High-Low` to `Largest Balance`. Update the `FilterType` union comment and the empty state text if it references the old label. |
| **UI** | One-line change: `f === 'High-Low' ? 'Largest Balance' : f` in the render. |
| **Placement** | `screens/Friends.tsx:124`. |

---

### 7. Inline the Note field in Add Transaction

| Field | Detail |
|--------|--------|
| **What** | In `screens/AddTransaction.tsx`, the Note field is behind a modal: user taps "Add Note" → modal opens → types note → taps "Done" → modal closes. This is three taps for a one-line text input. |
| **Why** | Notes are often short and contextual ("pizza night", "Vegas trip"). The modal flow breaks the user's typing rhythm and adds friction to the most common transaction types. |
| **How** | Replace the "Add Note" button with an always-visible `NeoInput` for the note field, placed between the Type Selector and the date/note row. Keep the note state as a direct `useState` string (not via `useForm`). If the note is empty, the input shows the placeholder "Add a note…". |
| **UI** | Remove the `showNoteModal` state and the Note modal. Replace the "Add Note" button with: `<NeoInput label="Note" placeholder="What was this for?" value={note} onChange={e => setNote(e.target.value)} />`. |
| **Placement** | `screens/AddTransaction.tsx` (remove modal, add inline input). |
| **Conflicts** | The `note` field is already part of `useForm` state — no change to form submission logic. Only the UI presentation changes. |

---

### 8. Show full name (not just first name) in friend cards

| Field | Detail |
|--------|--------|
| **What** | Friend cards in the "You Owe" horizontal scroll on `Home` and in the Friends list truncate to `friend.name.split(' ')[0]`. Two friends named "Alex" become indistinguishable. |
| **Why** | Name collisions are common (common first names, initials, nicknames). Showing only the first name makes the UI ambiguous when multiple friends share a name. |
| **How** | Replace the single-line truncated display with a two-line layout: first name in bold, last name (or full name if no space) in smaller muted text below. Example: `<p className="text-sm font-bold truncate w-full">Alex</p><p className="text-[10px] text-gray-500 truncate w-full">Alex Chen</p>`. |
| **UI** | In `screens/Home.tsx` and `screens/Friends.tsx`, update the name display inside friend cards. Ensure both lines truncate independently so long names don't overflow the card. |
| **Placement** | `screens/Home.tsx` (You Owe card), `screens/Friends.tsx` (friend list row). |
| **Conflicts** | `Avatar` components already display the full image, so the visual context remains. This is purely presentational. |

---

### 9. Empty states with direct CTAs

| Field | Detail |
|--------|--------|
| **What** | `screens/Home.tsx` ("No recent transactions") and `screens/History.tsx` ("No transactions found") display empty messages without any suggested action. |
| **Why** | Empty states are high-value onboarding moments. A user who sees an empty state with no next step may close the app instead of logging their first transaction. |
| **How** | Replace the static empty message with a centered card that includes a brief motivational message and a `NeoButton` linking to `/add`. Example: "Nothing here yet — add your first expense!" + "Add Transaction" button. |
| **UI** | Add a `<NeoCard>` wrapper around the empty message with a button: `<Link to="/add"><NeoButton>Add Transaction</NeoButton></Link>`. |
| **Placement** | `screens/Home.tsx` (Recent Moves empty state), `screens/History.tsx` (no-results empty state). |

---

### 10. Label the net position direction

| Field | Detail |
|--------|--------|
| **What** | The dashboard's big "Total Net Position" display shows `+$50.00` or `-$50.00` without explicitly stating whether the user is a net creditor or debtor. The color coding helps, but first-time users may not intuit the sign convention. |
| **Why** | Positive = friend owes you / negative = you owe them is a reasonable convention, but it is never stated. A user who expects the opposite sign will read their balance backwards. |
| **How** | Add a small label below the animated number: "You're ahead" when `netBalance >= 0`, "You're behind" when `netBalance < 0`. Use the same muted uppercase style as the "Total Net Position" label. |
| **UI** | Below the `AnimatedNumber` in `screens/Home.tsx`, add: `<p className="text-black/60 dark:text-black/70 text-[10px] font-black uppercase tracking-widest mt-1">{netBalance >= 0 ? "You're ahead" : "You're behind"}</p>`. |
| **Placement** | `screens/Home.tsx` (Net Position Widget). |

---

### 11. Settle Up when balance is already zero

| Field | Detail |
|--------|--------|
| **What** | `screens/SettleUp.tsx` renders the settle form even when `balance === 0`. The 25%/50%/Full preset buttons all pre-fill `$0.00`, and the "Confirm Settle" button would submit a zero-amount settlement. |
| **Why** | Settling when nothing is owed is an edge case that shouldn't produce a confusing form. Users who tap "Settle Up" from a settled friend expect a confirmation, not a blank input form. |
| **How** | Add an early-return guard in `SettleUp`: if `balance === 0`, render a celebration card: "All settled with {friend.name}! ✓" with a "Back to {name}" button that navigates to `/friends/{friend.id}`. Optionally trigger confetti here too. |
| **UI** | Add at the top of the return statement: `if (balance === 0) return (<div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6"><Handshake size={64} className="text-neo-green" /><p className="text-2xl font-black uppercase">All settled with {friend.name}!</p><NeoButton onClick={() => navigate(`/friends/${friend.id}`)}>Back to {friend.name}</NeoButton></div>);`. |
| **Placement** | `screens/SettleUp.tsx`. |

---

### 12. Global search results show transaction direction

| Field | Detail |
|--------|--------|
| **What** | `components/GlobalSearch.tsx` shows transaction results with the amount but not the direction (whether the user paid or the friend paid). |
| **Why** | When a user searches for a transaction, knowing the direction at a glance (who paid) helps confirm they found the right one without reading the title or note. |
| **How** | In the transaction result button, add a `+` or `−` prefix to the amount (mirroring the `History` display): `{tx.payerId === 'me' ? '+' : '-'}{formatCurrency(tx.amount)}`, styled in green or red. |
| **UI** | In `components/GlobalSearch.tsx`, update the amount display in the transaction result list: replace `formatCurrency(tx.amount)` with `{tx.payerId === 'me' ? '+' : '-'}{formatCurrency(tx.amount)}` wrapped in a `<span>` with the appropriate color class. |
| **Placement** | `components/GlobalSearch.tsx`. |

---

### 13. Profile screen sync status indicator

| Field | Detail |
|--------|--------|
| **What** | `screens/Profile.tsx` (currently at line ~298) has no visible indicator of whether the user is in guest mode (local data only) or authenticated (Synced to Supabase). The guest banner on `Home` covers this, but the Profile screen — the natural "settings hub" — is silent. |
| **Why** | Users who signed in via guest mode to explore may not realize their data is not backed up. Profile is where users look for sync/account status. |
| **How** | In the Profile header or user info section, add a status badge: `<div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${user.id === 'guest' ? 'bg-neo-yellow' : 'bg-neo-green'}`}></div><span className="text-xs font-bold uppercase">{user.id === 'guest' ? 'Local only' : 'Synced'}</span></div>`. If guest, add a small "Sign in to sync" link below the badge. |
| **UI** | Add below the user's name/email in `screens/Profile.tsx`. |
| **Conflicts** | No logic changes. The `user.id === 'guest'` sentinel is already established. |

---

### 14. Bottom Nav contextual action on Friend Detail

| Field | Detail |
|--------|--------|
| **What** | `components/BottomNav.tsx` shows Home / Friends / + / History / Profile on all screens. On the Friend Detail screen, the most useful action (Settle Up) requires the user to scroll up and tap a button in the page body. |
| **Why** | Navigation should surface the most relevant action for the current context. On a friend's detail page, settling up is often the user's goal — not browsing other sections. |
| **How** | When on a `/friends/:id` route, replace the History tab with a Settle Up icon and label. The nav already has a `friendMatch` regex that detects `/friends/:id` paths (line 40). Add a conditional in the nav items: if `friendMatch`, show `<NavItem to="/settle/{id}" icon={HandCoins} label="Settle" isActive={false} />` instead of History. |
| **UI** | In `components/BottomNav.tsx`, after the friendMatch detection, add a conditional NavItem. Ensure the Settle icon (HandCoins) is imported from lucide. |
| **Placement** | `components/BottomNav.tsx`. |
| **Conflicts** | History remains accessible via the Home or Friends tabs. The change only replaces the History icon temporarily on Friend Detail pages. |

---

## Signals reviewed

| Signal | Finding |
|--------|---------|
| **TODO / FIXME** | None in `*.ts` / `*.tsx`. |
| **Inert buttons** | 1 remaining: Nudge (`FriendDetail.tsx:173` — disabled with "Soon" badge, no onClick). Camera button removed 2026-07-20. Proposal #2 addresses Nudge. |
| **Hard-coded USD** | `formatters.ts:4 currency: 'USD'`. Proposal #4 addresses this. |
| **`npm audit`** | Run before releases; last run reported 0 vulnerabilities. |
| **Context `error`** | Set when friends/transactions queries fail; banner + Retry on Home, Friends, History. |
| **Owes You / You Owe** | "Owes You" section on Home renamed to "Active" with original `balance !== 0` filter restored (2026-07-20). |

---

*Last updated: 2026-07-20.*