-- Local fixture for the app tables that predate the repository's migrations.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default '',
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references public.friends(id) on delete cascade,
  payer_id text not null,
  title text not null,
  amount numeric not null,
  date timestamptz not null,
  type text not null,
  note text,
  is_settlement boolean not null default false
);

alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.transactions enable row level security;
create policy own_profile on public.profiles for all to authenticated using (id = auth.uid());
create policy own_friends on public.friends for all to authenticated using (user_id = auth.uid());
create policy own_transactions on public.transactions for all to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.profiles, public.friends, public.transactions to authenticated, service_role;
alter publication supabase_realtime add table public.friends, public.transactions;
