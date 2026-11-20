-- QA fixes: permission errors name the scope, friend names stay unique and friends edit takes names,
-- balances net worth converts foreign-currency accounts like the Wallet screen, stats rejects from > to.

CREATE OR REPLACE FUNCTION public.run_agent_management(p_hash text, p_operation text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  agent public.agent_tokens;
  approval public.agent_approvals;
  previous public.agent_edits;
  required_scope text;
  allowed_fields text[];
  requested uuid;
  fingerprint bytea;
  subject_id uuid;
  resource text;
  name_text text := btrim(p_payload->>'name');
  avatar_text text := p_payload->>'avatar';
  friend_balance numeric;
  amount_text text := p_payload->>'amount';
  amount_value numeric;
  settlement_date timestamptz;
  result jsonb;
  removed_count integer;
begin
  select * into agent from public.agent_tokens
  where token_hash = decode(p_hash, 'hex') and revoked_at is null for update;
  if not found or agent.expires_at <= clock_timestamp() then
    raise sqlstate 'PT401' using message = 'Invalid, expired, or revoked agent token.';
  end if;

  if p_operation = 'connection.info' then
    return jsonb_build_object('connection_id', agent.id, 'label', agent.label, 'scopes', agent.scopes,
      'account_id', agent.user_id, 'account_name', public.agent_account_name(agent.user_id));
  end if;

  required_scope := case p_operation
    when 'friends.add' then 'friends:add' when 'friends.edit' then 'friends:edit' when 'friends.delete' then 'friends:delete'
    when 'transactions.delete' then 'transactions:delete' when 'transactions.notes' then 'transactions:notes'
    when 'transactions.move' then 'transactions:edit' when 'balances.list' then 'transactions:read'
    when 'settlements.list' then 'settlements:read' when 'settlements.add' then 'settlements:add'
    when 'categories.list' then 'categories:read' when 'categories.add' then 'categories:add'
    when 'categories.delete' then 'categories:delete' when 'profile.show' then 'profile:read'
    when 'profile.edit' then 'profile:edit' when 'data.export' then 'data:export' when 'data.clear' then 'data:clear'
  end;
  if required_scope is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Invalid command.';
  end if;
  if not (required_scope = any(agent.scopes)) then
    raise sqlstate 'PT403' using message = format('This agent lacks the %s permission (needed for %s).', required_scope, p_operation);
  end if;

  if p_operation in ('balances.list', 'settlements.list', 'categories.list', 'profile.show', 'transactions.notes') then
    if p_operation = 'transactions.notes' and p_payload - 'id' = '{}' then
      select jsonb_build_object('id', id, 'note', note) into result from public.transactions
      where id = (p_payload->>'id')::uuid and user_id = agent.user_id;
    elsif p_operation = 'profile.show' and p_payload = '{}' then
      select jsonb_build_object('name', name, 'avatar', avatar) into result from public.profiles where id = agent.user_id;
    elsif p_operation = 'categories.list' and p_payload = '{}' then
      select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'))
      into result from public.custom_types where user_id = agent.user_id;
    elsif p_operation = 'balances.list' and p_payload = '{}' then
      select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(item) order by item.friend_id), '[]'))
      into result from (
        select friend_id, sum(case when payer_id::text in (agent.user_id::text, 'me') then amount else -amount end) as balance
        from public.transactions where user_id = agent.user_id group by friend_id
      ) item;
    elsif p_operation = 'settlements.list' and p_payload - array['limit', 'offset'] = '{}' then
      if coalesce(p_payload->>'limit', '50') !~ '^[0-9]{1,3}$' or
         coalesce(p_payload->>'offset', '0') !~ '^[0-9]{1,6}$' or
         coalesce((p_payload->>'limit')::integer, 50) not between 1 and 100 then
        raise sqlstate 'PT400' using message = 'Use a limit between 1 and 100 and a valid offset.';
      end if;
      select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(item) order by item.date desc, item.id), '[]'))
      into result from (
        select id, date, amount, friend_id, case when payer_id::text in (agent.user_id::text, 'me') then 'me' else 'friend' end as payer
        from public.transactions where user_id = agent.user_id and is_settlement is true
        order by date desc, id limit coalesce((p_payload->>'limit')::integer, 50) offset coalesce((p_payload->>'offset')::integer, 0)
      ) item;
    else
      raise sqlstate 'PT400' using message = 'Invalid command fields.';
    end if;
    if result is null then
      raise sqlstate 'PT404' using message = 'Record not found.';
    end if;
    return result;
  end if;

  allowed_fields := case p_operation
    when 'friends.add' then array['name', 'avatar']
    when 'friends.edit' then array['id', 'name', 'avatar']
    when 'profile.edit' then array['name', 'avatar']
    when 'friends.delete' then array['id']
    when 'transactions.delete' then array['id']
    when 'transactions.move' then array['id', 'friend_id', 'payer']
    when 'settlements.add' then array['friend_id', 'amount', 'date', 'note']
    when 'categories.add' then array['name']
    when 'categories.delete' then array['id']
    else array[]::text[]
  end;
  requested := (p_payload->>'request_id')::uuid;
  if requested is null or p_payload - ('request_id'::text || allowed_fields) <> '{}' then
    raise sqlstate 'PT400' using message = 'A request UUID and valid command fields are required.';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array(p_operation, p_payload)::text, 'UTF8'));
  select * into previous from public.agent_edits where token_id = agent.id and request_id = requested;
  if found then
    if previous.request_hash <> fingerprint then
      raise sqlstate 'PT409' using message = 'This request ID was already used with different fields.';
    end if;
    return jsonb_build_object('status', 'already_completed', 'id', coalesce(previous.resource_id, previous.transaction_id::text));
  end if;

  if p_operation in ('data.export', 'data.clear', 'friends.delete') then
    if p_operation = 'friends.delete' and not exists (
      select 1 from public.friends where id = (p_payload->>'id')::uuid and user_id = agent.user_id
    ) then
      raise sqlstate 'PT404' using message = 'Friend not found.';
    end if;
    insert into public.agent_approvals (code, token_id, operation, request_id, request_hash, subject_id)
    values (upper(left(replace(gen_random_uuid()::text, '-', ''), 12)), agent.id, p_operation, requested, fingerprint,
      (p_payload->>'id')::uuid)
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

  if (p_payload ? 'name' and (jsonb_typeof(p_payload->'name') is distinct from 'string' or length(name_text) not between 1 and 80)) or
     (p_payload ? 'avatar' and (jsonb_typeof(p_payload->'avatar') is distinct from 'string' or
       avatar_text !~ '^https://api\.dicebear\.com/7\.x/(avataaars/svg\?seed=(Felix|Aneka|Buddy|Midnight|Peanut|Luna|Oliver|Sophie)|adventurer/svg\?seed=(Aurora|Blaze|Cosmo|Daisy|Echo)|lorelei/svg\?seed=(Fiona|Hazel|Iris)|bottts/svg\?seed=(Atlas|Bolt|Comet)|micah/svg\?seed=(Archer|Brooke|Clover)|fun-emoji/svg\?seed=(Smirk|Wink))$')) then
    raise sqlstate 'PT400' using message = 'Enter a valid name or choose one of the app’s preset avatar URLs.';
  end if;

  case p_operation
    when 'friends.add' then
      if name_text is null then raise sqlstate 'PT400' using message = 'Name is required.'; end if;
      if exists (select 1 from public.friends f where f.user_id = agent.user_id and lower(f.name) = lower(name_text)) then
        raise sqlstate 'PT409' using message = format('A friend named "%s" already exists. Use that friend or a different name.', name_text);
      end if;
      insert into public.friends (id, user_id, name, avatar)
      values (gen_random_uuid(), agent.user_id, name_text, coalesce(avatar_text, ''))
      returning id into subject_id;
    when 'friends.edit' then
      if name_text is null and avatar_text is null then raise sqlstate 'PT400' using message = 'Provide a name or avatar.'; end if;
      subject_id := public.agent_pick(agent.user_id, 'friend', p_payload->>'id');
      if name_text is not null and exists (select 1 from public.friends f where f.user_id = agent.user_id
          and f.id <> subject_id and lower(f.name) = lower(name_text)) then
        raise sqlstate 'PT409' using message = format('A friend named "%s" already exists.', name_text);
      end if;
      update public.friends set name = coalesce(name_text, name), avatar = coalesce(avatar_text, avatar)
      where id = subject_id and user_id = agent.user_id;
    when 'friends.delete' then
      subject_id := (p_payload->>'id')::uuid;
      perform 1 from public.friends where id = subject_id and user_id = agent.user_id for update;
      if not found then raise sqlstate 'PT404' using message = 'Friend not found.'; end if;
      delete from public.transactions where friend_id = subject_id and user_id = agent.user_id;
      delete from public.friends where id = subject_id and user_id = agent.user_id;
    when 'transactions.delete' then
      delete from public.transactions where id = (p_payload->>'id')::uuid and user_id = agent.user_id returning id into subject_id;
    when 'transactions.move' then
      if p_payload->>'payer' is null or p_payload->>'payer' not in ('me', 'friend') then
        raise sqlstate 'PT400' using message = 'Choose me or friend as payer.';
      end if;
      perform 1 from public.friends where id = (p_payload->>'friend_id')::uuid and user_id = agent.user_id for key share;
      if not found then raise sqlstate 'PT404' using message = 'Friend not found.'; end if;
      update public.transactions set friend_id = (p_payload->>'friend_id')::uuid,
        payer_id = case when p_payload->>'payer' = 'me' then agent.user_id::text else p_payload->>'friend_id' end
      where id = (p_payload->>'id')::uuid and user_id = agent.user_id and is_settlement is not true returning id into subject_id;
    when 'settlements.add' then
      if amount_text is null or amount_text !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or
         coalesce(p_payload->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
         length(p_payload->>'note') > 500 or (p_payload ? 'note' and jsonb_typeof(p_payload->'note') <> 'string') then
        raise sqlstate 'PT400' using message = 'Use a positive amount, a YYYY-MM-DD date, and an optional short note.';
      end if;
      amount_value := amount_text::numeric;
      settlement_date := (((p_payload->>'date')::date) + time '12:00') at time zone 'UTC';
      perform 1 from public.friends where id = (p_payload->>'friend_id')::uuid and user_id = agent.user_id for update;
      if not found then raise sqlstate 'PT404' using message = 'Friend not found.'; end if;
      select coalesce(sum(case when payer_id::text in (agent.user_id::text, 'me') then amount else -amount end), 0)
      into friend_balance from public.transactions where friend_id = (p_payload->>'friend_id')::uuid and user_id = agent.user_id;
      if amount_value <= 0 or friend_balance = 0 or amount_value > abs(friend_balance) + 0.01 then
        raise sqlstate 'PT400' using message = 'Settlement must be a positive amount within the current balance.';
      end if;
      insert into public.transactions (id, user_id, friend_id, payer_id, title, type, date, amount, note, is_settlement)
      values (gen_random_uuid(), agent.user_id, (p_payload->>'friend_id')::uuid,
        case when friend_balance < 0 then agent.user_id::text else p_payload->>'friend_id' end,
        'Settlement', 'General', settlement_date, amount_value, coalesce(p_payload->>'note', 'Settled'), true)
      returning id into subject_id;
    when 'categories.add' then
      if name_text is null then raise sqlstate 'PT400' using message = 'Name is required.'; end if;
      insert into public.custom_types (user_id, name) values (agent.user_id, name_text)
      on conflict (user_id, name) do update set name = excluded.name returning id into subject_id;
    when 'categories.delete' then
      delete from public.custom_types where id = (p_payload->>'id')::uuid and user_id = agent.user_id returning id into subject_id;
    when 'profile.edit' then
      if name_text is null and avatar_text is null then raise sqlstate 'PT400' using message = 'Provide a name or avatar.'; end if;
      update public.profiles set name = coalesce(name_text, name), avatar = coalesce(avatar_text, avatar), updated_at = now()
      where id = agent.user_id returning id into subject_id;
    when 'data.export' then
      select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(item) order by item.date desc, item.id), '[]'))
      into result from (
        select t.id, t.date, t.title, t.type, t.amount, t.note, t.is_settlement, f.name as friend,
          case when t.payer_id::text in (agent.user_id::text, 'me') then 'me' else f.name end as payer
        from public.transactions t left join public.friends f on f.id = t.friend_id and f.user_id = agent.user_id
        where t.user_id = agent.user_id
      ) item;
      resource := 'history';
    when 'data.clear' then
      delete from public.transactions where user_id = agent.user_id;
      get diagnostics removed_count = row_count;
      delete from public.friends where user_id = agent.user_id;
      result := jsonb_build_object('transactions_deleted', removed_count);
      resource := 'history';
  end case;

  if subject_id is null and resource is null then
    raise sqlstate 'PT404' using message = 'Record not found.';
  end if;
  insert into public.agent_edits (user_id, token_id, operation, resource_id, request_id, request_hash)
  values (agent.user_id, agent.id, p_operation, coalesce(resource, subject_id::text), requested, fingerprint);
  return coalesce(result, jsonb_build_object('id', subject_id));
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise sqlstate 'PT400' using message = 'Invalid ID or date.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_agent_money(p_hash text, p_operation text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise sqlstate 'PT403' using message = format('This agent lacks the %s permission (needed for %s).', required_scope, p_operation);
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
        if d_from > d_to then
          raise sqlstate 'PT400' using message = '--from must not be after --to.';
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
          'net_worth', coalesce((select sum(acc.balance * case when acc.currency = 'HKD' then 1 else coalesce(
            (select e.fx_rate from public.entries e where e.user_id = uid and e.currency = acc.currency
             order by e.occurred_at desc limit 1), 1) end) from acc), 0) + coalesce((select sum(balance) from fr where balance > 0), 0),
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
$function$;
