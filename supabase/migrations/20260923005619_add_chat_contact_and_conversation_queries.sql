create or replace function public.list_chat_contacts(
  p_search text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  nickname text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
  normalized_search text := nullif(btrim(p_search), '');
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 then
    raise exception 'Limite deve estar entre 1 e 50.' using errcode = '22023';
  end if;

  caller_organization := private.user_organization(caller_id);

  return query
  select u.id, u.name, u.nickname, u.role
  from public.app_users u
  where u.organization_id = caller_organization
    and u.id <> caller_id
    and u.ativo is true
    and private.chat_user_enabled(u.id)
    and (
      normalized_search is null
      or u.name ilike '%' || normalized_search || '%'
      or coalesce(u.nickname, '') ilike '%' || normalized_search || '%'
    )
  order by u.name, u.id
  limit p_limit;
end;
$$;

create or replace function public.list_chat_conversations(p_limit integer default 50)
returns table (
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_nickname text,
  contact_role text,
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
    contact.id,
    contact.name,
    contact.nickname,
    contact.role,
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    coalesce(unread.total, 0)::bigint
  from public.chat_participants mine
  join public.chat_conversations conversation
    on conversation.id = mine.conversation_id
   and conversation.organization_id = caller_organization
  join public.chat_participants other_participant
    on other_participant.conversation_id = conversation.id
   and other_participant.user_id <> caller_id
  join public.app_users contact
    on contact.id = other_participant.user_id
   and contact.organization_id = caller_organization
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

revoke all on function public.list_chat_contacts(text, integer) from public, anon;
revoke all on function public.list_chat_conversations(integer) from public, anon;
grant execute on function public.list_chat_contacts(text, integer) to authenticated;
grant execute on function public.list_chat_conversations(integer) to authenticated;
