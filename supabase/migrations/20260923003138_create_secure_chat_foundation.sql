create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null default 'direct' check (type = 'direct'),
  direct_key text not null,
  created_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint chat_conversations_direct_unique unique (organization_id, direct_key)
);

create table public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid not null references public.app_users(id),
  client_message_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_sender_client_unique unique (sender_id, client_message_id)
);

create index chat_participants_user_active_idx
  on public.chat_participants (user_id, conversation_id)
  where archived_at is null;
create index chat_participants_organization_idx
  on public.chat_participants (organization_id, user_id);
create index chat_messages_conversation_cursor_idx
  on public.chat_messages (conversation_id, created_at desc, id desc)
  where deleted_at is null;
create index chat_messages_organization_idx
  on public.chat_messages (organization_id, conversation_id);
create index chat_conversations_recent_idx
  on public.chat_conversations (organization_id, last_message_at desc nulls last, id desc);
create index chat_conversations_created_by_idx
  on public.chat_conversations (created_by);

create or replace function private.chat_user_enabled(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users u
    where u.id = p_user_id
      and u.ativo is true
      and (
        u.role in ('master', 'admin')
        or coalesce(u.permissions -> 'chat_access', 'false'::jsonb) = 'true'::jsonb
      )
  );
$$;

create or replace function private.chat_is_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    and private.chat_user_enabled(p_user_id)
    and exists (
      select 1
      from public.chat_participants participant
      where participant.conversation_id = p_conversation_id
        and participant.user_id = p_user_id
        and participant.archived_at is null
        and participant.organization_id = private.user_organization(p_user_id)
    );
$$;

create or replace function private.enforce_chat_row_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_organization uuid;
  actor_organization uuid;
  actor_id uuid;
begin
  select c.organization_id
    into conversation_organization
  from public.chat_conversations c
  where c.id = new.conversation_id;

  if conversation_organization is null or new.organization_id <> conversation_organization then
    raise exception 'Organização da conversa inválida.' using errcode = '23514';
  end if;

  actor_id := coalesce(
    (to_jsonb(new) ->> 'sender_id')::uuid,
    (to_jsonb(new) ->> 'user_id')::uuid
  );
  actor_organization := private.user_organization(actor_id);

  if actor_organization is null or actor_organization <> conversation_organization then
    raise exception 'Usuário não pertence à organização da conversa.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger chat_participants_enforce_organization
before insert or update on public.chat_participants
for each row execute function private.enforce_chat_row_organization();

create trigger chat_messages_enforce_organization
before insert or update on public.chat_messages
for each row execute function private.enforce_chat_row_organization();

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

create policy chat_conversations_select_participant
on public.chat_conversations
for select to authenticated
using ((select private.chat_is_participant(id, (select auth.uid()))));

create policy chat_participants_select_own_conversations
on public.chat_participants
for select to authenticated
using ((select private.chat_is_participant(conversation_id, (select auth.uid()))));

create policy chat_messages_select_participant
on public.chat_messages
for select to authenticated
using ((select private.chat_is_participant(conversation_id, (select auth.uid()))));

create or replace function public.get_or_create_direct_chat(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
  target_organization uuid;
  conversation_key text;
  v_conversation_id uuid;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_target_user_id is null or p_target_user_id = caller_id then
    raise exception 'Destinatário inválido.' using errcode = '22023';
  end if;
  if not private.chat_user_enabled(caller_id)
     or not private.chat_user_enabled(p_target_user_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;

  caller_organization := private.user_organization(caller_id);
  target_organization := private.user_organization(p_target_user_id);
  if caller_organization is null or caller_organization <> target_organization then
    raise exception 'Usuários pertencem a organizações diferentes.' using errcode = '42501';
  end if;

  conversation_key := least(caller_id::text, p_target_user_id::text)
    || ':' || greatest(caller_id::text, p_target_user_id::text);

  insert into public.chat_conversations (
    organization_id, direct_key, created_by
  ) values (
    caller_organization, conversation_key, caller_id
  )
  on conflict (organization_id, direct_key)
  do update set direct_key = excluded.direct_key
  returning id into v_conversation_id;

  insert into public.chat_participants (
    conversation_id, user_id, organization_id
  ) values
    (v_conversation_id, caller_id, caller_organization),
    (v_conversation_id, p_target_user_id, caller_organization)
  on conflict on constraint chat_participants_pkey do update
    set archived_at = null;

  return v_conversation_id;
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  conversation_organization uuid;
  normalized_body text := btrim(p_body);
  saved_message public.chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_client_message_id is null then
    raise exception 'Identificador da mensagem é obrigatório.' using errcode = '22023';
  end if;
  if char_length(normalized_body) not between 1 and 4000 then
    raise exception 'A mensagem deve possuir entre 1 e 4000 caracteres.' using errcode = '22023';
  end if;
  if not private.chat_is_participant(p_conversation_id, caller_id) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  select organization_id into conversation_organization
  from public.chat_conversations
  where id = p_conversation_id;

  insert into public.chat_messages (
    conversation_id, organization_id, sender_id, client_message_id, body
  ) values (
    p_conversation_id, conversation_organization, caller_id,
    p_client_message_id, normalized_body
  )
  on conflict (sender_id, client_message_id) do nothing
  returning * into saved_message;

  if saved_message.id is null then
    select * into saved_message
    from public.chat_messages
    where sender_id = caller_id and client_message_id = p_client_message_id;

    if saved_message.conversation_id <> p_conversation_id
       or saved_message.body <> normalized_body then
      raise exception 'Identificador já utilizado por outra mensagem.' using errcode = '23505';
    end if;
    return saved_message;
  end if;

  update public.chat_conversations
  set last_message_at = saved_message.created_at,
      updated_at = saved_message.created_at
  where id = p_conversation_id;

  return saved_message;
end;
$$;

create or replace function public.mark_chat_read(
  p_conversation_id uuid,
  p_read_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if not private.chat_is_participant(p_conversation_id, caller_id) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  update public.chat_participants
  set last_read_at = greatest(last_read_at, least(coalesce(p_read_at, now()), now()))
  where conversation_id = p_conversation_id and user_id = caller_id;
end;
$$;

create or replace function public.get_chat_messages(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns setof public.chat_messages
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'Limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'O cursor precisa conter data e identificador.' using errcode = '22023';
  end if;
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and message.deleted_at is null
    and (
      p_before_created_at is null
      or (message.created_at, message.id) < (p_before_created_at, p_before_id)
    )
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on public.chat_conversations, public.chat_participants, public.chat_messages
  from public, anon;
revoke all on public.chat_conversations, public.chat_participants, public.chat_messages
  from authenticated;
grant select on public.chat_conversations, public.chat_participants, public.chat_messages
  to authenticated;

revoke all on function private.chat_user_enabled(uuid) from public, anon, authenticated;
revoke all on function private.chat_is_participant(uuid, uuid) from public, anon;
grant execute on function private.chat_is_participant(uuid, uuid) to authenticated;
revoke all on function private.enforce_chat_row_organization() from public, anon, authenticated;

revoke all on function public.get_or_create_direct_chat(uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, uuid) from public, anon;
revoke all on function public.mark_chat_read(uuid, timestamptz) from public, anon;
revoke all on function public.get_chat_messages(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated;
grant execute on function public.mark_chat_read(uuid, timestamptz) to authenticated;
grant execute on function public.get_chat_messages(uuid, timestamptz, uuid, integer) to authenticated;

alter publication supabase_realtime add table public.chat_messages;

comment on table public.chat_conversations is 'Conversas privadas do chat interno, isoladas por organização.';
comment on table public.chat_participants is 'Participantes e marcador de leitura das conversas.';
comment on table public.chat_messages is 'Mensagens persistentes do chat interno.';
