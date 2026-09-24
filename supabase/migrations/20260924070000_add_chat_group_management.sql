-- Gerenciamento seguro dos participantes de grupos do chat.

create or replace function public.list_chat_group_members(p_conversation_id uuid)
returns table (
  user_id uuid,
  name text,
  nickname text,
  role text,
  participant_role text,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_can_manage boolean;
begin
  if caller_id is null
     or not private.chat_is_participant(p_conversation_id, caller_id)
     or not exists (
       select 1
       from public.chat_conversations conversation
       where conversation.id = p_conversation_id
         and conversation.type = 'group'
     ) then
    raise exception 'Grupo não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  caller_can_manage := private.chat_can_manage_group(p_conversation_id, caller_id);

  return query
  select
    member.id,
    member.name,
    member.nickname,
    member.role,
    participant.participant_role,
    caller_can_manage
  from public.chat_participants participant
  join public.app_users member on member.id = participant.user_id
  where participant.conversation_id = p_conversation_id
    and participant.archived_at is null
  order by
    case participant.participant_role when 'owner' then 0 when 'admin' then 1 else 2 end,
    member.name,
    member.id;
end;
$$;

create or replace function public.update_chat_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
  normalized_members uuid[];
  invalid_member_count integer;
  change_time timestamptz := clock_timestamp();
begin
  if caller_id is null or not private.chat_can_manage_group(p_conversation_id, caller_id) then
    raise exception 'Somente administradores podem alterar os participantes.' using errcode = '42501';
  end if;

  select conversation.organization_id into caller_organization
  from public.chat_conversations conversation
  where conversation.id = p_conversation_id
    and conversation.type = 'group';

  if caller_organization is null then
    raise exception 'Grupo não encontrado.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into normalized_members
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
  where member_id is not null
    and not exists (
      select 1
      from public.chat_participants protected
      where protected.conversation_id = p_conversation_id
        and protected.user_id = member_id
        and protected.participant_role in ('owner', 'admin')
    );

  if cardinality(normalized_members) > 99 then
    raise exception 'O grupo pode possuir no máximo 100 participantes.' using errcode = '22023';
  end if;

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

  delete from public.chat_participants participant
  where participant.conversation_id = p_conversation_id
    and participant.participant_role = 'member'
    and not (participant.user_id = any(normalized_members));

  insert into public.chat_participants (
    conversation_id,
    user_id,
    organization_id,
    participant_role,
    last_read_at,
    archived_at,
    hidden_at,
    cleared_at
  )
  select
    p_conversation_id,
    member_id,
    caller_organization,
    'member',
    change_time,
    null,
    null,
    change_time
  from unnest(normalized_members) member_id
  on conflict on constraint chat_participants_pkey do update
  set archived_at = null,
      hidden_at = null,
      cleared_at = change_time,
      last_read_at = change_time;

  update public.chat_conversations
  set updated_at = change_time
  where id = p_conversation_id;
end;
$$;

revoke all on function public.list_chat_group_members(uuid) from public, anon;
revoke all on function public.update_chat_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.list_chat_group_members(uuid) to authenticated;
grant execute on function public.update_chat_group_members(uuid, uuid[]) to authenticated;

comment on function public.list_chat_group_members(uuid) is
  'Lista participantes ativos do grupo para membros autorizados da mesma organização.';
comment on function public.update_chat_group_members(uuid, uuid[]) is
  'Atualiza membros comuns do grupo, preservando proprietários e administradores.';
