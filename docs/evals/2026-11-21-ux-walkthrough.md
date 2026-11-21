# UX walkthrough, 2026-11-21

Hands-on Playwright audit as a first-time user. Isolated demo (local Supabase + Vite on 127.0.0.1:3010), Chromium 390x844 primary, 1440x900 one pass. Screenshots: `$TMPDIR/ux-audit/` (`/var/folders/ct/6j708bqd3p3dql4dmt__0n0c0000gn/T/ux-audit/`), cited by filename prefix below.

Covered: login (wrong password), empty states, accounts/categories/friends/subscription create, every entry kind (12+8 expression, 2-friend split, USD, income, transfer, settlement), date chips + calendar, edit, delete, ledger search/filter, charts, wallet, friends + detail + settle, global search, profile, import, agent access, how-to, CSV export, dark mode, offline/reconnect, desktop, mistakes (empty/bad amounts, share > amount, back mid-form, double-tap).

Console: only Recharts `width(-1) and height(-1)` warnings on Charts (every tab visit). No page errors. Dev-server cold login to dashboard took ~6 s (dev only; not a prod number). Offline in dev: opening a never-visited lazy route throws the ErrorBoundary (`Failed to fetch dynamically imported module`); prod's service worker should cover it, untested here.

Caveat: during the run the demo DB gained a `Bank` account and a `Salary` monthly subscription (HK$30,000) that my scripts never created (DB timestamps 14:19:48). Something else wrote to it. Does not affect the findings below.

## P0 broken

1. **Foreign-currency expense is silently booked 1:1 into HKD.** Add: Wise USD account, 50, save. The `1 USD = [1] HKD` field is pre-filled with `1` (not a placeholder, not marked required). Result: dashboard/ledger/charts count US$50 as HK$50 (`HK$57` spent; Charts "Transport HK$50"; Wallet net worth is also off). Row shows `-US$50.00` under a day header of `-HK$50.00`. Fix: leave the rate empty and block save until set, or prefill the last known rate and flag it. `52-expense-usd-form`, `53-after-save-usd`, `99-charts-expenses`.

## P1 friction

2. **Save is disabled with no reason.** Empty amount, `12+`, `1÷0`, `5-8` (negative), no accounts: the grey button just doesn't respond. Only the split and settle cases show a red hint ("Friends' shares exceed the total", "Pick a friend"). Same on account, category and friend modals. Fix: one-line hint above the button for every disabled state. `20-add-empty`, `30-account-empty-save`, `33-cat-empty-save`, `71-amount-*`.
3. **First-run dead end.** New user taps +: no categories, no accounts, text "No accounts yet. Add one in Wallet." with no link; leaving loses the form. Fix: inline "Add account" / "Add category" in the form (the New category tile exists, accounts have none) or an onboarding checklist on the empty dashboard. `10-add-empty`, `02-dashboard-empty`.
4. **Save works with no category** (becomes "Expense" / "Uncategorised" in Charts) and silently defaults the account. Not necessarily wrong, but nothing signals it. Fix: highlight the missing category or confirm. `72-save-no-cat-no-acct`.
5. **Negative custom share is accepted.** Typing `-3` in a friend's share saves as `3` (minus stripped silently); `abc` is dropped. Fix: reject, or show an error. `80b-share-bad`.
6. **Settle up does not suggest the full amount.** From the form, amount is whatever you typed; from the friend page it prefills the balance (good). Typing 6 against a 6.67 debt leaves a HK$0.67 tail. Fix: "Full HK$6.67" chip beside the friend card. `81-settle-sam`, `90-friend-settle-prefill`.
7. **"Clear all data" is one tap + one confirm.** "Yes, Clear All" wipes everything with no typed confirmation or export nudge, two rows below Sign out. Fix: type-to-confirm or require a recent CSV export. `C9-clear-all-dialog`.
8. **Toasts outlive navigation and cover the header.** A "SAVED" toast from the previous screen sits over the Back button and the Expense/Income tabs on the next `/add` and on Friend detail; on login the red error toast hides the logo. Fix: shorter life on route change or position below the header. `52`, `56`, `83`, `G1`.
9. **Calendar opens below the fold.** "Pick date" expands the month grid under the chips and does not scroll into view, and the "Today" chip stays highlighted while picking. `63-pick-date`.

## P2 polish

10. Back from `/add` after typing discards the draft with no confirm (browser Back too). `75-back-mid-form`.
11. No upper limit on amount: HK$99,999,999,999,999 saves. `71-amount-huge`.
12. Friend-history signs: "Sam repaid" shows `-HK$6.00` in green on Friend detail but `+HK$6.00` in Ledger. Pick one convention. `83` vs `98-after-delete`.
13. Ledger toggle reads "All time" while viewing a single month (it is the action, not the state). `91-ledger`.
14. Filter dropdown leaks icon names into labels ("utensils Food", "bus Transport"). `93-ledger-filters`.
15. Add-category modal has a free-text "Icon (name or emoji)" field next to the icon grid; the field is empty by default, no placeholder on Name. `33-cat-empty-save`.
16. Settle-up "Paid into" row clips the "Offset (no money moved)" chip with no scroll hint. `63-pick-date`.
17. Trend chart with one active day renders a lone vertical line; income/spend scales unreadable (spend invisible). `99-charts-Trend`.
18. Split-equal remainder: 20 / 3 → friends 6.67 + 6.67, "Your share" 6.66 (you absorb the rounding, silently). `45-split-sam-alex`.
19. Agent access shows `node cli/squareone.mjs connect --url http://127.0.0.1:3010 …`, which needs a repo checkout. Fine for you, confusing for anyone else. `C5-agent-access`.
20. Desktop (1440) is a ~510 px centred column with empty sides and a full-width bottom bar; works, not designed. `F-desktop-dashboard`, `F-desktop-add`.
21. Dark mode: disabled Save button and inactive chips (`Bank`) are low contrast. `D-dark-add`.
22. Header icons (search, friends, settings) are icon-only with no visible labels; aria-labels exist. `02-dashboard-empty`.

## Worked well

Expression keypad (`12+8` live preview, `= HK$20.00`), split editor with live "your share / friends owe you", transfer "To" excluding "From", settle prefill from Friend detail, two-step delete, double-tap save created one entry, offline outbox ("pending sync" row, banner, sync on reconnect, blocked writes give a clear toast), global search (⌘K), CSV export download, wrong-password message.

## Not tested

Import Money+ with a real CSV (screen only), manual agent token creation, Google/Apple sign-in, sign-up/email confirmation, subscription auto-posting on its due date, production service worker.

## Verified in code

- #1 confirmed: `screens/AddEntry.tsx:85` falls back to `fx_rate = 1` when no rate is typed and no earlier entry in that currency exists.

## Feature ideas (not started)

1. Budgets per category with a near-limit warning (largest gap vs Money+).
2. Auto FX rate for the entry date (also removes the root of #1).
3. Repeat last entry / saved templates (lunch, Octopus top-up) for one-tap logging.
4. Nudge friend: share-sheet "you owe me HK$X" message.
5. Monthly recap: vs last month, top categories, upcoming subscriptions.
6. Account reconcile: type the real balance, app books the difference.
7. Receipt photo → agent-parsed entry (plan lists receipts out of scope; revisit).
8. Undo toast after delete instead of two-tap delete.

## Status

| Item | State |
|---|---|
| P0 #1, P1 #2–#9 | Done 2026-11-21 on `feature/uiux-polish`, Codex-reviewed, verified in demo |
| P2 #10, #12–#18, #21, #22 | Done 2026-11-21 (batch 2) |
| P2 #11, #19, #20 | Open |
| Features 2, 3, 5, 6, 8 (auto FX, Repeat/Recent, recap, reconcile, undo) | Done 2026-11-21 (batch 2) |
| Features 1 (budgets), 4 (nudge), 7 (receipt) | Open (1 and 4 skipped by Isaac for now) |
| Unknown writer of demo `Bank` + `Salary` rows | Explained: the recurring-income work (`16e9821`) ran against the same demo |

## Follow-ups from Codex review (2026-11-21, not fixed)

- Amount hints vs calculator: `1÷0.0` / `1÷.0` say "Enter an amount"; Done on `1÷0` replaces the expression with `0` (`components/AddEntry/AmountInput.tsx:28`). Fix: calculator returns valid / incomplete / invalid.
- Toasts: each route change restarts the 1.5 s timer; same-path navigation keeps the 5 s life (`components/Toast.tsx`). Fix: per-toast expiry.
- Settle prefill from Friend detail (initial `amount` state) still uses the HKD balance even if the default account is non-HKD. Chip and friend-pick autofill are fixed.
- Editing a non-HKD settlement and switching to Offset keeps the old currency.
- A11y: `NeoInput` labels are not linked to inputs (no `htmlFor`/`id`), app-wide.

## Next-up ranking (2026-11-21)

Order: wrong numbers first, then speed of daily logging, then polish.

1. **Correctness batch (small):** settle prefill currency, Offset keeps old currency, friend-history sign mismatch (#12), `1÷0` Done wipes input, toast timer.
2. **Auto FX rate** for the entry date (feature 2).
3. **Repeat last entry / templates** (feature 3).
4. **Keep draft on Back** (#10).
5. **Budgets per category** (feature 1).
6. **Undo after delete** (feature 8).
7. **Monthly recap** (feature 5).
8. **Account reconcile** (feature 6).
9. **Polish batch:** #13, #14, #15, #16, #17, #18, #21, #22, `NeoInput` label a11y.
10. **Nudge friend** (feature 4).
11. **Later:** desktop layout (#20), Agent access CLI text (#19), amount cap (#11), receipt photo (feature 7).

## Accepted trade-offs (batch 2, Codex-reviewed)

- Reconcile adjustment accounts are identified by name (`utils/entryForm.ts` `isAdjustmentAccount`), no migration. The CLI can still unarchive one (`accounts archive --unarchive`); if that happens its balance enters net worth.
- Two devices reconciling the same account at once can overshoot (single user).
- Offline delete vs outbox replay race is pre-existing; Undo is only offered for synced entries deleted online.
- Undo restores with a new `created_at`.
- Full-chip settlement in a foreign currency can leave a sub-cent residual; the UI shows "Up to … · leaves HK$x".
