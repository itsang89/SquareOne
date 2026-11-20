# Cutover: legacy friend ledger → money tracker

Completed 2026-11-21. Kept as the record of how the legacy ledger was migrated.

Order matters. The old app and the old agent API write `transactions` / `custom_types`; the new app and the CLI write `entries`.

1. **Back up** (run the backup workflow, `docs/backups.md`).
2. **Audit production first** (read-only SQL). The first three queries must return 0. The primary-key check must return 1.
   ```sql
   -- legacy rows pointing at another user's friend (migration aborts on these; repair or delete explicitly)
   select count(*) from transactions t join friends f on f.id = t.friend_id and f.user_id <> t.user_id;
   -- payer_id = 'me' (old agent API; the old app showed it as the friend paying): decide each row
   select count(*) from transactions where payer_id = 'me';
   -- amounts the new model cannot hold exactly (null, sub-cent, >= 10^10)
   select count(*) from transactions where amount is null or amount <> round(amount, 2) or abs(amount) >= 10000000000;
   -- the composite FK needs friends(id) to be the primary key (plain ADD CONSTRAINT takes a short strong lock)
   select count(*) from pg_constraint where conrelid = 'public.friends'::regclass and contype = 'p';  -- expect 1
   ```
   Record each friend's balance from the old app. They are compared again in step 4.
3. **Stop the old app.** Tell yourself (and any phone with the old app) not to post. Writes are also blocked by the database in the next step, so a stray post fails loudly instead of being lost.
4. **Apply the migrations** (see [Deploy](../README.md#deploy) for the production `psql` procedure). `20261121500000_review_fixes.sql`:
   - adds the owner-matching FK on `transactions`;
   - **revokes insert/update/delete on `transactions` and `custom_types`** from `anon`, `authenticated` and `service_role`: the legacy tables become a read-only snapshot;
   - copies every legacy row that has no entry yet (`migrate_legacy_transactions()`, insert-only; it never touches an existing entry or re-creates a removed share);
   - runs `reconcile_legacy_transactions()`: per friend, legacy balance = balance of the copied entries, otherwise the whole migration rolls back.
   Run `supabase/tests/privileges.sql` afterwards.
5. **Deploy the web app and the Edge Function together** (the Edge Function routes only to `run_agent_money`, `run_agent_management` and `run_agent_connection`; `run_agent_command` is dropped).
6. Compare the friend balances to step 2 in the new app. Do **not** re-run `reconcile_legacy_transactions()` later: once you edit migrated entries it will (correctly) report differences.

Notes
- Keep the legacy tables for as long as you want a source snapshot. **Settings → Clear data** removes `transactions` too (not `custom_types`), together with entries, subscriptions and friends.
- A friend with any entry or share cannot be deleted (it would rewrite history). There is no friend archive yet; rename instead.
