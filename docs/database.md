# Database

[Supabase migrations](../supabase/migrations/) define the PostgreSQL schema. See [deployment instructions](../README.md#deploy) for migration commands and privilege checks.

## Ledger tables

| Table | Purpose |
| --- | --- |
| `accounts` | Wallet accounts with a currency, archive status, and sort order. |
| `categories` | Expense and income labels, with optional icon and color. |
| `entries` | Expenses, income, transfers, and settlements. Each entry has a currency and an exchange rate to HKD. |
| `entry_shares` | Amounts friends owe on an expense. The owner's expense is the total less these shares. |
| `subscriptions` | Recurring expenses with a cadence, next due date, and active flag. |
| `friends` | Contacts. Balances are derived from the ledger. |

Owner-only RLS uses `user_id`. Composite foreign keys enforce ownership across ledger references. Anonymous roles have no public table grants. Entry constraints enforce the shape of each kind. Triggers enforce share totals and account currency rules. Transfers require matching currencies. A settlement without an account offsets a friend balance.

Realtime requires the six live tables in the `supabase_realtime` publication. The money tracker migration adds the five ledger tables and the demo base schema adds `friends`. See [Architecture](architecture.md#state-and-data-flow) for the client subscriptions.

`transactions` and `custom_types` are a read-only legacy snapshot. See [Cutover](cutover.md) for the backfill and reconciliation.

## RPCs

- `save_entry(p_entry, p_shares)` writes an entry and replaces its shares atomically.
- `import_ensure_targets(p_accounts, p_categories)` finds or creates import targets using case-insensitive names. It serializes target resolution per owner and returns IDs.
- `clear_my_data()` deletes the signed-in owner's entries and their shares, subscriptions, friends, and legacy transactions.
- Browser agent RPCs inspect and decide approval requests (`agent_browser_request`, `decide_agent_request`) and manage tokens (`create_agent_token`, `update_agent_scopes`, `revoke_agent_token`).
- The Edge Function dispatches to the service-role RPCs `run_agent_connection`, `run_agent_management`, and `run_agent_money`. See [Agent access](agent.md) for scopes and approvals.

## Subscription posting

The pg_cron job `post-due-subscriptions` runs `post_due_subscriptions()` daily at 00:00 UTC (08:00 Hong Kong time). It posts each missed due date for active subscriptions and advances `next_date`. The request ID is deterministic for each subscription and due date. Each subscription runs in a separate subtransaction. Failures are logged and retried on the next run.
