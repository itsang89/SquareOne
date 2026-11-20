-- Agent access for the money-tracker model (accounts, categories, entries, subscriptions, stats).
-- Reuses the connection/token/approval tables from the earlier agent migrations. Every write is
-- idempotent per (token, request_id) via agent_edits and is shown in Agent Access activity.
-- Browser approval is required for: accounts.delete, friends.delete, data.export, data.clear.

-- New scope set. Old transactions:* / settlements:* / categories:add|delete scopes are retired.
create or replace function public.agent_scopes_valid(scopes text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(cardinality(scopes) between 1 and 24 and scopes <@ array[
    'friends:read', 'friends:add', 'friends:edit', 'friends:delete',
    'entries:read', 'entries:write', 'entries:notes', 'stats:read',
    'accounts:read', 'accounts:write', 'accounts:delete',
    'categories:read', 'categories:write',
    'subscriptions:read', 'subscriptions:write',
    'profile:read', 'profile:edit', 'data:export', 'data:clear'
  ], false);
$$;

-- Approval page also needs to name the account being deleted.
create or replace function public.agent_browser_request(p_code text, p_kind text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise sqlstate 'PT401' using message = 'Sign in to continue.';
  end if;
  if p_kind = 'connect' then
    select jsonb_build_object('label', label, 'kind', 'connect') into result
    from public.agent_pairings where user_code = p_code and expires_at > now() and token_id is null;
  elsif p_kind = 'action' then
    select jsonb_build_object('label', t.label, 'kind', 'action', 'operation', a.operation,
      'subject', coalesce(
        (select f.name from public.friends f where f.id = a.subject_id and f.user_id = t.user_id),
        (select x.name from public.accounts x where x.id = a.subject_id and x.user_id = t.user_id))) into result
    from public.agent_approvals a join public.agent_tokens t on t.id = a.token_id
    where a.code = p_code and a.expires_at > now() and a.approved_at is null and a.denied_at is null
      and t.user_id = auth.uid() and t.revoked_at is null and replace(a.operation, '.', ':') = any(t.scopes);
  end if;
  if result is null then
    raise sqlstate 'PT404' using message = 'This request has expired or is unavailable.';
  end if;
  return result;
end;
$$;

-- Timezone for "today", date filters and month buckets (Isaac is HKT). Payloads may override with tz.
create function public.agent_tz() returns text
language sql immutable set search_path = '' as $$ select 'Asia/Hong_Kong'; $$;

-- YYYY-MM-DD means noon that day in the agent timezone (stays on the right day everywhere);
-- a full ISO timestamp is used as given.
create function public.agent_when(p_text text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  if p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return (p_text::date + time '12:00')::timestamp at time zone public.agent_tz();
  elsif p_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:?[0-9]{2})?$' then
    return p_text::timestamptz;
  end if;
  raise sqlstate 'PT400' using message = 'Use a date as YYYY-MM-DD.';
end;
$$;

-- Named things an agent can refer to.
create function public.agent_candidates(p_user uuid, p_what text, p_kind text, p_archived boolean)
returns table (id uuid, name text)
language sql stable set search_path = ''
as $$
  select a.id, a.name from public.accounts a where p_what = 'account' and a.user_id = p_user and (p_archived or not a.archived)
  union all
  select c.id, c.name from public.categories c where p_what = 'category' and c.user_id = p_user
    and (p_archived or not c.archived) and (p_kind is null or c.kind = p_kind)
  union all
  select f.id, f.name from public.friends f where p_what = 'friend' and f.user_id = p_user
  union all
  select s.id, s.title from public.subscriptions s where p_what = 'subscription' and s.user_id = p_user;
$$;

-- Resolve a UUID or a name (exact, case-insensitive; else a unique substring) to an id.
create function public.agent_pick(p_user uuid, p_what text, p_ref text, p_kind text default null,
  p_archived boolean default false, p_missing_ok boolean default false)
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  ref text := btrim(p_ref);
  ids uuid[];
  names text[];
begin
  if ref is null or ref = '' then
    raise sqlstate 'PT400' using message = format('Give a %s name or ID.', p_what);
  end if;
  if ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select array_agg(c.id) into ids from public.agent_candidates(p_user, p_what, p_kind, true) c where c.id = ref::uuid;
  else
    select array_agg(c.id), array_agg(c.name order by c.name) into ids, names
    from public.agent_candidates(p_user, p_what, p_kind, p_archived) c where lower(c.name) = lower(ref);
    if ids is null then
      select array_agg(c.id), array_agg(c.name order by c.name) into ids, names
      from public.agent_candidates(p_user, p_what, p_kind, p_archived) c where position(lower(ref) in lower(c.name)) > 0;
    end if;
  end if;
  if ids is null then
    if p_missing_ok then return null; end if;
    raise sqlstate 'PT404' using message = format('No %s matches "%s". Available: %s', p_what, left(ref, 60),
      coalesce((select string_agg(c.name, ', ' order by c.name)
        from public.agent_candidates(p_user, p_what, p_kind, p_archived) c), 'none'));
  elsif cardinality(ids) > 1 then
    raise sqlstate 'PT400' using message = format('Several %ss match "%s": %s. Use the ID or a more exact name.',
      p_what, left(ref, 60), array_to_string(names, ', '));
  end if;
  return ids[1];
end;
$$;

-- One entry as the agent sees it. Notes are only included when the token may read them.
create function public.agent_entry_json(e public.entries, p_notes boolean)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind,
    'date', (e.occurred_at at time zone public.agent_tz())::date, 'occurred_at', e.occurred_at,
    'title', e.title, 'amount', e.amount, 'currency', e.currency, 'fx_rate', e.fx_rate,
    'account', (select jsonb_build_object('id', a.id, 'name', a.name) from public.accounts a where a.id = e.account_id and a.user_id = e.user_id),
    'to_account', (select jsonb_build_object('id', a.id, 'name', a.name) from public.accounts a where a.id = e.to_account_id and a.user_id = e.user_id),
    'category', (select jsonb_build_object('id', c.id, 'name', c.name) from public.categories c where c.id = e.category_id and c.user_id = e.user_id),
    'friend', (select jsonb_build_object('id', f.id, 'name', f.name) from public.friends f where f.id = e.friend_id and f.user_id = e.user_id),
    'shares', coalesce((select jsonb_agg(jsonb_build_object('friend_id', s.friend_id, 'friend', f.name, 'amount', s.amount) order by f.name)
      from public.entry_shares s join public.friends f on f.id = s.friend_id and f.user_id = s.user_id
      where s.entry_id = e.id and s.user_id = e.user_id), '[]'),
    'my_share', case when e.kind = 'expense' then e.amount - coalesce((select sum(s.amount) from public.entry_shares s
      where s.entry_id = e.id and s.user_id = e.user_id), 0) end
  ) || case when p_notes then jsonb_build_object('note', e.note) else '{}'::jsonb end;
$$;

-- Add or edit one entry (all kinds). Resolves names, splits, defaults; with dry_run the whole write
-- runs and is rolled back, so the preview is exactly what would be stored.
create function public.agent_save_entry(agent public.agent_tokens, p_edit boolean, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := agent.user_id;
  notes boolean := 'entries:notes' = any(agent.scopes);
  dry boolean := coalesce((p_payload->>'dry_run')::boolean, false);
  old public.entries;
  fresh public.entries;
  eid uuid;
  k text;
  amt numeric;
  cur text;
  fx numeric := 1;
  occurred timestamptz := now();
  ttl text := '';
  nt text;
  acct uuid;
  to_acct uuid;
  cat uuid;
  fr uuid;
  shares jsonb;
  seen uuid[] := '{}';
  ref jsonb;
  fid uuid;
  share numeric;
  n integer;
  cat_created boolean := false;
  cat_name text;
  active_accounts uuid[];
  cname text;
  out jsonb;
begin
  if p_edit then
    eid := (p_payload->>'id')::uuid;
    select * into old from public.entries where id = eid and user_id = uid for update;
    if not found then raise sqlstate 'PT404' using message = 'Entry not found.'; end if;
    k := old.kind; amt := old.amount; cur := old.currency; fx := old.fx_rate; occurred := old.occurred_at;
    ttl := old.title; nt := old.note; acct := old.account_id; to_acct := old.to_account_id;
    cat := old.category_id; fr := old.friend_id;
  else
    k := coalesce(p_payload->>'kind', 'expense');
    if k not in ('expense', 'income', 'transfer', 'settlement') then
      raise sqlstate 'PT400' using message = 'Kind must be expense, income, transfer or settlement.';
    end if;
  end if;

  if p_payload ? 'amount' then
    if p_payload->>'amount' !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or (p_payload->>'amount')::numeric <= 0 then
      raise sqlstate 'PT400' using message = 'Use a positive amount with up to two decimals, e.g. 1200 or 12.50.';
    end if;
    amt := (p_payload->>'amount')::numeric;
  end if;
  if amt is null then raise sqlstate 'PT400' using message = 'An amount is required.'; end if;
  if p_payload ? 'title' then
    ttl := btrim(coalesce(p_payload->>'title', ''));
    if length(ttl) > 120 then raise sqlstate 'PT400' using message = 'Title is limited to 120 characters.'; end if;
  end if;
  if p_payload ? 'note' then
    nt := p_payload->>'note';
    if length(nt) > 500 then raise sqlstate 'PT400' using message = 'Note is limited to 500 characters.'; end if;
  end if;
  if p_payload ? 'date' then occurred := public.agent_when(p_payload->>'date'); end if;

  -- Accounts. `none` means no account (an expense with no account is receivable-only; a settlement is an offset).
  if p_payload ? 'account' then
    acct := case when lower(btrim(p_payload->>'account')) = 'none' then null
      else public.agent_pick(uid, 'account', p_payload->>'account') end;
  elsif not p_edit and k <> 'transfer' then
    select array_agg(a.id) into active_accounts from public.accounts a where a.user_id = uid and not a.archived;
    if cardinality(active_accounts) = 1 then
      acct := active_accounts[1];
    elsif cardinality(active_accounts) > 1 then
      raise sqlstate 'PT400' using message = 'Say which account with --account. Available: ' ||
        (select string_agg(a.name, ', ' order by a.sort, a.name) from public.accounts a where a.user_id = uid and not a.archived)
        || '. Use --account none for no account.';
    end if;
  end if;
  if p_payload ? 'to_account' then
    to_acct := case when lower(btrim(p_payload->>'to_account')) = 'none' then null
      else public.agent_pick(uid, 'account', p_payload->>'to_account') end;
  end if;
  if k = 'transfer' and (acct is null or to_acct is null or acct = to_acct) then
    raise sqlstate 'PT400' using message = 'A transfer needs two different accounts: --account FROM --to-account TO.';
  end if;
  if k = 'income' and acct is null then
    raise sqlstate 'PT400' using message = 'Income needs an account (--account).';
  end if;
  if k not in ('transfer') and p_payload ? 'to_account' and to_acct is not null then
    raise sqlstate 'PT400' using message = '--to-account is only for transfers.';
  end if;

  -- Currency: defaults to the account's; anything but HKD needs a rate to HKD.
  if p_payload ? 'currency' then
    cur := upper(btrim(p_payload->>'currency'));
    if cur !~ '^[A-Z]{3}$' then raise sqlstate 'PT400' using message = 'Currency must be a 3-letter code like HKD.'; end if;
  elsif cur is null then
    select a.currency into cur from public.accounts a where a.id = acct and a.user_id = uid;
    cur := coalesce(cur, 'HKD');
  end if;
  if p_payload ? 'fx_rate' then
    if p_payload->>'fx_rate' !~ '^[0-9]{1,6}(\.[0-9]{1,6})?$' or (p_payload->>'fx_rate')::numeric <= 0 then
      raise sqlstate 'PT400' using message = 'fx-rate must be a positive number (rate to HKD).';
    end if;
    fx := (p_payload->>'fx_rate')::numeric;
  elsif cur = 'HKD' then
    fx := 1;
  elsif not p_edit or p_payload ? 'currency' then
    raise sqlstate 'PT400' using message = format('%s is not HKD: add --fx-rate (HKD per 1 %s).', cur, cur);
  end if;

  -- Category (expense/income only). `none` clears it. --create-category makes a missing one.
  if k in ('transfer', 'settlement') then
    if p_payload ? 'category' and lower(btrim(p_payload->>'category')) <> 'none' then
      raise sqlstate 'PT400' using message = 'Transfers and settlements have no category.';
    end if;
    cat := null;
  elsif p_payload ? 'category' then
    if lower(btrim(p_payload->>'category')) = 'none' then
      cat := null;
    else
      cat := public.agent_pick(uid, 'category', p_payload->>'category', k, false,
        coalesce((p_payload->>'create_category')::boolean, false));
      if cat is null then
        cat_name := btrim(p_payload->>'category');
        if length(cat_name) not between 1 and 60 then
          raise sqlstate 'PT400' using message = 'Category name must be 1 to 60 characters.';
        end if;
        insert into public.categories (user_id, name, kind, sort)
        values (uid, cat_name, k, coalesce((select max(c.sort) + 1 from public.categories c where c.user_id = uid), 0))
        returning id into cat;
        cat_created := true;
      end if;
    end if;
  end if;

  -- Friend (settlements only; expenses use splits).
  if p_payload ? 'friend' then
    if k <> 'settlement' then
      raise sqlstate 'PT400' using message = '--friend is for settlements. Use --split or --split-equal on expenses.';
    end if;
    fr := public.agent_pick(uid, 'friend', p_payload->>'friend');
  end if;
  if k = 'settlement' and fr is null then
    raise sqlstate 'PT400' using message = 'A settlement needs --friend.';
  end if;

  -- Splits: exact amounts (--split) or equal among me + friends (--split-equal). I keep the remainder.
  if p_payload ? 'splits' or p_payload ? 'split_equal' or coalesce((p_payload->>'no_split')::boolean, false) then
    if k <> 'expense' then raise sqlstate 'PT400' using message = 'Only expenses can be split.'; end if;
    if (p_payload ? 'splits')::int + (p_payload ? 'split_equal')::int + coalesce((p_payload->>'no_split')::boolean, false)::int > 1 then
      raise sqlstate 'PT400' using message = 'Use only one of --split, --split-equal, --no-split.';
    end if;
    shares := '[]';
    if p_payload ? 'splits' then
      if jsonb_typeof(p_payload->'splits') <> 'array' or jsonb_array_length(p_payload->'splits') > 20 then
        raise sqlstate 'PT400' using message = 'splits must be a list of up to 20 friend:amount pairs.';
      end if;
      for ref in select * from jsonb_array_elements(p_payload->'splits') loop
        if jsonb_typeof(ref) <> 'object' or ref->>'amount' !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or (ref->>'amount')::numeric <= 0 then
          raise sqlstate 'PT400' using message = 'Each split needs a friend and a positive amount, e.g. --split Alex:500.';
        end if;
        fid := public.agent_pick(uid, 'friend', ref->>'friend');
        if fid = any(seen) then raise sqlstate 'PT400' using message = 'A friend appears twice in the split.'; end if;
        seen := seen || fid;
        shares := shares || jsonb_build_object('friend_id', fid, 'amount', (ref->>'amount')::numeric);
      end loop;
    elsif p_payload ? 'split_equal' then
      if jsonb_typeof(p_payload->'split_equal') <> 'array' or jsonb_array_length(p_payload->'split_equal') not between 1 and 20 then
        raise sqlstate 'PT400' using message = 'split-equal needs 1 to 20 friends, e.g. --split-equal Alex,Ben.';
      end if;
      n := jsonb_array_length(p_payload->'split_equal') + 1;
      share := round(amt / n, 2);
      if share <= 0 then raise sqlstate 'PT400' using message = 'Amount is too small to split.'; end if;
      for ref in select * from jsonb_array_elements(p_payload->'split_equal') loop
        fid := public.agent_pick(uid, 'friend', ref #>> '{}');
        if fid = any(seen) then raise sqlstate 'PT400' using message = 'A friend appears twice in the split.'; end if;
        seen := seen || fid;
        shares := shares || jsonb_build_object('friend_id', fid, 'amount', share);
      end loop;
    end if;
    if (select coalesce(sum((s->>'amount')::numeric), 0) from jsonb_array_elements(shares) s) > amt then
      raise sqlstate 'PT400' using message = 'Friend shares add up to more than the amount.';
    end if;
  end if;

  if ttl = '' then
    ttl := case when k = 'settlement' then 'Settlement'
      else coalesce((select c.name from public.categories c where c.id = cat and c.user_id = uid), '') end;
  end if;

  begin
    if p_edit then
      update public.entries set amount = amt, currency = cur, fx_rate = fx, occurred_at = occurred, title = ttl, note = nt,
        account_id = acct, to_account_id = to_acct, category_id = cat, friend_id = fr
      where id = eid and user_id = uid;
    else
      insert into public.entries (user_id, kind, occurred_at, title, note, amount, currency, fx_rate,
        account_id, to_account_id, category_id, friend_id)
      values (uid, k, occurred, ttl, nt, amt, cur, fx, acct, to_acct, cat, fr)
      returning id into eid;
    end if;
    if shares is not null then
      delete from public.entry_shares where entry_id = eid and user_id = uid;
      insert into public.entry_shares (entry_id, friend_id, user_id, amount)
      select eid, (s->>'friend_id')::uuid, uid, (s->>'amount')::numeric from jsonb_array_elements(shares) s;
    end if;
    set constraints all immediate;
    select * into fresh from public.entries where id = eid and user_id = uid;
    out := jsonb_build_object('id', eid, 'entry', public.agent_entry_json(fresh, notes));
    if cat_created then out := out || jsonb_build_object('category_created', cat_name); end if;
    if dry then raise sqlstate 'PT0DR'; end if;
  exception
    when sqlstate 'PT0DR' then
      out := out || jsonb_build_object('dry_run', true);
    when check_violation then
      get stacked diagnostics cname = constraint_name;
      raise sqlstate 'PT400' using message = case cname
        when 'entries_transfer_shape' then 'A transfer needs two different accounts and no category or friend.'
        when 'entries_income_shape' then 'Income needs an account and no friend or to-account.'
        when 'entries_expense_shape' then 'An expense takes no friend or to-account.'
        when 'entries_settlement_shape' then 'A settlement needs a friend and takes no to-account or category.'
        else 'Friend shares exceed the entry amount, or the entry is invalid.' end;
    when unique_violation then
      raise sqlstate 'PT409' using message = 'That name already exists (it may be archived).';
  end;
  return out;
end;
$$;

create function public.run_agent_money(p_hash text, p_operation text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  agent public.agent_tokens;
  uid uuid;
  approval public.agent_approvals;
  previous public.agent_edits;
  required_scope text;
  allowed text[];
  is_write boolean;
  is_read boolean;
  needs_approval boolean := false;
  requested uuid;
  fingerprint bytea;
  tz text := coalesce(p_payload->>'tz', public.agent_tz());
  notes boolean;
  subject uuid;
  resource text;
  result jsonb;
  page_limit integer;
  page_offset integer;
  t_from timestamptz;
  t_to timestamptz;
  d_from date;
  d_to date;
  name_text text := btrim(p_payload->>'name');
  cur text;
  fx numeric := 1;
  cat uuid;
  acct uuid;
  fresh_acct public.accounts;
  removed integer;
  search_text text;
begin
  select * into agent from public.agent_tokens
  where token_hash = decode(p_hash, 'hex') and revoked_at is null for update;
  if not found or agent.expires_at <= clock_timestamp() then
    raise sqlstate 'PT401' using message = 'Invalid, expired, or revoked agent token.';
  end if;
  uid := agent.user_id;
  notes := 'entries:notes' = any(agent.scopes);

  required_scope := case p_operation
    when 'friends.list' then 'friends:read' when 'friends.delete' then 'friends:delete'
    when 'accounts.list' then 'accounts:read' when 'accounts.add' then 'accounts:write'
    when 'accounts.edit' then 'accounts:write' when 'accounts.archive' then 'accounts:write'
    when 'accounts.delete' then 'accounts:delete'
    when 'categories.list' then 'categories:read' when 'categories.add' then 'categories:write'
    when 'categories.edit' then 'categories:write'
    when 'entries.list' then 'entries:read' when 'entries.add' then 'entries:write'
    when 'entries.edit' then 'entries:write' when 'entries.delete' then 'entries:write'
    when 'subscriptions.list' then 'subscriptions:read' when 'subscriptions.add' then 'subscriptions:write'
    when 'subscriptions.edit' then 'subscriptions:write' when 'subscriptions.pause' then 'subscriptions:write'
    when 'stats.get' then 'stats:read' when 'balances.get' then 'stats:read'
    when 'data.export' then 'data:export' when 'data.clear' then 'data:clear'
  end;
  if required_scope is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Invalid command.';
  end if;
  if not (required_scope = any(agent.scopes)) then
    raise sqlstate 'PT403' using message = 'This agent lacks permission for that command.';
  end if;

  allowed := case p_operation
    when 'friends.list' then array['limit', 'offset']
    when 'friends.delete' then array['id']
    when 'accounts.list' then array['all']
    when 'accounts.add' then array['name', 'currency']
    when 'accounts.edit' then array['id', 'name', 'currency', 'sort']
    when 'accounts.archive' then array['id', 'archived']
    when 'accounts.delete' then array['id']
    when 'categories.list' then array['kind', 'all']
    when 'categories.add' then array['name', 'kind', 'icon', 'color']
    when 'categories.edit' then array['id', 'name', 'icon', 'color', 'archived']
    when 'entries.list' then array['from', 'to', 'kind', 'category', 'account', 'friend', 'search', 'limit', 'offset', 'tz']
    when 'entries.add' then array['kind', 'amount', 'title', 'note', 'date', 'account', 'to_account', 'category', 'friend',
      'currency', 'fx_rate', 'splits', 'split_equal', 'create_category', 'dry_run']
    when 'entries.edit' then array['id', 'amount', 'title', 'note', 'date', 'account', 'to_account', 'category', 'friend',
      'currency', 'fx_rate', 'splits', 'split_equal', 'no_split', 'create_category', 'dry_run']
    when 'entries.delete' then array['id']
    when 'subscriptions.list' then array['all']
    when 'subscriptions.add' then array['title', 'amount', 'cadence', 'next_date', 'category', 'account', 'currency', 'fx_rate']
    when 'subscriptions.edit' then array['id', 'title', 'amount', 'cadence', 'next_date', 'category', 'account', 'currency', 'fx_rate']
    when 'subscriptions.pause' then array['id', 'active']
    when 'stats.get' then array['month', 'from', 'to', 'tz']
    else array[]::text[]
  end;
  is_read := p_operation ~ '\.(list|get)$';
  is_write := not is_read;
  if p_operation = 'entries.add' or p_operation = 'entries.edit' then
    -- A dry run changes nothing, so it needs no request ID.
    is_write := not coalesce((p_payload->>'dry_run')::boolean, false);
  end if;
  if is_write then allowed := allowed || array['request_id']; end if;
  if p_payload - allowed <> '{}' then
    raise sqlstate 'PT400' using message = 'Invalid command fields. Run with --help.';
  end if;
  if p_operation in ('entries.edit', 'accounts.edit', 'categories.edit', 'subscriptions.edit') and
     p_payload - array['id', 'request_id', 'dry_run'] = '{}' then
    raise sqlstate 'PT400' using message = 'Provide at least one field to change.';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz) then
    raise sqlstate 'PT400' using message = 'Unknown time zone.';
  end if;

  ----------------------------------------------------------------- reads
  if is_read then
    if p_operation in ('friends.list', 'entries.list') then
      if coalesce(p_payload->>'limit', '50') !~ '^[0-9]{1,3}$' or coalesce(p_payload->>'offset', '0') !~ '^[0-9]{1,6}$' or
         coalesce((p_payload->>'limit')::integer, 50) not between 1 and 100 then
        raise sqlstate 'PT400' using message = 'Use a limit between 1 and 100 and a valid offset.';
      end if;
      page_limit := coalesce((p_payload->>'limit')::integer, case p_operation when 'entries.list' then 20 else 50 end);
      page_offset := coalesce((p_payload->>'offset')::integer, 0);
    end if;

    case p_operation
      when 'friends.list' then
        select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(r) order by r.name, r.id), '[]')) into result
        from (select f.id, f.name,
            coalesce((select sum(s.amount) from public.entry_shares s where s.friend_id = f.id and s.user_id = f.user_id), 0)
            - coalesce((select sum(e.amount) from public.entries e where e.friend_id = f.id and e.user_id = f.user_id
                and e.kind = 'settlement'), 0) as balance
          from public.friends f where f.user_id = uid order by f.name, f.id limit page_limit offset page_offset) r;
      when 'accounts.list' then
        select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(r) order by r.sort, r.name), '[]')) into result
        from (select a.id, a.name, a.currency, a.archived, a.sort from public.accounts a
          where a.user_id = uid and (a.archived is false or coalesce((p_payload->>'all')::boolean, false))) r;
      when 'categories.list' then
        if p_payload ? 'kind' and p_payload->>'kind' not in ('expense', 'income') then
          raise sqlstate 'PT400' using message = 'Kind must be expense or income.';
        end if;
        select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(r) order by r.kind, r.sort, r.name), '[]')) into result
        from (select c.id, c.name, c.kind, c.icon, c.color, c.archived, c.sort from public.categories c
          where c.user_id = uid and (p_payload->>'kind' is null or c.kind = p_payload->>'kind')
            and (c.archived is false or coalesce((p_payload->>'all')::boolean, false))) r;
      when 'subscriptions.list' then
        select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(r) order by r.next_date, r.title), '[]')) into result
        from (select s.id, s.title, s.amount, s.currency, s.fx_rate, s.cadence, s.next_date, s.active,
            (select c.name from public.categories c where c.id = s.category_id and c.user_id = s.user_id) as category,
            (select a.name from public.accounts a where a.id = s.account_id and a.user_id = s.user_id) as account
          from public.subscriptions s where s.user_id = uid
            and (s.active or coalesce((p_payload->>'all')::boolean, false))) r;
      when 'entries.list' then
        if p_payload ? 'kind' and p_payload->>'kind' not in ('expense', 'income', 'transfer', 'settlement') then
          raise sqlstate 'PT400' using message = 'Kind must be expense, income, transfer or settlement.';
        end if;
        if p_payload ? 'from' then
          t_from := ((public.agent_when(p_payload->>'from') at time zone tz)::date)::timestamp at time zone tz;
        end if;
        if p_payload ? 'to' then
          t_to := (((public.agent_when(p_payload->>'to') at time zone tz)::date + 1)::timestamp) at time zone tz;
        end if;
        cat := case when p_payload ? 'category' then public.agent_pick(uid, 'category', p_payload->>'category', null, true) end;
        acct := case when p_payload ? 'account' then public.agent_pick(uid, 'account', p_payload->>'account', null, true) end;
        subject := case when p_payload ? 'friend' then public.agent_pick(uid, 'friend', p_payload->>'friend') end;
        search_text := replace(replace(replace(coalesce(p_payload->>'search', ''), '\', '\\'), '%', '\%'), '_', '\_');
        select jsonb_build_object('items', coalesce(jsonb_agg(public.agent_entry_json(r.e, notes) order by (r.e).occurred_at desc, (r.e).id), '[]'))
        into result
        from (select e from public.entries e
          where e.user_id = uid
            and (t_from is null or e.occurred_at >= t_from) and (t_to is null or e.occurred_at < t_to)
            and (p_payload->>'kind' is null or e.kind = p_payload->>'kind')
            and (cat is null or e.category_id = cat)
            and (acct is null or e.account_id = acct or e.to_account_id = acct)
            and (subject is null or e.friend_id = subject or exists (select 1 from public.entry_shares s
              where s.entry_id = e.id and s.user_id = uid and s.friend_id = subject))
            and (search_text = '' or e.title ilike '%' || search_text || '%'
              or (notes and e.note ilike '%' || search_text || '%'))
          order by e.occurred_at desc, e.id limit page_limit offset page_offset) r;
      when 'stats.get' then
        if (p_payload ? 'month') = (p_payload ? 'from') or (p_payload ? 'from') <> (p_payload ? 'to') then
          raise sqlstate 'PT400' using message = 'Use --month YYYY-MM, or --from DATE --to DATE.';
        end if;
        if p_payload ? 'month' then
          if p_payload->>'month' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
            raise sqlstate 'PT400' using message = 'Use --month YYYY-MM.';
          end if;
          d_from := (p_payload->>'month' || '-01')::date;
          d_to := (d_from + interval '1 month' - interval '1 day')::date;
        else
          d_from := (public.agent_when(p_payload->>'from') at time zone tz)::date;
          d_to := (public.agent_when(p_payload->>'to') at time zone tz)::date;
        end if;
        t_from := d_from::timestamp at time zone tz;
        t_to := (d_to + 1)::timestamp at time zone tz;
        -- Same rules as utils/calculations.ts: my share x fx per entry, rounded per entry.
        with v as (
          select e.kind, e.category_id, round(case e.kind
              when 'expense' then (e.amount - coalesce((select sum(s.amount) from public.entry_shares s
                where s.entry_id = e.id and s.user_id = uid), 0)) * e.fx_rate
              else e.amount * e.fx_rate end, 2) as val
          from public.entries e
          where e.user_id = uid and e.kind in ('expense', 'income') and e.occurred_at >= t_from and e.occurred_at < t_to),
        c as (select kind, category_id, sum(val) as total from v where val > 0 group by kind, category_id),
        k as (select kind, sum(total) as s from c group by kind)
        select jsonb_build_object('from', d_from, 'to', d_to, 'currency', 'HKD',
          'expense', coalesce((select sum(val) from v where kind = 'expense'), 0),
          'income', coalesce((select sum(val) from v where kind = 'income'), 0),
          'by_category', jsonb_build_object(
            'expense', coalesce((select jsonb_agg(jsonb_build_object('category', coalesce(cat_row.name, 'Uncategorized'),
                'category_id', c.category_id, 'total', c.total, 'percent', round(c.total * 100 / k.s, 1)) order by c.total desc)
              from c join k on k.kind = c.kind left join public.categories cat_row on cat_row.id = c.category_id and cat_row.user_id = uid
              where c.kind = 'expense'), '[]'),
            'income', coalesce((select jsonb_agg(jsonb_build_object('category', coalesce(cat_row.name, 'Uncategorized'),
                'category_id', c.category_id, 'total', c.total, 'percent', round(c.total * 100 / k.s, 1)) order by c.total desc)
              from c join k on k.kind = c.kind left join public.categories cat_row on cat_row.id = c.category_id and cat_row.user_id = uid
              where c.kind = 'income'), '[]'))) into result;
        result := result || jsonb_build_object('net', (result->>'income')::numeric - (result->>'expense')::numeric);
      when 'balances.get' then
        -- Accounts in their own currency; net worth = non-archived accounts + what friends owe me (rough, FX 1).
        with acc as (
          select a.id, a.name, a.currency, coalesce((select sum(
              case when e.account_id = a.id then (case when e.kind in ('expense', 'transfer') then -e.amount else e.amount end) else 0 end
              + case when e.to_account_id = a.id then e.amount else 0 end)
            from public.entries e where e.user_id = uid and (e.account_id = a.id or e.to_account_id = a.id)), 0) as balance
          from public.accounts a where a.user_id = uid and not a.archived),
        fr as (
          select f.id, f.name,
            coalesce((select sum(s.amount) from public.entry_shares s where s.friend_id = f.id and s.user_id = uid), 0)
            - coalesce((select sum(e.amount) from public.entries e where e.friend_id = f.id and e.user_id = uid and e.kind = 'settlement'), 0) as balance
          from public.friends f where f.user_id = uid)
        select jsonb_build_object(
          'accounts', coalesce((select jsonb_agg(to_jsonb(acc) order by acc.name) from acc), '[]'),
          'friends', coalesce((select jsonb_agg(to_jsonb(fr) order by fr.name) from fr where fr.balance <> 0), '[]'),
          'friends_owe_me', coalesce((select sum(balance) from fr where balance > 0), 0),
          'i_owe_friends', coalesce((select -sum(balance) from fr where balance < 0), 0),
          'net_worth', coalesce((select sum(balance) from acc), 0) + coalesce((select sum(balance) from fr where balance > 0), 0),
          'net_worth_currency', 'HKD') into result;
    end case;
    return result;
  end if;

  ------------------------------------------------- idempotency + approval
  requested := (p_payload->>'request_id')::uuid;
  if requested is null and is_write then
    raise sqlstate 'PT400' using message = 'A request UUID is required (--request-id).';
  end if;
  if is_write then
    fingerprint := sha256(convert_to(jsonb_build_array(p_operation, p_payload)::text, 'UTF8'));
    select * into previous from public.agent_edits where token_id = agent.id and request_id = requested;
    if found then
      if previous.request_hash <> fingerprint then
        raise sqlstate 'PT409' using message = 'This request ID was already used with different fields.';
      end if;
      return jsonb_build_object('status', 'already_completed', 'id', coalesce(previous.resource_id, previous.transaction_id::text));
    end if;
  end if;

  needs_approval := p_operation in ('accounts.delete', 'friends.delete', 'data.export', 'data.clear');
  if p_operation in ('accounts.delete', 'friends.delete') then
    subject := public.agent_pick(uid, case when p_operation = 'accounts.delete' then 'account' else 'friend' end,
      p_payload->>'id', null, true);
  end if;
  if needs_approval then
    insert into public.agent_approvals (code, token_id, operation, request_id, request_hash, subject_id)
    values (upper(left(replace(gen_random_uuid()::text, '-', ''), 12)), agent.id, p_operation, requested, fingerprint, subject)
    on conflict (token_id, request_id) do nothing;
    select * into approval from public.agent_approvals where token_id = agent.id and request_id = requested;
    if approval.request_hash <> fingerprint then
      raise sqlstate 'PT409' using message = 'This request ID was already used with different fields.';
    end if;
    if approval.expires_at <= clock_timestamp() or approval.denied_at is not null then
      raise sqlstate 'PT403' using message = 'Approval expired or was declined. Start a new request if needed.';
    end if;
    if approval.approved_at is null then
      return jsonb_build_object('status', 'approval_required', 'user_code', approval.code, 'request_id', requested);
    end if;
    update public.agent_approvals set completed_at = now() where code = approval.code;
  end if;

  ------------------------------------------------------------- writes
  if name_text is not null and length(name_text) not between 1 and 80 then
    raise sqlstate 'PT400' using message = 'Name must be 1 to 80 characters.';
  end if;
  if p_payload ? 'currency' and upper(p_payload->>'currency') !~ '^[A-Z]{3}$' then
    raise sqlstate 'PT400' using message = 'Currency must be a 3-letter code like HKD.';
  end if;
  cur := upper(p_payload->>'currency');

  case p_operation
    when 'entries.add', 'entries.edit' then
      result := public.agent_save_entry(agent, p_operation = 'entries.edit', p_payload);
      if result ? 'dry_run' then return result; end if;
      subject := (result->>'id')::uuid;
      result := result || jsonb_build_object('status', case when p_operation = 'entries.add' then 'created' else 'updated' end);
    when 'entries.delete' then
      delete from public.entries where id = (p_payload->>'id')::uuid and user_id = uid returning id into subject;
      if subject is null then raise sqlstate 'PT404' using message = 'Entry not found.'; end if;
      result := jsonb_build_object('status', 'deleted', 'id', subject);
    when 'accounts.add' then
      if name_text is null then raise sqlstate 'PT400' using message = 'Name is required.'; end if;
      if exists (select 1 from public.accounts a where a.user_id = uid and not a.archived and lower(a.name) = lower(name_text)) then
        raise sqlstate 'PT409' using message = 'An account with that name already exists.';
      end if;
      insert into public.accounts (user_id, name, currency, sort)
      values (uid, name_text, coalesce(cur, 'HKD'), coalesce((select max(a.sort) + 1 from public.accounts a where a.user_id = uid), 0))
      returning id into subject;
      result := jsonb_build_object('status', 'created', 'id', subject);
    when 'accounts.edit' then
      subject := public.agent_pick(uid, 'account', p_payload->>'id', null, true);
      if p_payload ? 'sort' and p_payload->>'sort' !~ '^[0-9]{1,4}$' then
        raise sqlstate 'PT400' using message = 'Sort must be a whole number.';
      end if;
      update public.accounts set name = coalesce(name_text, name), currency = coalesce(cur, currency),
        sort = coalesce((p_payload->>'sort')::integer, sort) where id = subject and user_id = uid;
      result := jsonb_build_object('status', 'updated', 'id', subject);
    when 'accounts.archive' then
      subject := public.agent_pick(uid, 'account', p_payload->>'id', null, true);
      update public.accounts set archived = coalesce((p_payload->>'archived')::boolean, true) where id = subject and user_id = uid;
      result := jsonb_build_object('status', 'updated', 'id', subject);
    when 'accounts.delete' then
      begin
        delete from public.accounts where id = subject and user_id = uid;
      exception when foreign_key_violation then
        raise sqlstate 'PT409' using message = 'That account has entries. Archive it instead.';
      end;
      result := jsonb_build_object('status', 'deleted', 'id', subject);
    when 'categories.add' then
      if name_text is null then raise sqlstate 'PT400' using message = 'Name is required.'; end if;
      if coalesce(p_payload->>'kind', 'expense') not in ('expense', 'income') then
        raise sqlstate 'PT400' using message = 'Kind must be expense or income.';
      end if;
      insert into public.categories (user_id, name, kind, icon, color, sort)
      values (uid, name_text, coalesce(p_payload->>'kind', 'expense'), left(p_payload->>'icon', 16), left(p_payload->>'color', 20),
        coalesce((select max(c.sort) + 1 from public.categories c where c.user_id = uid), 0))
      on conflict (user_id, kind, name) do nothing returning id into subject;
      if subject is null then
        select c.id into subject from public.categories c
        where c.user_id = uid and c.kind = coalesce(p_payload->>'kind', 'expense') and c.name = name_text;
        result := jsonb_build_object('status', 'exists', 'id', subject);
      else
        result := jsonb_build_object('status', 'created', 'id', subject);
      end if;
    when 'categories.edit' then
      subject := public.agent_pick(uid, 'category', p_payload->>'id', null, true);
      update public.categories set name = coalesce(name_text, name), icon = coalesce(left(p_payload->>'icon', 16), icon),
        color = coalesce(left(p_payload->>'color', 20), color), archived = coalesce((p_payload->>'archived')::boolean, archived)
      where id = subject and user_id = uid;
      result := jsonb_build_object('status', 'updated', 'id', subject);
    when 'subscriptions.add', 'subscriptions.edit' then
      if p_operation = 'subscriptions.edit' then
        subject := public.agent_pick(uid, 'subscription', p_payload->>'id');
      elsif coalesce(p_payload->>'title', '') = '' or p_payload->>'amount' is null or p_payload->>'cadence' is null
          or p_payload->>'next_date' is null then
        raise sqlstate 'PT400' using message = 'Title, amount, cadence and next-date are required.';
      end if;
      if p_payload ? 'title' and length(btrim(p_payload->>'title')) not between 1 and 120 then
        raise sqlstate 'PT400' using message = 'Title must be 1 to 120 characters.';
      end if;
      if p_payload ? 'amount' and (p_payload->>'amount' !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or (p_payload->>'amount')::numeric <= 0) then
        raise sqlstate 'PT400' using message = 'Use a positive amount with up to two decimals.';
      end if;
      if p_payload ? 'cadence' and p_payload->>'cadence' not in ('weekly', 'monthly', 'yearly') then
        raise sqlstate 'PT400' using message = 'Cadence must be weekly, monthly or yearly.';
      end if;
      if p_payload ? 'next_date' and p_payload->>'next_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise sqlstate 'PT400' using message = 'Use next-date as YYYY-MM-DD.';
      end if;
      if p_payload ? 'fx_rate' then
        if p_payload->>'fx_rate' !~ '^[0-9]{1,6}(\.[0-9]{1,6})?$' or (p_payload->>'fx_rate')::numeric <= 0 then
          raise sqlstate 'PT400' using message = 'fx-rate must be a positive number (rate to HKD).';
        end if;
        fx := (p_payload->>'fx_rate')::numeric;
      elsif cur is not null and cur <> 'HKD' then
        raise sqlstate 'PT400' using message = 'A non-HKD subscription needs --fx-rate.';
      end if;
      if p_payload ? 'category' then
        cat := case when lower(btrim(p_payload->>'category')) = 'none' then null
          else public.agent_pick(uid, 'category', p_payload->>'category', 'expense') end;
      end if;
      if p_payload ? 'account' then
        acct := case when lower(btrim(p_payload->>'account')) = 'none' then null
          else public.agent_pick(uid, 'account', p_payload->>'account') end;
      end if;
      if p_operation = 'subscriptions.add' then
        insert into public.subscriptions (user_id, title, amount, currency, fx_rate, category_id, account_id, cadence, next_date)
        values (uid, btrim(p_payload->>'title'), (p_payload->>'amount')::numeric, coalesce(cur, 'HKD'), fx, cat, acct,
          p_payload->>'cadence', (p_payload->>'next_date')::date)
        returning id into subject;
        result := jsonb_build_object('status', 'created', 'id', subject);
      else
        update public.subscriptions set title = coalesce(btrim(p_payload->>'title'), title),
          amount = coalesce((p_payload->>'amount')::numeric, amount), currency = coalesce(cur, currency),
          fx_rate = case when p_payload ? 'fx_rate' or cur = 'HKD' then fx else fx_rate end,
          category_id = case when p_payload ? 'category' then cat else category_id end,
          account_id = case when p_payload ? 'account' then acct else account_id end,
          cadence = coalesce(p_payload->>'cadence', cadence), next_date = coalesce((p_payload->>'next_date')::date, next_date)
        where id = subject and user_id = uid;
        result := jsonb_build_object('status', 'updated', 'id', subject);
      end if;
    when 'subscriptions.pause' then
      subject := public.agent_pick(uid, 'subscription', p_payload->>'id');
      update public.subscriptions set active = coalesce((p_payload->>'active')::boolean, false) where id = subject and user_id = uid;
      result := jsonb_build_object('status', 'updated', 'id', subject);
    when 'friends.delete' then
      delete from public.friends where id = subject and user_id = uid;
      result := jsonb_build_object('status', 'deleted', 'id', subject);
    when 'data.export' then
      select jsonb_build_object('items', coalesce(jsonb_agg(public.agent_entry_json(e, true) order by e.occurred_at desc, e.id), '[]'))
      into result from public.entries e where e.user_id = uid;
      resource := 'history';
    when 'data.clear' then
      -- Entries (and their shares), subscriptions and friends. Accounts and categories stay.
      delete from public.entries where user_id = uid;
      get diagnostics removed = row_count;
      delete from public.subscriptions where user_id = uid;
      delete from public.friends where user_id = uid;
      result := jsonb_build_object('entries_deleted', removed);
      resource := 'history';
  end case;

  insert into public.agent_edits (user_id, token_id, operation, resource_id, request_id, request_hash)
  values (uid, agent.id, p_operation, coalesce(resource, subject::text), requested, fingerprint);
  return result;
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    raise sqlstate 'PT400' using message = 'Invalid ID, date or number.';
  when unique_violation then
    raise sqlstate 'PT409' using message = 'That name already exists (it may be archived).';
end;
$$;

revoke execute on function public.agent_scopes_valid(text[]), public.agent_tz(), public.agent_when(text),
  public.agent_candidates(uuid, text, text, boolean), public.agent_pick(uuid, text, text, text, boolean, boolean),
  public.agent_entry_json(public.entries, boolean), public.agent_save_entry(public.agent_tokens, boolean, jsonb),
  public.run_agent_money(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.agent_browser_request(text, text) from public, anon;
grant execute on function public.agent_browser_request(text, text) to authenticated;
grant execute on function public.run_agent_money(text, text, jsonb) to service_role;
