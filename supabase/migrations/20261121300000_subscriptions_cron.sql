-- Subscriptions: a daily pg_cron job posts due active subscriptions as expense entries.
-- Idempotent: entry request_id = md5(subscription id || due date), so a due date can never post twice.
-- Catches up every missed period, then moves next_date forward. All dates are Hong Kong local dates.

create extension if not exists pg_cron;

-- The day-of-month the user meant (e.g. 31). next_date alone loses it after a short month (31 Jan → 28 Feb → 28 Mar).
alter table public.subscriptions add column anchor_day smallint;
update public.subscriptions set anchor_day = extract(day from next_date);
alter table public.subscriptions alter column anchor_day set not null;

-- Anyone setting next_date (UI, agent, insert) also sets the anchor; the cron job opts out below.
create function public.subscriptions_set_anchor() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.next_date is distinct from old.next_date then
    if coalesce(current_setting('squareone.cron', true), '') <> 'on' then
      new.anchor_day := extract(day from new.next_date);
    end if;
  end if;
  return new;
end;
$$;
create trigger subscriptions_anchor before insert or update on public.subscriptions
  for each row execute function public.subscriptions_set_anchor();

-- The period after `d`. Monthly/yearly clamp the anchor day to the target month's length.
create function public.next_due_date(d date, cadence text, anchor smallint) returns date
language sql immutable set search_path = '' as $$
  select case cadence
    when 'weekly' then d + 7
    else (
      select (m + (least(anchor, extract(day from (m + interval '1 month' - interval '1 day'))::int) - 1))::date
      from (select (date_trunc('month', d) + case cadence when 'yearly' then interval '1 year' else interval '1 month' end)::date as m) t
    )
  end;
$$;

create function public.post_due_subscriptions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Hong_Kong')::date;
  s public.subscriptions;
  due date;
  posted integer := 0;
  n integer;
begin
  perform set_config('squareone.cron', 'on', true);
  for s in select * from public.subscriptions where active and next_date <= today for update skip locked loop
    due := s.next_date;
    while due <= today loop
      insert into public.entries (user_id, kind, occurred_at, title, amount, currency, fx_rate,
          account_id, category_id, subscription_id, request_id)
      values (s.user_id, 'expense', (due::timestamp + interval '9 hours') at time zone 'Asia/Hong_Kong', s.title,
          s.amount, s.currency, s.fx_rate, s.account_id, s.category_id, s.id, md5(s.id::text || due::text)::uuid)
      on conflict (user_id, request_id) do nothing;
      get diagnostics n = row_count;
      posted := posted + n;
      due := public.next_due_date(due, s.cadence, s.anchor_day);
    end loop;
    update public.subscriptions set next_date = due where id = s.id;
  end loop;
  return posted;
end;
$$;
revoke execute on function public.post_due_subscriptions() from public, anon, authenticated;
grant execute on function public.post_due_subscriptions() to service_role;

-- 00:00 UTC = 08:00 HKT. Named jobs are replaced on re-run.
select cron.schedule('post-due-subscriptions', '0 0 * * *', 'select public.post_due_subscriptions()');
