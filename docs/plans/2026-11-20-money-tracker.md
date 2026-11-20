# SquareOne → personal money tracker

Date: 2026-11-20. Status: approved direction, building on `feature/money-tracker`.

## Goal

One app for all of Isaac's daily money: expenses, income, accounts, subscriptions, and friend loans. It replaces Money+ Cute Expense Tracker. Claude Code logs entries from plain English through the existing agent CLI. It's a self tool: one user, no payments, no guest mode.

## Decisions

- **Me at the center.** Only record what involves me.
- **Only friends owing me is tracked.** If a friend pays for me, I log a normal expense when I pay them back. There's no "I owe" ledger.
- **Every entry is paid by me.** There is no payer field.
- **Splits.** An expense has a total, an account, and optional friend shares (exact amounts). The UI offers "split equally" and "custom amounts" as input helpers, but the database always stores exact amounts.
  - My expense (what stats show) = total − sum of friend shares.
  - Account movement = −total.
  - Each friend's balance goes up by their share.
- **Settlement.** A friend repays: the account goes up, the friend's balance goes down. It's not income. A settlement with no account is an offset, for example "Alex covered my movie, take it off what he owes".
- **Kinds:** `expense`, `income`, `transfer` (account → account), `settlement`.
- **Accounts:** you create them (Bank, Octopus, Mox). Each has a name, a currency, and an `archived` flag. Archived accounts are hidden and left out of net worth.
- **Net worth** = sum of non-archived account balances + what friends owe me. Rough accuracy is fine.
- **Currency.** Each entry stores `currency` and `fx_rate` (rate to HKD, default 1). The UI is HKD-first. Stats use amount × fx_rate.
- **Categories.** Flat, with kind (expense or income), icon/emoji, and color. Seeded from the Money+ import. Replaces `custom_types`.
- **Subscriptions.** A recurring rule: title, amount, category, account, cadence (weekly, monthly, yearly), next date, active. A daily `pg_cron` job posts due entries, so it works with the app closed.
- **Out of scope:** investments, budgets, receipt photos, SMS/email parsing, offline mode, and speed fixes (later).
- **Guest mode is removed.**
- **Backups:** a nightly `pg_dump` to a place Isaac owns.

## Data model (Supabase, all rows have `user_id` + RLS)

```text
accounts(id, user_id, name, currency, archived, sort, created_at)
categories(id, user_id, name, kind, icon, color, archived, sort)
entries(id, user_id, kind, occurred_at timestamptz, title, note,
        amount numeric(12,2) > 0, currency, fx_rate,
        account_id null, to_account_id null, category_id null,
        friend_id null,           -- settlement only
        subscription_id null, request_id unique per user, created_at)
entry_shares(entry_id, friend_id, amount > 0)   -- friends owing me
subscriptions(id, user_id, title, amount, currency, category_id, account_id,
              cadence, next_date, active)
friends (kept)
```

Invariants (enforced with DB checks where cheap):
- transfer: has account and to_account, no shares, no category.
- expense: sum(shares) ≤ amount.
- settlement: has friend.
- income: has account.

## Migration of live data

- **Old `transactions` → `entries`**, preserving every friend's current balance exactly:
  - A row where I paid → an expense with no account, a share for the friend equal to the full amount, and my share 0. It's a receivable only, so it doesn't change stats or accounts. (These purchases are already in Money+ history, so this avoids counting them twice.)
  - A friend-paid row or a settlement → a settlement with no account (an offset), signed so the balance is preserved.
- **Money+ CSV import** (2,065 rows, 2025-01-02 → 2026-11-19; reconciles to Bank 60,878.54, Octopus 360.70, To Be Received 0, futu 20,000):
  - Bank and Octopus become accounts.
  - "To Be Received" and "futu" become archived accounts, keeping history while staying out of daily views.
  - Categories are created as-is. Notes become `note`. Title = category name.
- The old `transactions` table is kept read-only until the cutover is verified, then dropped in a later migration.
- **Cutover to production is Isaac's call.** Back up first, then apply the migrations, run the import, and verify balances.

## Screens (keep the neo-brutalist style)

- **Home:** this month's spent, income, and net. "Friends owe you" total. Recent entries. Big quick-add button.
- **Add entry:** a kind toggle (expense, income, transfer, settle up), then amount (calculator kept), category grid, account, date, title/note. For expenses, "Split with friends" picks friends and shows equal/custom amounts plus a live "your share".
- **Ledger:** entries grouped by day with daily totals. Search and filter by category, account, or friend. Tap to edit or delete.
- **Wallet:** accounts with balances, net worth, and the receivables row. Add, edit, or archive accounts. Tap an account to see its entries.
- **Charts:** month/year switcher. Expense and income donuts by category, with a list and percentages. Tap a category to see its entries. Income vs expense trend (daily within a month, monthly within a year). Net worth over time.
- **Friends:** who owes what, history per friend, settle up (existing screens adapted).
- **Settings:** categories, subscriptions, agent access, export, and sign out.

## Agent (CLI `cli/squareone.mjs`)

- New commands:
  - `accounts list|add|edit|archive`
  - `categories list|add|edit`
  - `entries list|add|edit|delete` (all kinds, `--split friend:amount`, `--split-equal`)
  - `subscriptions list|add|edit|pause`
  - `stats month|range` (totals and by category)
  - `balances`
- The agent can do everything. These need browser approval: deleting an account or friend, bulk clear, and export. Single edits and deletes are allowed and appear in Agent Access activity.
- Permissions are extended to the new resources. Request IDs stay idempotent.

## Build order

1. **Foundation:** migrations, legacy migration with a balance-preservation test, types, data layer, pure calc functions with Vitest, guest mode removed.
2. In parallel, after step 1:
   - (a) Add entry, Ledger, Wallet, accounts and categories management.
   - (b) Charts and Home stats.
   - (c) CLI, RPC and permissions, plus `docs/agent.md`.
   - (d) Money+ import script, subscriptions cron, backup job.
3. Integrate, then run an end-to-end test in the local demo (`supabase/demo/start.sh`): add a split dinner, repay, check balances; the agent logs from plain English; the import reconciles to the numbers above.
4. Isaac approves the production cutover.
