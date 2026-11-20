alter table public.agent_tokens
  add column refresh_token_hash bytea unique,
  add column refresh_expires_at timestamptz;
grant select (refresh_expires_at) on public.agent_tokens to authenticated;

alter table public.agent_edits alter column transaction_id drop not null;
alter table public.agent_edits add column resource_id text;
grant select (resource_id) on public.agent_edits to authenticated;

create table public.agent_pairings (
  user_code text primary key,
  device_hash bytea not null unique,
  label text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  last_poll_at timestamptz,
  token_id uuid references public.agent_tokens(id) on delete cascade
);

create table public.agent_approvals (
  code text primary key,
  token_id uuid not null references public.agent_tokens(id) on delete cascade,
  operation text not null,
  request_id uuid not null,
  request_hash bytea not null,
  subject_id uuid,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_at timestamptz,
  denied_at timestamptz,
  completed_at timestamptz,
  unique (token_id, request_id)
);

alter table public.agent_pairings enable row level security;
alter table public.agent_approvals enable row level security;
revoke all on public.agent_pairings, public.agent_approvals from public, anon, authenticated;

create function public.agent_scopes_valid(scopes text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(cardinality(scopes) between 1 and 18 and scopes <@ array[
    'friends:read', 'friends:add', 'friends:edit', 'friends:delete',
    'transactions:read', 'transactions:add', 'transactions:edit', 'transactions:delete', 'transactions:notes',
    'settlements:read', 'settlements:add',
    'categories:read', 'categories:add', 'categories:delete',
    'profile:read', 'profile:edit', 'data:export', 'data:clear'
  ], false);
$$;

create function public.agent_account_name(p_id uuid)
returns text
language sql stable set search_path = ''
as $$
  select coalesce(p.name, u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id where u.id = p_id;
$$;

create function public.agent_secret(prefix text)
returns text
language sql set search_path = ''
as $$
  select prefix || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

create or replace function public.create_agent_token(p_label text, p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  secret text := public.agent_secret('sqo_');
  issued public.agent_tokens;
begin
  if owner_id is null then
    raise sqlstate 'PT401' using message = 'Sign in to create an agent token.';
  end if;
  if p_label is null or length(btrim(p_label)) not between 1 and 60 or not public.agent_scopes_valid(p_scopes) then
    raise sqlstate 'PT400' using message = 'Enter a name and choose valid permissions.';
  end if;
  insert into public.agent_tokens (user_id, label, token_hash, scopes)
  values (owner_id, btrim(p_label), sha256(convert_to(secret, 'UTF8')), p_scopes)
  returning * into issued;
  return jsonb_build_object('id', issued.id, 'label', issued.label, 'scopes', issued.scopes,
    'created_at', issued.created_at, 'expires_at', issued.expires_at, 'revoked_at', issued.revoked_at, 'token', secret);
end;
$$;

create function public.update_agent_scopes(p_id uuid, p_scopes text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.agent_scopes_valid(p_scopes) then
    raise sqlstate 'PT400' using message = 'Choose at least one valid permission.';
  end if;
  update public.agent_tokens set scopes = p_scopes
  where id = p_id and user_id = auth.uid() and revoked_at is null;
  if not found then
    raise sqlstate 'PT404' using message = 'Agent connection not found.';
  end if;
  update public.agent_approvals set denied_at = now()
  where token_id = p_id and completed_at is null and not (replace(operation, '.', ':') = any(p_scopes));
end;
$$;

create function public.agent_browser_request(p_code text, p_kind text)
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
      'subject', (select f.name from public.friends f where f.id = a.subject_id and f.user_id = t.user_id)) into result
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

create function public.decide_agent_request(p_code text, p_kind text, p_allow boolean, p_scopes text[] default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pairing public.agent_pairings;
  target_id uuid;
  authenticated_user uuid := auth.uid();
begin
  if authenticated_user is null then
    raise sqlstate 'PT401' using message = 'Sign in to continue.';
  end if;
  if p_kind = 'connect' then
    select * into pairing from public.agent_pairings
    where user_code = p_code and expires_at > now() and token_id is null for update;
    if not found then
      raise sqlstate 'PT404' using message = 'This request has expired or is unavailable.';
    end if;
    if p_allow is not true then
      update public.agent_pairings set expires_at = now() where user_code = p_code;
      return;
    end if;
    if not public.agent_scopes_valid(p_scopes) then
      raise sqlstate 'PT400' using message = 'Choose at least one valid permission.';
    end if;
    insert into public.agent_tokens (user_id, label, scopes, token_hash, expires_at, refresh_expires_at)
    values (authenticated_user, pairing.label, p_scopes, sha256(convert_to(public.agent_secret('unused_'), 'UTF8')),
      now(), pairing.expires_at) returning id into target_id;
    update public.agent_pairings set token_id = target_id where user_code = p_code;
  elsif p_kind = 'action' then
    select t.id into target_id
    from public.agent_tokens t join public.agent_approvals a on a.token_id = t.id
    where a.code = p_code and t.user_id = authenticated_user and t.revoked_at is null
      and replace(a.operation, '.', ':') = any(t.scopes) for update of t;
    if not found then
      raise sqlstate 'PT404' using message = 'This request has expired or is unavailable.';
    end if;
    update public.agent_approvals set approved_at = case when p_allow then now() end,
      denied_at = case when p_allow is not true then now() end
    where code = p_code and expires_at > clock_timestamp() and approved_at is null and denied_at is null;
    if not found then
      raise sqlstate 'PT404' using message = 'This request has expired or is unavailable.';
    end if;
  else
    raise sqlstate 'PT400' using message = 'Unknown approval type.';
  end if;
end;
$$;

create function public.issue_agent_session(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  access_secret text := public.agent_secret('sqo_');
  refresh_secret text := public.agent_secret('sqr_');
  access_until timestamptz := clock_timestamp() + interval '15 minutes';
  connection public.agent_tokens;
begin
  update public.agent_tokens
  set token_hash = sha256(convert_to(access_secret, 'UTF8')), expires_at = access_until,
    refresh_token_hash = sha256(convert_to(refresh_secret, 'UTF8')),
    refresh_expires_at = clock_timestamp() + interval '90 days'
  where id = p_id and revoked_at is null and refresh_expires_at > clock_timestamp()
  returning * into connection;
  if not found then
    raise sqlstate 'PT401' using message = 'This agent connection expired or was disconnected.';
  end if;
  return jsonb_build_object('status', 'connected', 'access_token', access_secret, 'refresh_token', refresh_secret,
    'expires_at', access_until, 'connection_id', connection.id, 'label', connection.label, 'scopes', connection.scopes,
    'account_id', connection.user_id, 'account_name', public.agent_account_name(connection.user_id));
end;
$$;

create function public.run_agent_connection(p_hash text, p_operation text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  pairing public.agent_pairings;
  connection_id uuid;
  verification_code text;
  device_secret text;
begin
  case p_operation
    when 'connect.start' then
      if jsonb_typeof(p_payload->'label') is distinct from 'string' or length(btrim(p_payload->>'label')) not between 1 and 60 then
        raise sqlstate 'PT400' using message = 'Enter an agent name between 1 and 60 characters.';
      end if;
      perform pg_advisory_xact_lock(87241120);
      delete from public.agent_pairings where expires_at <= now();
      if (select count(*) from public.agent_pairings) >= 100 then
        raise sqlstate 'PT429' using message = 'Too many pending connections. Try again shortly.';
      end if;
      verification_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
      device_secret := public.agent_secret('sqd_');
      insert into public.agent_pairings (user_code, device_hash, label)
      values (verification_code, sha256(convert_to(device_secret, 'UTF8')), btrim(p_payload->>'label'));
      return jsonb_build_object('device_code', device_secret, 'user_code', verification_code, 'interval', 3, 'expires_in', 600);
    when 'connect.poll' then
      select * into pairing from public.agent_pairings where device_hash = decode(p_hash, 'hex') for update;
      if not found or pairing.expires_at <= clock_timestamp() then
        raise sqlstate 'PT401' using message = 'This connection request expired or was declined. Start again.';
      end if;
      if pairing.last_poll_at > clock_timestamp() - interval '3 seconds' then
        return jsonb_build_object('status', 'pending', 'interval', 4);
      end if;
      if pairing.token_id is null then
        update public.agent_pairings set last_poll_at = clock_timestamp() where user_code = pairing.user_code;
        return jsonb_build_object('status', 'pending', 'interval', 3);
      end if;
      delete from public.agent_pairings where user_code = pairing.user_code;
      return public.issue_agent_session(pairing.token_id);
    when 'connect.refresh' then
      select id into connection_id from public.agent_tokens where refresh_token_hash = decode(p_hash, 'hex') for update;
      if not found then
        raise sqlstate 'PT401' using message = 'This agent connection expired or was disconnected. Reconnect in SquareOne.';
      end if;
      return public.issue_agent_session(connection_id);
    else
      raise sqlstate 'PT400' using message = 'Unknown connection command.';
  end case;
end;
$$;

revoke execute on function public.agent_scopes_valid(text[]), public.agent_account_name(uuid),
  public.agent_secret(text), public.issue_agent_session(uuid),
  public.run_agent_connection(text, text, jsonb), public.update_agent_scopes(uuid, text[]),
  public.agent_browser_request(text, text), public.decide_agent_request(text, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function public.run_agent_connection(text, text, jsonb) to service_role;
grant execute on function public.update_agent_scopes(uuid, text[]), public.agent_browser_request(text, text),
  public.decide_agent_request(text, text, boolean, text[]) to authenticated;

create function public.run_agent_management(p_hash text, p_operation text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
    raise sqlstate 'PT403' using message = 'This agent lacks permission for that command.';
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
      insert into public.friends (id, user_id, name, avatar)
      values (gen_random_uuid(), agent.user_id, name_text, coalesce(avatar_text, ''))
      returning id into subject_id;
    when 'friends.edit' then
      if name_text is null and avatar_text is null then raise sqlstate 'PT400' using message = 'Provide a name or avatar.'; end if;
      update public.friends set name = coalesce(name_text, name), avatar = coalesce(avatar_text, avatar)
      where id = (p_payload->>'id')::uuid and user_id = agent.user_id returning id into subject_id;
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
$$;
revoke execute on function public.run_agent_management(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.run_agent_management(text, text, jsonb) to service_role;
