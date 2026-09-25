-- Conversas fixadas são uma preferência individual e aparecem antes das recentes.

alter table public.chat_participants
  add column if not exists pinned_at timestamptz;

create index if not exists chat_participants_user_pinned_idx
  on public.chat_participants (user_id, pinned_at desc)
  where pinned_at is not null and archived_at is null and hidden_at is null;

drop function if exists public.update_chat_preferences(uuid, boolean, timestamptz);
create function public.update_chat_preferences(
  p_conversation_id uuid,
  p_archived boolean default false,
  p_muted_until timestamptz default null,
  p_pinned boolean default null
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

  if not exists (
    select 1
    from public.chat_participants participant
    where participant.conversation_id = p_conversation_id
      and participant.user_id = caller_id
      and participant.organization_id = private.user_organization(caller_id)
      and participant.hidden_at is null
  ) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  if p_muted_until is not null and p_muted_until <= now() then
    p_muted_until := null;
  end if;

  update public.chat_participants participant
  set archived_at = case when p_archived then coalesce(participant.archived_at, now()) else null end,
      muted_until = p_muted_until,
      pinned_at = case
        when p_pinned is null then participant.pinned_at
        when p_pinned then coalesce(participant.pinned_at, now())
        else null
      end
  where participant.conversation_id = p_conversation_id
    and participant.user_id = caller_id;
end;
$$;

drop function if exists public.list_chat_conversations(integer, boolean);
create function public.list_chat_conversations(
  p_limit integer default 50,
  p_archived boolean default false
)
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
  unread_count bigint,
  muted_until timestamptz,
  archived_at timestamptz,
  pinned_at timestamptz
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
    coalesce(unread.total, 0)::bigint,
    mine.muted_until,
    mine.archived_at,
    mine.pinned_at
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
    and (mine.archived_at is not null) = p_archived
    and mine.hidden_at is null
  order by
    (mine.pinned_at is not null) desc,
    mine.pinned_at desc nulls last,
    coalesce(last_message.created_at, conversation.created_at) desc,
    conversation.id desc
  limit p_limit;
end;
$$;

revoke all on function public.update_chat_preferences(uuid, boolean, timestamptz, boolean)
  from public, anon;
revoke all on function public.list_chat_conversations(integer, boolean)
  from public, anon;
grant execute on function public.update_chat_preferences(uuid, boolean, timestamptz, boolean)
  to authenticated;
grant execute on function public.list_chat_conversations(integer, boolean)
  to authenticated;

comment on column public.chat_participants.pinned_at is
  'Momento em que o participante fixou a conversa; preferência individual.';
comment on function public.update_chat_preferences(uuid, boolean, timestamptz, boolean) is
  'Atualiza arquivamento, silenciamento e fixação apenas para o usuário autenticado.';
