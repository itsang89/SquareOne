-- One bad subscription (e.g. currency ≠ its account's) must not roll back every other due post.
-- Each subscription runs in its own subtransaction; a failure is logged and retried next day.
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
        values (s.user_id, 'expense', (due::timestamp + interval '9 hours') at time zone 'Asia/Hong_Kong', s.title,
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
