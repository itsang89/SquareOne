-- Privilege matrix. Run after any restore, before exposing the API:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/privileges.sql
do $$
declare
  r record;
  fn text;
begin
  -- (function, role, must be executable)
  for r in select * from (values
    ('public.save_entry(jsonb,jsonb)', 'authenticated', true), ('public.save_entry(jsonb,jsonb)', 'anon', false),
    ('public.clear_my_data()', 'authenticated', true), ('public.clear_my_data()', 'anon', false),
    ('public.import_ensure_targets(jsonb,jsonb)', 'authenticated', true), ('public.import_ensure_targets(jsonb,jsonb)', 'anon', false),
    ('public.agent_browser_request(text,text)', 'authenticated', true), ('public.agent_browser_request(text,text)', 'anon', false),
    ('public.decide_agent_request(text,text,boolean,text[])', 'authenticated', true),
    ('public.decide_agent_request(text,text,boolean,text[])', 'anon', false),
    ('public.run_agent_money(text,text,jsonb)', 'service_role', true), ('public.run_agent_money(text,text,jsonb)', 'authenticated', false),
    ('public.run_agent_money(text,text,jsonb)', 'anon', false),
    ('public.run_agent_management(text,text,jsonb)', 'service_role', true),
    ('public.run_agent_management(text,text,jsonb)', 'authenticated', false),
    ('public.run_agent_connection(text,text,jsonb)', 'service_role', true),
    ('public.run_agent_connection(text,text,jsonb)', 'authenticated', false),
    ('public.clear_user_data(uuid)', 'authenticated', false), ('public.clear_user_data(uuid)', 'service_role', false),
    ('public.agent_friend_balance(uuid,uuid)', 'authenticated', false), ('public.agent_friend_balance(uuid,uuid)', 'anon', false),
    ('public.migrate_legacy_transactions()', 'authenticated', false), ('public.migrate_legacy_transactions()', 'service_role', false),
    ('public.reconcile_legacy_transactions()', 'authenticated', false),
    ('public.issue_agent_session(uuid)', 'authenticated', false), ('public.issue_agent_session(uuid)', 'anon', false)
  ) as t(f, role, want)
  loop
    assert has_function_privilege(r.role, r.f::regprocedure, 'execute') = r.want,
      format('%s execute on %s should be %s', r.role, r.f, r.want);
  end loop;

  -- Frozen legacy tables: readable, not writable through the API roles.
  foreach fn in array array['public.transactions', 'public.custom_types'] loop
    for r in select unnest(array['anon', 'authenticated', 'service_role']) as role loop
      assert not has_table_privilege(r.role, fn, 'insert, update, delete'), format('%s can still write %s', r.role, fn);
    end loop;
  end loop;

  -- New tables: RLS on, API roles can use them, anon cannot.
  foreach fn in array array['accounts', 'categories', 'entries', 'entry_shares', 'subscriptions'] loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || fn)::regclass), fn || ' lost RLS';
    assert has_table_privilege('authenticated', 'public.' || fn, 'select, insert, update, delete'), fn || ': authenticated lacks access';
    assert not has_table_privilege('anon', 'public.' || fn, 'select'), fn || ': anon can read';
  end loop;
  raise notice 'privileges: matrix ok';
end $$;
