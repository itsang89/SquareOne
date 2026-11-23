-- Run against the isolated demo database as the DB owner. Fixtures roll back.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  bank uuid := gen_random_uuid();
  friend uuid := gen_random_uuid();
  original uuid := gen_random_uuid();
  delete_request uuid := gen_random_uuid();
  undo_request uuid := gen_random_uuid();
  reconcile_request uuid := gen_random_uuid();
  agent_hash text := repeat('ab', 32);
  other_hash text := repeat('cd', 32);
  scopes text[] := array['entries:write', 'accounts:write', 'stats:read', 'categories:write'];
  reconcile_payload jsonb := jsonb_build_object('id', 'Bank', 'balance', '-45.50');
  result jsonb;
begin
  assert not has_table_privilege('authenticated', 'public.agent_deleted_entries', 'select')
    and not has_table_privilege('service_role', 'public.agent_deleted_entries', 'select'),
    'the API can read deleted entries directly';
  insert into auth.users (id, aud, role, email)
  values (owner_id, 'authenticated', 'authenticated', 'agent-reconcile@example.test');
  insert into public.agent_tokens (user_id, label, token_hash, scopes)
  values (owner_id, 'Agent', decode(agent_hash, 'hex'), scopes),
         (owner_id, 'Other agent', decode(other_hash, 'hex'), array['entries:write', 'accounts:write']);
  insert into public.accounts (id, user_id, name, currency) values (bank, owner_id, 'Bank', 'USD');
  insert into public.friends (id, user_id, name) values (friend, owner_id, 'Alex');
  insert into public.entries (id, user_id, kind, amount, currency, fx_rate, account_id, note)
  values (original, owner_id, 'expense', 20, 'USD', 7.8, bank, 'Private note');
  insert into public.entry_shares (entry_id, friend_id, user_id, amount) values (original, friend, owner_id, 8);

  begin
    perform public.run_agent_money(other_hash, 'accounts.reconcile', reconcile_payload || '{"dry_run":true}');
    raise exception 'reconcile leaked the balance without stats:read';
  exception when sqlstate 'PT403' then null; end;
  result := public.run_agent_money(agent_hash, 'accounts.reconcile', reconcile_payload || '{"dry_run":true}');
  assert result->>'kind' = 'expense' and (result->>'adjustment')::numeric = -25.50
    and (result->>'fx_rate')::numeric = 7.8, 'foreign-currency preview is incorrect';
  assert not exists (select 1 from public.categories where user_id = owner_id), 'preview created a category';
  assert public.agent_account_balance(owner_id, bank) = -20, 'preview changed the balance';
  insert into public.categories (user_id, name, kind, archived) values (owner_id, 'Untracked', 'expense', true);
  reconcile_payload := reconcile_payload || jsonb_build_object('request_id', reconcile_request);
  result := public.run_agent_money(agent_hash, 'accounts.reconcile', reconcile_payload);
  assert result->>'status' = 'reconciled' and public.agent_account_balance(owner_id, bank) = -45.50,
    'reconcile did not reach the target balance';
  assert (select not archived from public.categories where user_id = owner_id and name = 'Untracked'),
    'reconcile did not restore the category';
  result := public.run_agent_money(agent_hash, 'accounts.reconcile', reconcile_payload);
  assert result->>'status' = 'already_completed' and public.agent_account_balance(owner_id, bank) = -45.50,
    'retry changed the balance';
  result := public.run_agent_money(agent_hash, 'accounts.reconcile',
    jsonb_build_object('id', bank, 'balance', 10, 'request_id', gen_random_uuid()));
  assert result->>'kind' = 'income' and public.agent_account_balance(owner_id, bank) = 10,
    'income adjustment did not reach the target balance';

  result := public.run_agent_money(agent_hash, 'entries.delete', jsonb_build_object('id', original, 'request_id', delete_request));
  assert result->>'status' = 'deleted' and result ? 'undo_expires_at' and not result ? 'note',
    'delete did not return an undo deadline or exposed the note';
  assert not exists (select 1 from public.entries where id = original), 'entry survived deletion';
  begin
    perform public.run_agent_money(other_hash, 'entries.undo',
      jsonb_build_object('delete_request_id', delete_request, 'request_id', gen_random_uuid()));
    raise exception 'another connection could undo the deletion';
  exception when sqlstate 'PT404' then null; end;
  result := public.run_agent_money(agent_hash, 'entries.undo',
    jsonb_build_object('delete_request_id', delete_request, 'request_id', undo_request));
  assert result->>'status' = 'restored' and not result ? 'note', 'undo failed or exposed the note';
  assert (select note from public.entries where id = original) = 'Private note', 'undo lost the note';
  assert (select amount from public.entry_shares where entry_id = original and friend_id = friend) = 8, 'undo lost the share';
  result := public.run_agent_money(agent_hash, 'entries.undo',
    jsonb_build_object('delete_request_id', delete_request, 'request_id', undo_request));
  assert result->>'status' = 'already_completed', 'undo was not idempotent';

  delete_request := gen_random_uuid();
  perform public.run_agent_money(agent_hash, 'entries.delete', jsonb_build_object('id', original, 'request_id', delete_request));
  update public.agent_deleted_entries set expires_at = clock_timestamp() where request_id = delete_request;
  begin
    perform public.run_agent_money(agent_hash, 'entries.undo',
      jsonb_build_object('delete_request_id', delete_request, 'request_id', gen_random_uuid()));
    raise exception 'undo accepted an expired deletion';
  exception when sqlstate 'PT404' then null; end;
  perform public.clear_user_data(owner_id);
  assert not exists (select 1 from public.agent_deleted_entries where user_id = owner_id), 'clear left deleted entry snapshots';
end
$$;

rollback;
