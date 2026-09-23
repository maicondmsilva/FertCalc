-- Chat colaborativo: grupos, recibos de leitura, perfil e presença autorizada.

alter table public.chat_conversations
  alter column direct_key drop not null,
  add column if not exists title text;

alter table public.chat_conversations
  drop constraint if exists chat_conversations_type_check;
alter table public.chat_conversations
  add constraint chat_conversations_type_check
  check (type in ('direct', 'group'));
alter table public.chat_conversations
  add constraint chat_conversations_shape_check
  check (
    (type = 'direct' and direct_key is not null and title is null)
    or
    (type = 'group' and direct_key is null and char_length(btrim(title)) between 2 and 80)
  ) not valid;
alter table public.chat_conversations validate constraint chat_conversations_shape_check;

alter table public.chat_participants
  add column if not exists participant_role text not null default 'member';
alter table public.chat_participants
  add constraint chat_participants_role_check
  check (participant_role in ('owner', 'admin', 'member')) not valid;
alter table public.chat_participants validate constraint chat_participants_role_check;

alter table public.app_users
  add column if not exists phone text,
  add column if not exists job_title text,
  add column if not exists chat_status text not null default 'available',
  add column if not exists chat_status_message text;

alter table public.app_users
  add constraint app_users_chat_status_check
  check (chat_status in ('available', 'busy', 'away', 'do_not_disturb')) not valid;
alter table public.app_users validate constraint app_users_chat_status_check;
alter table public.app_users
  add constraint app_users_chat_profile_lengths_check
  check (
    char_length(coalesce(phone, '')) <= 30
    and char_length(coalesce(job_title, '')) <= 80
    and char_length(coalesce(chat_status_message, '')) <= 120
  ) not valid;
alter table public.app_users validate constraint app_users_chat_profile_lengths_check;

create index if not exists chat_participants_conversation_active_idx
  on public.chat_participants (conversation_id, user_id, last_read_at)
  where archived_at is null;
create index if not exists chat_conversations_group_recent_idx
  on public.chat_conversations (organization_id, last_message_at desc nulls last, id desc)
  where type = 'group';

create or replace function private.chat_can_manage_group(
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
      from public.chat_conversations conversation
      join public.chat_participants participant
        on participant.conversation_id = conversation.id
       and participant.user_id = p_user_id
       and participant.archived_at is null
       and participant.participant_role in ('owner', 'admin')
      where conversation.id = p_conversation_id
        and conversation.type = 'group'
        and conversation.organization_id = private.user_organization(p_user_id)
    );
$$;

create or replace function private.chat_presence_topic_allowed(
  p_topic text,
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
    and p_topic = 'chat-presence:' || private.user_organization(p_user_id)::text;
$$;

create or replace function public.create_group_chat(
  p_name text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
  normalized_name text := btrim(p_name);
  normalized_members uuid[];
  invalid_member_count integer;
  v_conversation_id uuid;
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'O nome do grupo deve possuir entre 2 e 80 caracteres.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into normalized_members
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
  where member_id is not null and member_id <> caller_id;

  if cardinality(normalized_members) not between 1 and 99 then
    raise exception 'Selecione entre 1 e 99 participantes.' using errcode = '22023';
  end if;

  caller_organization := private.user_organization(caller_id);
  select count(*) into invalid_member_count
  from unnest(normalized_members) member_id
  left join public.app_users member on member.id = member_id
  where member.id is null
     or member.organization_id <> caller_organization
     or member.ativo is not true
     or not private.chat_user_enabled(member.id);

  if invalid_member_count > 0 then
    raise exception 'Um ou mais participantes são inválidos.' using errcode = '42501';
  end if;

  insert into public.chat_conversations (
    organization_id, type, direct_key, title, created_by
  ) values (
    caller_organization, 'group', null, normalized_name, caller_id
  ) returning id into v_conversation_id;

  insert into public.chat_participants (
    conversation_id, user_id, organization_id, participant_role
  ) values (
    v_conversation_id, caller_id, caller_organization, 'owner'
  );

  insert into public.chat_participants (
    conversation_id, user_id, organization_id, participant_role
  )
  select v_conversation_id, member_id, caller_organization, 'member'
  from unnest(normalized_members) member_id;

  return v_conversation_id;
end;
$$;

create or replace function public.get_chat_message_receipts(p_conversation_id uuid)
returns table (
  message_id uuid,
  read_by_count bigint,
  recipient_count bigint,
  fully_read boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  return query
  select
    message.id,
    count(participant.user_id) filter (
      where participant.user_id <> message.sender_id
        and participant.last_read_at >= message.created_at
    )::bigint,
    count(participant.user_id) filter (
      where participant.user_id <> message.sender_id
    )::bigint,
    count(participant.user_id) filter (
      where participant.user_id <> message.sender_id
        and participant.last_read_at >= message.created_at
    ) = count(participant.user_id) filter (
      where participant.user_id <> message.sender_id
    )
  from public.chat_messages message
  join public.chat_participants participant
    on participant.conversation_id = message.conversation_id
   and participant.archived_at is null
  where message.conversation_id = p_conversation_id
    and message.deleted_at is null
    and message.sender_id = (select auth.uid())
  group by message.id, message.created_at, message.sender_id;
end;
$$;

create or replace function public.get_chat_profile(p_user_id uuid)
returns table (
  id uuid,
  name text,
  nickname text,
  email text,
  phone text,
  job_title text,
  role text,
  chat_status text,
  chat_status_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;

  return query
  select user_row.id, user_row.name, user_row.nickname, user_row.email,
         user_row.phone, user_row.job_title, user_row.role,
         user_row.chat_status, user_row.chat_status_message
  from public.app_users user_row
  where user_row.id = p_user_id
    and user_row.organization_id = private.user_organization(caller_id)
    and user_row.ativo is true
    and private.chat_user_enabled(user_row.id);
end;
$$;

create or replace function public.update_own_chat_profile(
  p_phone text default null,
  p_job_title text default null,
  p_chat_status text default 'available',
  p_chat_status_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if p_chat_status not in ('available', 'busy', 'away', 'do_not_disturb') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_phone), '')) > 30
     or char_length(coalesce(btrim(p_job_title), '')) > 80
     or char_length(coalesce(btrim(p_chat_status_message), '')) > 120 then
    raise exception 'Dados do perfil excedem o limite permitido.' using errcode = '22023';
  end if;

  update public.app_users
  set phone = nullif(btrim(p_phone), ''),
      job_title = nullif(btrim(p_job_title), ''),
      chat_status = p_chat_status,
      chat_status_message = nullif(btrim(p_chat_status_message), ''),
      updated_at = now()
  where id = caller_id;
end;
$$;

drop function if exists public.list_chat_conversations(integer);
create function public.list_chat_conversations(p_limit integer default 50)
returns table (
  conversation_id uuid,
  conversation_type text,
  conversation_title text,
  contact_id uuid,
  contact_name text,
  contact_nickname text,
  contact_role text,
  member_count bigint,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'Limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;

  caller_organization := private.user_organization(caller_id);

  return query
  select
    conversation.id,
    conversation.type,
    conversation.title,
    direct_contact.id,
    case when conversation.type = 'group' then conversation.title else direct_contact.name end,
    case when conversation.type = 'direct' then direct_contact.nickname else null end,
    case when conversation.type = 'direct' then direct_contact.role else 'group' end,
    participant_totals.total,
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    coalesce(unread.total, 0)::bigint
  from public.chat_participants mine
  join public.chat_conversations conversation
    on conversation.id = mine.conversation_id
   and conversation.organization_id = caller_organization
  left join lateral (
    select contact.id, contact.name, contact.nickname, contact.role
    from public.chat_participants other_participant
    join public.app_users contact on contact.id = other_participant.user_id
    where other_participant.conversation_id = conversation.id
      and other_participant.user_id <> caller_id
      and conversation.type = 'direct'
    limit 1
  ) direct_contact on true
  join lateral (
    select count(*)::bigint as total
    from public.chat_participants participant
    where participant.conversation_id = conversation.id
      and participant.archived_at is null
  ) participant_totals on true
  left join lateral (
    select message.body, message.sender_id, message.created_at
    from public.chat_messages message
    where message.conversation_id = conversation.id
      and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) last_message on true
  left join lateral (
    select count(*) as total
    from public.chat_messages message
    where message.conversation_id = conversation.id
      and message.deleted_at is null
      and message.sender_id <> caller_id
      and message.created_at > mine.last_read_at
  ) unread on true
  where mine.user_id = caller_id
    and mine.organization_id = caller_organization
    and mine.archived_at is null
  order by conversation.last_message_at desc nulls last, conversation.created_at desc
  limit p_limit;
end;
$$;

drop policy if exists chat_presence_select_same_organization on realtime.messages;
create policy chat_presence_select_same_organization
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and private.chat_presence_topic_allowed((select realtime.topic()), (select auth.uid()))
);

drop policy if exists chat_presence_insert_same_organization on realtime.messages;
create policy chat_presence_insert_same_organization
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.chat_presence_topic_allowed((select realtime.topic()), (select auth.uid()))
);

revoke all on function private.chat_can_manage_group(uuid, uuid) from public, anon, authenticated;
revoke all on function private.chat_presence_topic_allowed(text, uuid) from public, anon;
grant execute on function private.chat_presence_topic_allowed(text, uuid) to authenticated;

revoke all on function public.create_group_chat(text, uuid[]) from public, anon;
revoke all on function public.get_chat_message_receipts(uuid) from public, anon;
revoke all on function public.get_chat_profile(uuid) from public, anon;
revoke all on function public.update_own_chat_profile(text, text, text, text) from public, anon;
revoke all on function public.list_chat_conversations(integer) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
grant execute on function public.get_chat_message_receipts(uuid) to authenticated;
grant execute on function public.get_chat_profile(uuid) to authenticated;
grant execute on function public.update_own_chat_profile(text, text, text, text) to authenticated;
grant execute on function public.list_chat_conversations(integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.chat_participants;
exception
  when duplicate_object then null;
end;
$$;

comment on column public.chat_participants.last_read_at is
  'Marcador por participante usado para não lidas e recibos de visualização.';
comment on column public.app_users.chat_status is
  'Preferência manual; a disponibilidade online é calculada pelo Realtime Presence.';
