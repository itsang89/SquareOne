-- Temporary snapshots for undoing CLI deletes without exposing private notes to the agent.
create table public.agent_deleted_entries (
  token_id uuid not null references public.agent_tokens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  entry_data jsonb not null,
  shares_data jsonb not null,
  expires_at timestamptz not null,
  primary key (token_id, request_id)
);
create index agent_deleted_entries_user_idx on public.agent_deleted_entries (user_id);
create index agent_deleted_entries_expiry_idx on public.agent_deleted_entries (expires_at);
alter table public.agent_deleted_entries enable row level security;
revoke all on public.agent_deleted_entries from public, anon, authenticated, service_role;

select cron.schedule('expire-agent-deleted-entries', '*/5 * * * *',
  'delete from public.agent_deleted_entries where expires_at <= clock_timestamp()');

create or replace function public.clear_user_data(p_user uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  -- The agent operations that save, restore or adjust these records take a shared lock.
  perform pg_advisory_xact_lock(hashtextextended('agent-ledger:' || p_user::text, 0));
  delete from public.agent_deleted_entries where user_id = p_user;
  delete from public.entries where user_id = p_user;
  get diagnostics removed = row_count;
  delete from public.subscriptions where user_id = p_user;
  delete from public.friends where user_id = p_user;
  delete from public.transactions where user_id = p_user; -- frozen legacy snapshot goes too
  return removed;
end;
$$;

create function public.agent_delete_entry(p_agent public.agent_tokens, p_id uuid, p_request uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  saved public.entries;
  shares jsonb;
  deadline timestamptz;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('agent-ledger:' || p_agent.user_id::text, 0));
  select * into saved from public.entries
  where id = p_id and user_id = p_agent.user_id for update;
  if not found then raise sqlstate 'PT404' using message = 'Entry not found.'; end if;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]') into shares
  from public.entry_shares s where s.entry_id = p_id and s.user_id = p_agent.user_id;
  delete from public.entries where id = p_id and user_id = p_agent.user_id;

  deadline := clock_timestamp() + interval '10 minutes';
  insert into public.agent_deleted_entries (token_id, user_id, request_id, entry_data, shares_data, expires_at)
  values (p_agent.id, p_agent.user_id, p_request, to_jsonb(saved), shares, deadline);
  return jsonb_build_object('status', 'deleted', 'id', p_id, 'undo_expires_at', deadline);
end;
$$;

create function public.agent_undo_entry_delete(p_agent public.agent_tokens, p_delete_request uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  saved public.agent_deleted_entries;
  restored uuid;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('agent-ledger:' || p_agent.user_id::text, 0));
  delete from public.agent_deleted_entries
  where token_id = p_agent.id and user_id = p_agent.user_id and request_id = p_delete_request
    and expires_at > clock_timestamp()
  returning * into saved;
  if not found then
    raise sqlstate 'PT404' using message = 'No undoable deletion for this request. It may have expired or already been undone.';
  end if;

  insert into public.entries select * from jsonb_populate_record(null::public.entries, saved.entry_data)
  returning id into restored;
  insert into public.entry_shares
  select * from jsonb_populate_recordset(null::public.entry_shares, saved.shares_data);
  return jsonb_build_object('status', 'restored', 'id', restored);
exception when foreign_key_violation or unique_violation or check_violation then
  raise sqlstate 'PT409' using message = 'The entry can no longer be restored. It already exists or its linked records changed.';
end;
$$;

create function public.agent_account_balance(p_user uuid, p_account uuid) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(
    case when e.account_id = p_account then
      case when e.kind in ('expense', 'transfer') then -e.amount else e.amount end
    else 0 end + case when e.to_account_id = p_account then e.amount else 0 end), 0)
  from public.entries e
  where e.user_id = p_user and (e.account_id = p_account or e.to_account_id = p_account);
$$;

create function public.agent_reconcile_account(p_agent public.agent_tokens, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  uid uuid := p_agent.user_id;
  dry boolean := coalesce((p_payload->>'dry_run')::boolean, false);
  balance_text text := btrim(p_payload->>'balance');
  target numeric;
  current_balance numeric;
  adjustment numeric;
  account public.accounts;
  category public.categories;
  entry_kind text;
  entry_title text;
  rate numeric;
  adjustment_id uuid;
  result jsonb;
begin
  if ('entries:write' = any(p_agent.scopes)) is not true then
    raise sqlstate 'PT403' using message = 'This agent lacks the entries:write permission (needed for accounts.reconcile).';
  end if;
  if ('stats:read' = any(p_agent.scopes)) is not true then
    raise sqlstate 'PT403' using message = 'This agent lacks the stats:read permission (needed for accounts.reconcile).';
  end if;
  if balance_text is null or balance_text !~ '^[+-]?([0-9]+(\.[0-9]{1,2})?|\.[0-9]{1,2})$' then
    raise sqlstate 'PT400' using message = 'Give --balance as a number with up to 2 decimal places.';
  end if;
  target := balance_text::numeric;

  -- Serialize adjustments to the same account across agent connections.
  perform pg_advisory_xact_lock_shared(hashtextextended('agent-ledger:' || uid::text, 0));
  select * into account from public.accounts
  where id = public.agent_pick(uid, 'account', p_payload->>'id', null, true) and user_id = uid
  for no key update;
  if not found then raise sqlstate 'PT404' using message = 'Account not found.'; end if;
  current_balance := public.agent_account_balance(uid, account.id);
  adjustment := target - current_balance;
  result := jsonb_build_object('account_id', account.id, 'currency', account.currency,
    'current_balance', current_balance, 'target_balance', target, 'adjustment', adjustment);
  if dry then result := result || jsonb_build_object('dry_run', true); end if;
  if adjustment = 0 then return result || jsonb_build_object('status', 'unchanged'); end if;

  entry_kind := case when adjustment > 0 then 'income' else 'expense' end;
  entry_title := case entry_kind when 'income' then 'Untracked income' else 'Untracked spending' end;
  if abs(adjustment) >= 10000000000 then
    raise sqlstate 'PT400' using message = 'The adjustment is too large for a single entry.';
  end if;
  rate := 1;
  if account.currency <> 'HKD' then
    select e.fx_rate into rate from public.entries e where e.user_id = uid and e.currency = account.currency
    order by e.occurred_at desc, e.id limit 1;
    if rate is null then
      raise sqlstate 'PT409' using message = format('No %s rate yet. Log an entry in %s first.', account.currency, account.currency);
    end if;
  end if;
  result := result || jsonb_build_object('kind', entry_kind, 'category', 'Untracked', 'fx_rate', rate);
  if dry then return result || jsonb_build_object('status', 'preview'); end if;

  select * into category from public.categories c
  where c.user_id = uid and c.kind = entry_kind and c.name = 'Untracked' for no key update;
  if not found or category.archived then
    if ('categories:write' = any(p_agent.scopes)) is not true then
      raise sqlstate 'PT403' using message = 'Creating or restoring the Untracked category requires categories:write.';
    end if;
    insert into public.categories (user_id, kind, name, icon, color, sort)
    values (uid, entry_kind, 'Untracked', '❓', '#D4D4D8',
      coalesce((select max(c.sort) + 1 from public.categories c where c.user_id = uid), 0))
    on conflict (user_id, kind, name) do update set archived = false
    returning * into category;
  end if;

  insert into public.entries (user_id, kind, title, amount, currency, fx_rate, account_id, category_id)
  values (uid, entry_kind, entry_title, abs(adjustment), account.currency, rate, account.id, category.id)
  returning id into adjustment_id;
  return result || jsonb_build_object('status', 'reconciled', 'id', adjustment_id);
end;
$$;

revoke execute on function public.agent_delete_entry(public.agent_tokens, uuid, uuid),
  public.agent_undo_entry_delete(public.agent_tokens, uuid), public.agent_account_balance(uuid, uuid),
  public.agent_reconcile_account(public.agent_tokens, jsonb) from public, anon, authenticated, service_role;

-- Extend the dispatcher in place, preserving the scope checks, write deduplication and activity log.
do $patch$
declare
  definition text := pg_get_functiondef('public.run_agent_money(text,text,jsonb)'::regprocedure);
  old_fragments text[] := array[
    $q$when 'accounts.delete' then 'accounts:delete'$q$,
    $q$when 'entries.delete' then 'entries:write'$q$,
    $q$when 'accounts.delete' then array['id']$q$,
    $q$when 'entries.delete' then array['id']$q$,
    $q$if p_operation = 'entries.add' or p_operation = 'entries.edit' then$q$,
    $q$coalesce((select sum(
              case when e.account_id = a.id then (case when e.kind in ('expense', 'transfer') then -e.amount else e.amount end) else 0 end
              + case when e.to_account_id = a.id then e.amount else 0 end)
            from public.entries e where e.user_id = uid and (e.account_id = a.id or e.to_account_id = a.id)), 0) as balance$q$,
    $q$    when 'entries.delete' then
      delete from public.entries where id = (p_payload->>'id')::uuid and user_id = uid returning id into subject;
      if subject is null then raise sqlstate 'PT404' using message = 'Entry not found.'; end if;
      result := jsonb_build_object('status', 'deleted', 'id', subject);$q$
  ];
  new_fragments text[] := array[
    $q$when 'accounts.delete' then 'accounts:delete'
    when 'accounts.reconcile' then 'accounts:write'$q$,
    $q$when 'entries.delete' then 'entries:write' when 'entries.undo' then 'entries:write'$q$,
    $q$when 'accounts.delete' then array['id']
    when 'accounts.reconcile' then array['id', 'balance', 'dry_run']$q$,
    $q$when 'entries.delete' then array['id']
    when 'entries.undo' then array['delete_request_id']$q$,
    $q$if p_operation in ('entries.add', 'entries.edit', 'accounts.reconcile') then$q$,
    $q$public.agent_account_balance(uid, a.id) as balance$q$,
    $q$    when 'entries.delete' then
      result := public.agent_delete_entry(agent, (p_payload->>'id')::uuid, requested);
      subject := (result->>'id')::uuid;
    when 'entries.undo' then
      result := public.agent_undo_entry_delete(agent, (p_payload->>'delete_request_id')::uuid);
      subject := (result->>'id')::uuid;
    when 'accounts.reconcile' then
      result := public.agent_reconcile_account(agent, p_payload);
      if result ? 'dry_run' then return result; end if;
      subject := (result->>'id')::uuid;$q$
  ];
begin
  for i in 1..cardinality(old_fragments) loop
    if position(old_fragments[i] in definition) = 0 then
      raise exception 'run_agent_money reconcile/undo patch % not found', i;
    end if;
    definition := replace(definition, old_fragments[i], new_fragments[i]);
  end loop;
  execute definition;
end
$patch$;
