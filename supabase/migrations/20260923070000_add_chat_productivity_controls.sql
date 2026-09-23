-- Produtividade do chat: preferências, pesquisa e gestão segura de grupos.

alter table public.chat_participants
  add column if not exists muted_until timestamptz;

create index if not exists chat_participants_user_active_recent_idx
  on public.chat_participants (user_id, archived_at, conversation_id);

create or replace function public.update_chat_preferences(
  p_conversation_id uuid,
  p_archived boolean default false,
  p_muted_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  if p_muted_until is not null and p_muted_until <= now() then
    p_muted_until := null;
  end if;

  update public.chat_participants
  set archived_at = case when p_archived then now() else null end,
      muted_until = p_muted_until
  where conversation_id = p_conversation_id
    and user_id = (select auth.uid());
end;
$$;

create or replace function public.rename_group_chat(
  p_conversation_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := btrim(p_name);
begin
  if not private.chat_can_manage_group(p_conversation_id, (select auth.uid())) then
    raise exception 'Somente administradores podem alterar este grupo.' using errcode = '42501';
  end if;
  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'O nome do grupo deve possuir entre 2 e 80 caracteres.' using errcode = '22023';
  end if;

  update public.chat_conversations
  set title = normalized_name, updated_at = now()
  where id = p_conversation_id and type = 'group';
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
    and (p_conversation_id is null or message.conversation_id = p_conversation_id)
    and message.body ilike '%' || replace(replace(normalized_search, '%', '\%'), '_', '\_') || '%' escape '\'
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

drop policy if exists chat_typing_select_same_organization on realtime.messages;
create policy chat_typing_select_same_organization
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'chat-typing:' || private.user_organization((select auth.uid()))::text
  and private.chat_user_enabled((select auth.uid()))
);

drop policy if exists chat_typing_insert_same_organization on realtime.messages;
create policy chat_typing_insert_same_organization
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'chat-typing:' || private.user_organization((select auth.uid()))::text
  and private.chat_user_enabled((select auth.uid()))
);

revoke all on function public.update_chat_preferences(uuid, boolean, timestamptz) from public, anon;
revoke all on function public.rename_group_chat(uuid, text) from public, anon;
revoke all on function public.search_chat_messages(text, uuid, integer) from public, anon;
grant execute on function public.update_chat_preferences(uuid, boolean, timestamptz) to authenticated;
grant execute on function public.rename_group_chat(uuid, text) to authenticated;
grant execute on function public.search_chat_messages(text, uuid, integer) to authenticated;

