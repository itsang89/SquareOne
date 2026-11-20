-- Assertions for 20261121500000_review_fixes.sql. Runs as the DB owner and rolls everything back:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/review_fixes.sql
begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'rf-a@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'rf-b@example.test');
insert into public.friends (id, user_id, name) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', 'Alex'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a1', 'Ben');

do $$
declare
  a constant uuid := '00000000-0000-0000-0000-0000000000a1';
  b constant uuid := '00000000-0000-0000-0000-0000000000b1';
  alex constant uuid := '00000000-0000-0000-0000-00000000f001';
  ben constant uuid := '00000000-0000-0000-0000-00000000f002';
  n integer;
  failed boolean;
begin
  -- #2: a legacy transaction cannot reference another owner's friend.
  begin
    insert into public.transactions (user_id, friend_id, payer_id, title, amount, date, type)
    values (b, alex, b::text, 'x', 1, now(), 'Food');
    raise exception 'cross-owner legacy insert was accepted';
  exception when foreign_key_violation then null; end;

  -- #5: odd values the old app accepted. Zero, negative, friend payer, 65-char label, null title.
  insert into public.transactions (user_id, friend_id, payer_id, title, amount, date, type) values
    (a, alex, a::text, 'dinner', 100, now(), 'Food'),                 -- +100 (receivable)
    (a, alex, alex::text, 'repay', 30, now(), 'General'),             -- -30
    (a, alex, a::text, 'zero', 0, now(), 'Food'),                     -- 0, skipped
    (a, alex, a::text, 'neg', -20, now(), 'Food'),                    -- -20 (negative amount, I paid)
    (a, ben, alex::text, 'odd payer', 5, now(), repeat('x', 65)),     -- payer is neither me nor ben: friend paid, -5; long label
    (a, ben, a::text, '', 50, now(), repeat('y', 65));              -- empty title, positive, 65-char category
  perform public.migrate_legacy_transactions();
  perform public.reconcile_legacy_transactions();
  assert public.agent_friend_balance(a, alex) = 50, 'alex balance ' || public.agent_friend_balance(a, alex);
  assert public.agent_friend_balance(a, ben) = 45, 'ben balance ' || public.agent_friend_balance(a, ben);
  assert (select count(*) from public.entries where user_id = a) = 5, 'zero row skipped';
  -- rerun is a no-op and never touches an entry edited in the new model
  update public.entries set title = 'edited' where title = 'dinner' and user_id = a;
  delete from public.entry_shares where entry_id in (select id from public.entries where title = 'edited');
  assert public.migrate_legacy_transactions() = 0, 'rerun copied rows';
  assert (select count(*) from public.entry_shares where user_id = a) = 1, 'rerun resurrected a removed share';

  -- #5: values the new model cannot hold exactly abort with a clear message.
  insert into public.transactions (user_id, friend_id, payer_id, title, amount, date, type)
  values (a, alex, a::text, 'cents', 1.005, now(), 'Food');
  failed := false;
  begin perform public.legacy_preflight(); exception when others then failed := true; end;
  assert failed, 'sub-cent amount passed preflight';
  delete from public.transactions where title = 'cents';
  insert into public.transactions (user_id, friend_id, payer_id, title, amount, date, type) values (a, alex, 'me', 'me', 1, now(), 'Food');
  failed := false;
  begin perform public.legacy_preflight(); exception when others then failed := true; end;
  assert failed, 'literal me payer passed preflight';
  delete from public.transactions where payer_id = 'me';

  -- #6: friends with entries/shares cannot be deleted; one with none can.
  failed := false;
  begin delete from public.friends where id = alex; exception when check_violation then failed := true; end;
  assert failed, 'friend with history was deleted';
  insert into public.friends (id, user_id, name) values ('00000000-0000-0000-0000-00000000f003', a, 'Cy');
  delete from public.friends where id = '00000000-0000-0000-0000-00000000f003';

  -- #7: entry currency must match its account; transfers need same-currency accounts; currency locks once used.
  insert into public.accounts (id, user_id, name, currency) values
    ('00000000-0000-0000-0000-00000000c001', a, 'HK', 'HKD'), ('00000000-0000-0000-0000-00000000c002', a, 'US', 'USD'),
    ('00000000-0000-0000-0000-00000000c003', a, 'HK2', 'HKD');
  failed := false;
  begin
    insert into public.entries (user_id, kind, amount, account_id, to_account_id)
    values (a, 'transfer', 780, '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c002');
  exception when check_violation then failed := true; end;
  assert failed, 'cross-currency transfer accepted';
  failed := false;
  begin insert into public.entries (user_id, kind, amount, currency, fx_rate, account_id)
    values (a, 'income', 10, 'USD', 7.8, '00000000-0000-0000-0000-00000000c001');
  exception when check_violation then failed := true; end;
  assert failed, 'USD entry on an HKD account accepted';
  insert into public.entries (user_id, kind, amount, account_id, to_account_id)
  values (a, 'transfer', 5, '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c003');
  failed := false;
  begin update public.accounts set currency = 'USD' where id = '00000000-0000-0000-0000-00000000c001';
  exception when check_violation then failed := true; end;
  assert failed, 'currency of a used account changed';

  -- #16: an active subscription blocks deleting its account; a paused one does not.
  insert into public.subscriptions (user_id, title, amount, cadence, next_date, account_id)
  values (a, 'Gym', 10, 'monthly', current_date + 30, '00000000-0000-0000-0000-00000000c002');
  failed := false;
  begin delete from public.accounts where id = '00000000-0000-0000-0000-00000000c002'; exception when check_violation then failed := true; end;
  assert failed, 'account used by an active subscription was deleted';
  update public.subscriptions set active = false where user_id = a;
  delete from public.accounts where id = '00000000-0000-0000-0000-00000000c002';

  -- #17: one clear removes entries, subscriptions, friends and legacy rows.
  insert into public.subscriptions (user_id, title, amount, cadence, next_date) values (a, 'Gym2', 10, 'monthly', current_date + 30);
  perform public.clear_user_data(a);
  assert (select count(*) from public.entries where user_id = a) = 0
     and (select count(*) from public.subscriptions where user_id = a) = 0
     and (select count(*) from public.friends where user_id = a) = 0
     and (select count(*) from public.transactions where user_id = a) = 0, 'clear left rows behind';

  -- Deleting the user still cascades through the guarded tables.
  insert into public.friends (id, user_id, name) values ('00000000-0000-0000-0000-00000000f004', b, 'Dee');
  insert into public.accounts (id, user_id, name) values ('00000000-0000-0000-0000-00000000c004', b, 'B');
  insert into public.subscriptions (user_id, title, amount, cadence, next_date, account_id)
  values (b, 'S', 1, 'monthly', current_date + 30, '00000000-0000-0000-0000-00000000c004');
  insert into public.entries (user_id, kind, amount, title) values (b, 'expense', 10, 'e');
  insert into public.entry_shares (entry_id, friend_id, user_id, amount)
  select id, '00000000-0000-0000-0000-00000000f004', b, 4 from public.entries where user_id = b;
  delete from auth.users where id = b;
  get diagnostics n = row_count;
  assert n = 1, 'user delete blocked by guards';
  raise notice 'review_fixes: all assertions passed';
end $$;

rollback;
