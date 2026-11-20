create table public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  token_hash bytea not null unique,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);

create index agent_tokens_user_id_idx on public.agent_tokens (user_id);

create table public.agent_edits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid not null references public.agent_tokens(id) on delete cascade,
  operation text not null,
  transaction_id uuid not null,
  request_id uuid not null,
  request_hash bytea not null,
  created_at timestamptz not null default now(),
  unique (token_id, request_id)
);

create index agent_edits_user_activity_idx on public.agent_edits (user_id, created_at desc, id desc);

alter table public.agent_tokens enable row level security;
alter table public.agent_edits enable row level security;
create policy agent_tokens_read_own on public.agent_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy agent_edits_read_own on public.agent_edits for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.agent_tokens, public.agent_edits from public, anon, authenticated;
grant select (id, user_id, label, scopes, created_at, expires_at, revoked_at) on public.agent_tokens to authenticated;
grant select (id, user_id, token_id, operation, transaction_id, created_at) on public.agent_edits to authenticated;

create function public.create_agent_token(p_label text, p_scopes text[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  secret text := 'sqo_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  issued public.agent_tokens;
begin
  if owner_id is null then
    raise sqlstate 'PT401' using message = 'Sign in to create an agent token.';
  end if;
  if p_label is null or length(btrim(p_label)) not between 1 and 60
    or coalesce(cardinality(p_scopes), 0) not between 1 and 4
    or not (p_scopes <@ array['friends:read', 'transactions:read', 'transactions:add', 'transactions:edit']) then
    raise sqlstate 'PT400' using message = 'Enter a name and choose valid permissions.';
  end if;

  insert into public.agent_tokens (user_id, label, token_hash, scopes)
  values (owner_id, btrim(p_label), sha256(convert_to(secret, 'UTF8')), p_scopes)
  returning * into issued;

  return jsonb_build_object('id', issued.id, 'label', issued.label, 'scopes', issued.scopes,
    'created_at', issued.created_at, 'expires_at', issued.expires_at, 'revoked_at', issued.revoked_at, 'token', secret);
end;
$$;

create function public.revoke_agent_token(p_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  revoked timestamptz;
begin
  update public.agent_tokens set revoked_at = coalesce(revoked_at, now())
  where id = p_id and user_id = auth.uid()
  returning revoked_at into revoked;
  if not found then
    raise sqlstate 'PT404' using message = 'Agent token not found.';
  end if;
  return revoked;
end;
$$;

-- All permission checks and writes happen in one transaction. The token lock
-- orders concurrent requests and ensures revocation and writes cannot race.
create function public.run_agent_command(p_token_hash text, p_operation text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  agent public.agent_tokens;
  prior_edit public.agent_edits;
  needed_scope text;
  page_limit integer;
  page_offset integer;
  command_id uuid;
  command_hash bytea;
  expense_id uuid;
  friend uuid;
  payer text;
  amount_text text;
  expense_amount numeric;
  expense_date timestamptz;
  result jsonb;
  title_text text := btrim(p_payload->>'title');
  type_text text := btrim(p_payload->>'type');
  note_text text := p_payload->>'note';
begin
  select * into agent from public.agent_tokens
  where token_hash = decode(p_token_hash, 'hex') and revoked_at is null
  for update;
  if not found or agent.expires_at <= clock_timestamp() then
    raise sqlstate 'PT401' using message = 'Invalid, expired, or revoked agent token.';
  end if;

  needed_scope := case p_operation
    when 'friends.list' then 'friends:read'
    when 'transactions.list' then 'transactions:read'
    when 'transactions.add' then 'transactions:add'
    when 'transactions.edit' then 'transactions:edit'
  end;
  if needed_scope is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Invalid command.';
  end if;
  if not (needed_scope = any(agent.scopes)) then
    raise sqlstate 'PT403' using message = 'This token lacks permission for that command.';
  end if;

  if p_operation in ('friends.list', 'transactions.list') then
    if p_payload - array['limit', 'offset'] <> '{}' or
      coalesce(p_payload->>'limit', '50') !~ '^[0-9]{1,3}$' or
      coalesce(p_payload->>'offset', '0') !~ '^[0-9]{1,6}$' then
      raise sqlstate 'PT400' using message = 'Invalid pagination.';
    end if;
    page_limit := coalesce((p_payload->>'limit')::integer, 50);
    page_offset := coalesce((p_payload->>'offset')::integer, 0);
    if page_limit not between 1 and 100 then
      raise sqlstate 'PT400' using message = 'Limit must be between 1 and 100.';
    end if;

    if p_operation = 'friends.list' then
      select coalesce(jsonb_agg(to_jsonb(row) order by row.name, row.id), '[]') into result
      from (select id, name from public.friends where user_id = agent.user_id
        order by name, id limit page_limit offset page_offset) as row;
    else
      select coalesce(jsonb_agg(to_jsonb(row) order by row.date desc, row.id), '[]') into result
      from (select id, title, amount, date, type, friend_id,
          case when payer_id::text in (agent.user_id::text, 'me') then 'me' else 'friend' end as payer
        from public.transactions where user_id = agent.user_id and is_settlement is not true
        order by date desc, id limit page_limit offset page_offset) as row;
    end if;
    return jsonb_build_object('items', result);
  end if;

  if (p_operation = 'transactions.add' and
      p_payload - array['request_id', 'title', 'type', 'amount', 'date', 'note', 'friend_id', 'payer'] <> '{}') or
     (p_operation = 'transactions.edit' and
      (p_payload - array['request_id', 'id', 'title', 'type', 'amount', 'date', 'note'] <> '{}' or
       p_payload - array['request_id', 'id'] = '{}')) then
    raise sqlstate 'PT400' using message = 'Invalid expense fields.';
  end if;

  command_id := (p_payload->>'request_id')::uuid;
  if command_id is null then
    raise sqlstate 'PT400' using message = 'A request UUID is required.';
  end if;
  command_hash := sha256(convert_to(jsonb_build_array(p_operation, p_payload)::text, 'UTF8'));
  select * into prior_edit from public.agent_edits where token_id = agent.id and request_id = command_id;
  if found then
    if prior_edit.request_hash <> command_hash then
      raise sqlstate 'PT409' using message = 'This request ID was already used with different fields.';
    end if;
    return jsonb_build_object('id', prior_edit.transaction_id);
  end if;

  if (p_payload ? 'title' and (jsonb_typeof(p_payload->'title') <> 'string' or length(title_text) not between 1 and 120)) or
     (p_payload ? 'type' and (jsonb_typeof(p_payload->'type') <> 'string' or length(type_text) not between 1 and 80)) or
     (p_payload ? 'note' and (jsonb_typeof(p_payload->'note') not in ('string', 'null') or length(note_text) > 500)) then
    raise sqlstate 'PT400' using message = 'Invalid title, category, or note.';
  end if;
  if p_payload ? 'amount' then
    amount_text := p_payload->>'amount';
    if amount_text is null or amount_text !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then
      raise sqlstate 'PT400' using message = 'Use a positive amount with up to two decimal places.';
    end if;
    expense_amount := amount_text::numeric;
    if expense_amount <= 0 then
      raise sqlstate 'PT400' using message = 'Use a positive amount.';
    end if;
  end if;
  if p_payload ? 'date' then
    if p_payload->>'date' is null or p_payload->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise sqlstate 'PT400' using message = 'Use a date in YYYY-MM-DD format.';
    end if;
    expense_date := ((p_payload->>'date')::date + time '12:00') at time zone 'UTC';
  end if;

  if p_operation = 'transactions.add' then
    friend := (p_payload->>'friend_id')::uuid;
    payer := p_payload->>'payer';
    if friend is null or payer is null or payer not in ('me', 'friend') or title_text is null or
      type_text is null or expense_amount is null or expense_date is null then
      raise sqlstate 'PT400' using message = 'Friend, payer, title, category, amount, and date are required.';
    end if;
    perform 1 from public.friends where id = friend and user_id = agent.user_id for key share;
    if not found then
      raise sqlstate 'PT404' using message = 'Friend not found.';
    end if;
    insert into public.transactions (id, user_id, friend_id, payer_id, title, type, amount, date, note, is_settlement)
      values (gen_random_uuid(), agent.user_id, friend, (case when payer = 'me' then agent.user_id else friend end)::text,
        title_text, type_text, expense_amount, expense_date, note_text, false)
      returning id into expense_id;
  else
    update public.transactions
    set title = coalesce(title_text, title), type = coalesce(type_text, type),
      amount = coalesce(expense_amount, amount), date = coalesce(expense_date, date),
      note = case when p_payload ? 'note' then note_text else note end
    where id = (p_payload->>'id')::uuid and user_id = agent.user_id and is_settlement is not true
    returning id into expense_id;
    if not found then
      raise sqlstate 'PT404' using message = 'Expense not found.';
    end if;
  end if;

  insert into public.agent_edits (user_id, token_id, operation, transaction_id, request_id, request_hash)
  values (agent.user_id, agent.id, p_operation, expense_id, command_id, command_hash);
  return jsonb_build_object('id', expense_id);
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise sqlstate 'PT400' using message = 'Invalid ID or date.';
end;
$$;

revoke execute on function public.create_agent_token(text, text[]), public.revoke_agent_token(uuid) from public, anon, authenticated;
grant execute on function public.create_agent_token(text, text[]), public.revoke_agent_token(uuid) to authenticated;
revoke execute on function public.run_agent_command(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.run_agent_command(text, text, jsonb) to service_role;
