-- Exclusão individual de conversas sem apagar o histórico dos demais participantes.

alter table public.chat_participants
  add column if not exists hidden_at timestamptz,
  add column if not exists cleared_at timestamptz;

create index if not exists chat_participants_visible_conversations_idx
  on public.chat_participants (user_id, conversation_id)
  where archived_at is null and hidden_at is null;

create or replace function public.delete_chat_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  deletion_time timestamptz := clock_timestamp();
begin
  if caller_id is null or not private.chat_is_participant(p_conversation_id, caller_id) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  update public.chat_participants
  set hidden_at = deletion_time,
      cleared_at = deletion_time,
      last_read_at = deletion_time
  where conversation_id = p_conversation_id
    and user_id = caller_id;
end;
$$;

create or replace function private.restore_chat_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_participants
  set hidden_at = null
  where conversation_id = new.conversation_id
    and hidden_at is not null;
  return new;
end;
$$;

drop trigger if exists chat_message_restore_hidden_conversation on public.chat_messages;
create trigger chat_message_restore_hidden_conversation
after insert on public.chat_messages
for each row execute function private.restore_chat_conversation_on_message();

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
      and (mine.cleared_at is null or message.created_at > mine.cleared_at)
    order by message.created_at desc, message.id desc
    limit 1
  ) last_message on true
  left join lateral (
    select count(*) as total
    from public.chat_messages message
    where message.conversation_id = conversation.id
      and message.deleted_at is null
      and message.sender_id <> caller_id
      and message.created_at > greatest(mine.last_read_at, coalesce(mine.cleared_at, '-infinity'))
  ) unread on true
  where mine.user_id = caller_id
    and mine.organization_id = caller_organization
    and mine.archived_at is null
    and mine.hidden_at is null
  order by coalesce(last_message.created_at, conversation.created_at) desc, conversation.id desc
  limit p_limit;
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
declare
  history_start timestamptz;
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

  select participant.cleared_at into history_start
  from public.chat_participants participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id = (select auth.uid());

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and (history_start is null or message.created_at > history_start)
    and (
      p_before_created_at is null
      or (message.created_at, message.id) < (p_before_created_at, p_before_id)
    )
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

create or replace function public.get_chat_messages_after(
  p_conversation_id uuid,
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer default 100
)
returns setof public.chat_messages
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  history_start timestamptz;
begin
  if p_limit not between 1 and 100 then
    raise exception 'Limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if p_after_created_at is null or p_after_id is null then
    raise exception 'O cursor de recuperação é obrigatório.' using errcode = '22023';
  end if;
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  select participant.cleared_at into history_start
  from public.chat_participants participant
  where participant.conversation_id = p_conversation_id
    and participant.user_id = (select auth.uid());

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and (history_start is null or message.created_at > history_start)
    and (message.created_at, message.id) > (p_after_created_at, p_after_id)
  order by message.created_at, message.id
  limit p_limit;
end;
$$;

create or replace function public.search_chat_messages(
  p_search text,
  p_conversation_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_search text := btrim(p_search);
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if char_length(normalized_search) < 2 or p_limit not between 1 and 100 then
    raise exception 'Informe ao menos dois caracteres e um limite válido.' using errcode = '22023';
  end if;

  return query
  select message.id, message.conversation_id, message.sender_id, message.body, message.created_at
  from public.chat_messages message
  join public.chat_participants participant
    on participant.conversation_id = message.conversation_id
   and participant.user_id = caller_id
  where message.deleted_at is null
    and participant.archived_at is null
    and participant.hidden_at is null
    and (participant.cleared_at is null or message.created_at > participant.cleared_at)
    and (p_conversation_id is null or message.conversation_id = p_conversation_id)
    and message.body ilike '%' || replace(replace(normalized_search, '%', '\%'), '_', '\_') || '%' escape '\'
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

revoke all on function private.restore_chat_conversation_on_message() from public, anon, authenticated;
revoke all on function public.delete_chat_conversation(uuid) from public, anon;
grant execute on function public.delete_chat_conversation(uuid) to authenticated;
revoke all on function public.list_chat_conversations(integer) from public, anon;
grant execute on function public.list_chat_conversations(integer) to authenticated;

comment on function public.delete_chat_conversation(uuid) is
  'Oculta a conversa e limpa o histórico somente para o participante atual.';
