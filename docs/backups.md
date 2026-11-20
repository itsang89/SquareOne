# Backups, import, subscriptions

`.github/workflows/backup.yml` runs nightly (03:00 HKT) and on demand. It runs `pg_dump` on the Supabase database (schemas `public` and `auth`), encrypts it with AES-256, and uploads it as the artifact `squareone-db-backup`. GitHub keeps it 30 days.

The repo `itsang89/SquareOne` is **public** (checked 2026-11-20). Anyone signed in to GitHub can download a public repo's artifacts, so the dump is always encrypted. If `BACKUP_PASSPHRASE` is missing, the job fails instead of uploading a plain dump.

## Set up (once)

1. Supabase dashboard → **Connect** → copy the **Session pooler** URI (port 5432). GitHub runners have no IPv6, and the direct `db.<ref>.supabase.co` host is IPv6-only. Put the DB password in it.
2. Make a long random passphrase and store it in your password manager. Without it the backups are useless: `openssl rand -base64 32`.
3. Add both as repo secrets (**Settings → Secrets and variables → Actions**):
   ```bash
   gh secret set SUPABASE_DB_URL      # paste the pooler URI
   gh secret set BACKUP_PASSPHRASE    # paste the passphrase
   gh workflow run backup.yml         # test run
   ```
4. Check the first run is green and the artifact exists.

GitHub disables scheduled workflows after 60 days without repo activity. Re-enable in the **Actions** tab if that happens.

## Restore

```bash
gh run download -n squareone-db-backup          # or download the artifact in the browser
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE \
  -in squareone-2026-11-20.dump.enc -out squareone.dump
# Into an EMPTY database (a new Supabase project, or the local demo):
pg_restore --no-owner --no-privileges --dbname "$TARGET_DB_URL" squareone.dump
```

`schema "public" already exists` is harmless; everything else restores. Verified 2026-11-20 against the local demo (dump → encrypt → decrypt → restore: entries and users match). Restoring into a fresh *hosted* Supabase project is untested: its `auth` schema already exists, so expect extra "already exists" errors. Try `pg_restore --clean --if-exists` there, and check row counts afterwards.

Delete `squareone.dump` after use. It is unencrypted.

# Money+ import

**Profile → Import from Money+** takes the Money+ CSV export, shows a preview (counts, resulting account balances, categories to create, date range), then imports in batches of 500 rows.

- Expense/Income → entries; missing categories are created with the right kind; title = category; Money+ note → `note`. Transfer → transfer between accounts. Accounts are created by name; `To Be Received` and `futu` are created archived. Timestamps are HKT (+08:00).
- Safe to re-run: each row's `request_id` is a UUID hashed from its content and position, so a second import of the same file adds 0 rows.
- Zero-amount bills (the real export has 2) are skipped; the database requires `amount > 0` and they move no money.
- Reconciliation against the real export on the local demo: Bank 60,878.54, Octopus 360.70, To Be Received 0, futu 20,000; 1,544 expenses, 417 income, 102 transfers (the expected 1,545/418 minus the two zero rows).

# Subscriptions cron

Migration `20261121300000_subscriptions_cron.sql` schedules `post_due_subscriptions()` daily at 00:00 UTC (08:00 HKT) via `pg_cron`. Hosted Supabase: enable the `pg_cron` extension if the migration asks.

For each active subscription with `next_date` ≤ today (HK date) it posts one expense entry per missed period (09:00 HKT on the due date), then moves `next_date` past today. `request_id = md5(subscription id || due date)`, so a period never posts twice. Month-end: `anchor_day` remembers the intended day (31), so 31 Jan → 28 Feb → 31 Mar. A trigger resets the anchor whenever `next_date` is edited by anyone but the cron. Run it by hand: `select public.post_due_subscriptions();`.
