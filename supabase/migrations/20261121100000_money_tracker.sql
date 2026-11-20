-- Money tracker model: accounts, categories, entries (+friend shares), subscriptions.
-- Every row is owned by one user. Composite (id, user_id) keys make cross-user references impossible.

alter table public.friends add constraint friends_id_user_key unique (id, user_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  currency text not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  archived boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('expense', 'income')),
  icon text,
  color text,
  archived boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(14,6) not null default 1 check (fx_rate > 0),
  category_id uuid,
  account_id uuid,
  cadence text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  next_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer', 'settlement')),
  occurred_at timestamptz not null default now(),
  title text not null default '',
  note text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(14,6) not null default 1 check (fx_rate > 0),
  account_id uuid,
  to_account_id uuid,
  category_id uuid,
  friend_id uuid,
  subscription_id uuid,
  request_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, request_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (friend_id, user_id) references public.friends (id, user_id) on delete cascade,
  foreign key (subscription_id, user_id) references public.subscriptions (id, user_id) on delete set null (subscription_id),
  -- Invariants per kind
  constraint entries_transfer_shape check (kind <> 'transfer' or
    (account_id is not null and to_account_id is not null and account_id <> to_account_id
     and category_id is null and friend_id is null)),
  constraint entries_income_shape check (kind <> 'income' or
    (account_id is not null and to_account_id is null and friend_id is null)),
  constraint entries_expense_shape check (kind <> 'expense' or (to_account_id is null and friend_id is null)),
  constraint entries_settlement_shape check (kind <> 'settlement' or
    (friend_id is not null and to_account_id is null and category_id is null))
);

create table public.entry_shares (
  entry_id uuid not null,
  friend_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  primary key (entry_id, friend_id),
  foreign key (entry_id, user_id) references public.entries (id, user_id) on delete cascade,
  foreign key (friend_id, user_id) references public.friends (id, user_id) on delete cascade
);

create index entries_user_occurred_idx on public.entries (user_id, occurred_at desc);
create index entries_account_idx on public.entries (account_id) where account_id is not null;
create index entries_to_account_idx on public.entries (to_account_id) where to_account_id is not null;
create index entries_friend_idx on public.entries (friend_id) where friend_id is not null;
create index entry_shares_friend_idx on public.entry_shares (friend_id);
create index entry_shares_user_idx on public.entry_shares (user_id);
create index accounts_user_idx on public.accounts (user_id);
create index categories_user_idx on public.categories (user_id);
create index subscriptions_user_next_idx on public.subscriptions (user_id, next_date);

-- Cross-table invariant: shares only on expenses, and sum(shares) <= amount.
-- Deferred so a transaction can write the entry and its shares in any order.
create function public.check_entry_shares() returns trigger
language plpgsql set search_path = '' as $$
declare
  eid uuid := coalesce(to_jsonb(new)->>'entry_id', to_jsonb(new)->>'id')::uuid;
  e public.entries;
  total numeric;
begin
  select * into e from public.entries where id = eid;
  if not found then return null; end if;
  select coalesce(sum(amount), 0) into total from public.entry_shares where entry_id = eid;
  if total > 0 and e.kind <> 'expense' then
    raise exception 'Only expenses can have friend shares' using errcode = 'check_violation';
  end if;
  if total > e.amount then
    raise exception 'Friend shares (%) exceed the entry amount (%)', total, e.amount using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger entry_shares_check after insert or update on public.entry_shares
  deferrable initially deferred for each row execute function public.check_entry_shares();
create constraint trigger entries_shares_check after update of amount, kind on public.entries
  deferrable initially deferred for each row execute function public.check_entry_shares();

-- RLS: owner only.
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entries enable row level security;
alter table public.entry_shares enable row level security;

create policy own_accounts on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_categories on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_subscriptions on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_entries on public.entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_entry_shares on public.entry_shares for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.accounts, public.categories, public.subscriptions,
  public.entries, public.entry_shares to authenticated, service_role;

-- Atomic entry write: upserts the entry and replaces its shares (RLS applies; runs as the caller).
-- p_entry keys: id?, kind, occurred_at, title, note, amount, currency, fx_rate, account_id,
-- to_account_id, category_id, friend_id, subscription_id, request_id. p_shares: [{friend_id, amount}].
create function public.save_entry(p_entry jsonb, p_shares jsonb default '[]')
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  eid uuid := coalesce((p_entry->>'id')::uuid, gen_random_uuid());
begin
  if uid is null then
    raise sqlstate 'PT401' using message = 'Sign in to save entries.';
  end if;
  insert into public.entries (id, user_id, kind, occurred_at, title, note, amount, currency, fx_rate,
      account_id, to_account_id, category_id, friend_id, subscription_id, request_id)
  values (eid, uid, p_entry->>'kind', coalesce((p_entry->>'occurred_at')::timestamptz, now()),
      coalesce(p_entry->>'title', ''), p_entry->>'note', (p_entry->>'amount')::numeric,
      coalesce(p_entry->>'currency', 'HKD'), coalesce((p_entry->>'fx_rate')::numeric, 1),
      (p_entry->>'account_id')::uuid, (p_entry->>'to_account_id')::uuid, (p_entry->>'category_id')::uuid,
      (p_entry->>'friend_id')::uuid, (p_entry->>'subscription_id')::uuid, (p_entry->>'request_id')::uuid)
  on conflict (id) do update set kind = excluded.kind, occurred_at = excluded.occurred_at,
      title = excluded.title, note = excluded.note, amount = excluded.amount, currency = excluded.currency,
      fx_rate = excluded.fx_rate, account_id = excluded.account_id, to_account_id = excluded.to_account_id,
      category_id = excluded.category_id, friend_id = excluded.friend_id,
      subscription_id = excluded.subscription_id
  where public.entries.user_id = uid;
  delete from public.entry_shares where entry_id = eid and user_id = uid;
  insert into public.entry_shares (entry_id, friend_id, user_id, amount)
  select eid, (s->>'friend_id')::uuid, uid, (s->>'amount')::numeric
  from jsonb_array_elements(coalesce(p_shares, '[]')) s;
  return eid;
end;
$$;
revoke execute on function public.save_entry(jsonb, jsonb) from public, anon;
grant execute on function public.save_entry(jsonb, jsonb) to authenticated;

-- Realtime
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'entries', 'entry_shares', 'subscriptions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
