# Database Schema

SquareOne uses Supabase (PostgreSQL) for data storage. The schema is designed to be simple and efficient for tracking personal debts between friends.

## Tables

### 1. `friends`
Stores the list of friends added by a user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (owner of the friend) |
| `name` | Text | Display name of the friend |
| `avatar` | Text | URL or identifier for the friend's avatar |
| `created_at` | Timestamp | When the friend was added |

### 2. `transactions`
Stores all expenses and settlement records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (owner of the transaction) |
| `title` | Text | Description of the expense |
| `amount` | Numeric | The total amount of the transaction |
| `date` | Timestamp | Date of the transaction |
| `type` | Text | Category (e.g., 'Meal', 'Transport', 'Settlement') |
| `payer_id` | UUID/Text | ID of the person who paid ('me' or friend UUID) |
| `friend_id` | UUID | ID of the friend involved in the transaction |
| `note` | Text | Optional additional details |
| `is_settlement` | Boolean | Flag to indicate if this is a "Settle Up" transaction |

### 3. `custom_types`
User-defined transaction category labels (e.g. custom “Loan” variants). Synced per account so they appear on every device after login.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (owner) |
| `name` | Text | Display label (unique per user) |
| `created_at` | Timestamp | When the type was created |

**Constraints:** `UNIQUE(user_id, name)` prevents duplicates per user.

**RLS:** Users can only `SELECT` / `INSERT` / `UPDATE` / `DELETE` rows where `user_id = auth.uid()`.

**Real-time:** Add `custom_types` to the `supabase_realtime` publication (Dashboard → Database → Publications) so the app stays in sync across tabs/devices. SQL migration lives in [`supabase/migrations/`](../supabase/migrations/).

## Relationships

- Each `friend` belongs to a `user` (authenticated via Supabase).
- Each `transaction` belongs to a `user`.
- A `transaction` references a `friend_id` to associate the expense with a specific friend.
- Each `custom_types` row belongs to a `user`.

## Row Level Security (RLS)

To ensure data privacy, RLS should be enabled on all app tables:

- **Friends**: `user_id` must match `auth.uid()`.
- **Transactions**: `user_id` must match `auth.uid()`.
- **Custom types**: `user_id` must match `auth.uid()`.

Example RLS Policy for `friends`:
```sql
CREATE POLICY "Users can only access their own friends"
ON public.friends
FOR ALL
USING (auth.uid() = user_id);
```

## Real-time

Real-time is enabled for `friends`, `transactions`, and (after publication setup) `custom_types` so the frontend stays in sync across multiple tabs or devices.
