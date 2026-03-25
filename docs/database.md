# Database Schema

SquareOne uses Supabase (PostgreSQL) for data storage. The schema is designed to be simple and efficient for tracking personal debts between friends.

> Guest mode does not use this schema — it mirrors the same data shape in `localStorage` via `utils/guestStorage.ts`.

## Tables

### 1. `friends`
Stores the list of friends added by a user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Foreign key to `auth.users` (owner) |
| `name` | `text` | Display name of the friend |
| `avatar` | `text` | Avatar identifier or emoji |
| `created_at` | `timestamptz` | When the friend was added |

**RLS:** Users can only access rows where `user_id = auth.uid()`.

**Real-time:** Enabled via the `supabase_realtime` publication.

---

### 2. `transactions`
Stores all expenses and settlement records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Foreign key to `auth.users` (owner) |
| `title` | `text` | Description of the expense |
| `amount` | `numeric` | Total amount of the transaction |
| `date` | `timestamptz` | Date of the transaction |
| `type` | `text` | Category tag (e.g. `'Meal'`, `'Transport'`, `'Settlement'`) |
| `payer_id` | `text` | Who paid — `'me'` (the current user) or the friend's UUID |
| `friend_id` | `uuid` | The friend involved in the transaction |
| `note` | `text` | Optional additional details |
| `is_settlement` | `boolean` | `true` if this is a Settle Up transaction |

> `payer_id` is `text` rather than `uuid` because it also holds the literal string `'me'` to represent the logged-in user paying.

**RLS:** Users can only access rows where `user_id = auth.uid()`.

**Real-time:** Enabled via the `supabase_realtime` publication.

---

### 3. `custom_types`
User-defined transaction category labels. Synced per account so they appear on every device after login.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key (auto-generated) |
| `user_id` | `uuid` | Foreign key to `auth.users` (owner) |
| `name` | `text` | Display label (unique per user) |
| `created_at` | `timestamptz` | When the type was created |

**Constraints:** `UNIQUE(user_id, name)` prevents duplicate labels per user.

**RLS:** Users can only access rows where `user_id = auth.uid()`.

**Real-time:** Add `custom_types` to the `supabase_realtime` publication (Dashboard → Database → Publications). SQL migration lives in [`supabase/migrations/`](../supabase/migrations/).

---

## Relationships

- Each `friend` belongs to a `user`.
- Each `transaction` belongs to a `user` and references one `friend` via `friend_id`.
- Each `custom_type` belongs to a `user`.

## Row Level Security (RLS)

RLS is enabled on all tables. The same policy pattern applies to `friends`, `transactions`, and `custom_types`:

```sql
CREATE POLICY "Users can only access their own data"
ON public.friends  -- repeat for transactions, custom_types
FOR ALL
USING (auth.uid() = user_id);
```

## Real-time

Real-time subscriptions are used by `AppContext` to keep the frontend in sync across tabs and devices without manual polling. Ensure all three tables (`friends`, `transactions`, `custom_types`) are added to the Supabase real-time publication.
