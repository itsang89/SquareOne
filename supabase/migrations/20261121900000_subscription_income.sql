-- Recurring income: a subscription can now be income. The daily job posts it with the same kind.
-- Income needs an account (entries_income_shape); a bad row is skipped by the per-subscription isolation below.
alter table public.subscriptions add column kind text not null default 'expense' check (kind in ('expense', 'income'));

create or replace function public.post_due_subscriptions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Hong_Kong')::date;
  s public.subscriptions;
  due date;
  posted integer := 0;
  mine integer;
  n integer;
begin
  perform set_config('squareone.cron', 'on', true);
  for s in select * from public.subscriptions where active and next_date <= today for update skip locked loop
    begin
      mine := 0;
      due := s.next_date;
      while due <= today loop
        insert into public.entries (user_id, kind, occurred_at, title, amount, currency, fx_rate,
            account_id, category_id, subscription_id, request_id)
        values (s.user_id, s.kind, (due::timestamp + interval '9 hours') at time zone 'Asia/Hong_Kong', s.title,
            s.amount, s.currency, s.fx_rate, s.account_id, s.category_id, s.id, md5(s.id::text || due::text)::uuid)
        on conflict (user_id, request_id) do nothing;
        get diagnostics n = row_count;
        mine := mine + n;
        due := public.next_due_date(due, s.cadence, s.anchor_day);
      end loop;
      update public.subscriptions set next_date = due where id = s.id;
      posted := posted + mine;
    exception when others then
      raise warning 'post_due_subscriptions: subscription % skipped: %', s.id, sqlerrm;
    end;
  end loop;
  return posted;
end;
$$;
revoke execute on function public.post_due_subscriptions() from public, anon, authenticated;
grant execute on function public.post_due_subscriptions() to service_role;

-- Agent/CLI: subscriptions.add/edit accept kind, list returns it, category follows kind, income needs an account.
-- Patches the live function text in place (it is ~450 lines); each anchor must match or the migration aborts.
do $patch$
declare
  d text := pg_get_functiondef('public.run_agent_money(text,text,jsonb)'::regprocedure);
  o text[] := array[
    $q$when 'subscriptions.add' then array['title',$q$,
    $q$when 'subscriptions.edit' then array['id', 'title',$q$,
    $q$s.cadence, s.next_date, s.active,$q$,
    $q$raise sqlstate 'PT400' using message = 'Cadence must be weekly, monthly or yearly.';
      end if;$q$,
    $q$agent_pick(uid, 'category', p_payload->>'category', 'expense')$q$,
    $q$      if p_operation = 'subscriptions.add' then
        insert into public.subscriptions (user_id, title,$q$,
    $q$values (uid, btrim(p_payload->>'title'),$q$,
    $q$update public.subscriptions set title = coalesce$q$];
  n text[] := array[
    $q$when 'subscriptions.add' then array['title', 'kind',$q$,
    $q$when 'subscriptions.edit' then array['id', 'kind', 'title',$q$,
    $q$s.kind, s.cadence, s.next_date, s.active,$q$,
    $q$raise sqlstate 'PT400' using message = 'Cadence must be weekly, monthly or yearly.';
      end if;
      if p_payload ? 'kind' and p_payload->>'kind' not in ('expense', 'income') then
        raise sqlstate 'PT400' using message = 'Kind must be expense or income.';
      end if;$q$,
    $q$agent_pick(uid, 'category', p_payload->>'category',
            coalesce(p_payload->>'kind', (select s.kind from public.subscriptions s where s.id = subject and s.user_id = uid), 'expense'))$q$,
    $q$      if coalesce(p_payload->>'kind', (select s.kind from public.subscriptions s where s.id = subject and s.user_id = uid), 'expense') = 'income'
          and (case when p_payload ? 'account' then acct else (select s.account_id from public.subscriptions s where s.id = subject and s.user_id = uid) end) is null then
        raise sqlstate 'PT400' using message = 'An income subscription needs --account.';
      end if;
      if p_operation = 'subscriptions.add' then
        insert into public.subscriptions (user_id, kind, title,$q$,
    $q$values (uid, coalesce(p_payload->>'kind', 'expense'), btrim(p_payload->>'title'),$q$,
    $q$update public.subscriptions set kind = coalesce(p_payload->>'kind', kind), title = coalesce$q$];
  i int;
begin
  for i in 1..array_length(o, 1) loop
    if position(o[i] in d) = 0 then raise exception 'run_agent_money patch % not found', i; end if;
    d := replace(d, o[i], n[i]);
  end loop;
  execute d;
end
$patch$;
