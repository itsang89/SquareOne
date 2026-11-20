-- Copy legacy `transactions` into entries/entry_shares, preserving every friend's balance.
-- Legacy balance delta = (payer is me ? +1 : -1) * amount, whether or not is_settlement.
--   delta > 0 -> expense, no account, one share = amount (receivable only; my own expense = 0)
--   delta < 0 -> settlement, no account (offset) for |delta|
-- Entry id = legacy transaction id, so re-running is a no-op. Old tables are kept.
create function public.migrate_legacy_transactions() returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.categories (user_id, name, kind)
  select user_id, btrim(name), 'expense' from public.custom_types where btrim(name) <> ''
  union
  select t.user_id, btrim(t.type), 'expense' from public.transactions t
  where btrim(t.type) <> '' and ((t.payer_id = t.user_id::text or t.payer_id = 'me') = (t.amount > 0))
  on conflict (user_id, kind, name) do nothing;

  insert into public.entries (id, user_id, kind, occurred_at, title, note, amount, friend_id, category_id)
  select t.id, t.user_id,
    case when d.delta > 0 then 'expense' else 'settlement' end,
    t.date, t.title, t.note, abs(d.delta),
    case when d.delta < 0 then t.friend_id end,
    case when d.delta > 0 then c.id end
  from public.transactions t
  cross join lateral (select case when t.payer_id = t.user_id::text or t.payer_id = 'me'
    then t.amount else -t.amount end as delta) d
  left join public.categories c on c.user_id = t.user_id and c.kind = 'expense' and c.name = btrim(t.type)
  where d.delta <> 0
  on conflict (id) do nothing;

  insert into public.entry_shares (entry_id, friend_id, user_id, amount)
  select t.id, t.friend_id, t.user_id, abs(d.delta)
  from public.transactions t
  cross join lateral (select case when t.payer_id = t.user_id::text or t.payer_id = 'me'
    then t.amount else -t.amount end as delta) d
  where d.delta > 0
  on conflict (entry_id, friend_id) do nothing;
end;
$$;
revoke execute on function public.migrate_legacy_transactions() from public, anon, authenticated;

-- Not run here: 20261121500000_review_fixes.sql freezes the legacy tables, replaces this function with a
-- preflighted, insert-only version, then runs it and reconciles (see docs/cutover.md).
