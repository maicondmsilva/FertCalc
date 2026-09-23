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

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and message.deleted_at is null
    and (message.created_at, message.id) > (p_after_created_at, p_after_id)
  order by message.created_at, message.id
  limit p_limit;
end;
$$;

revoke all on function public.get_chat_messages_after(uuid, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.get_chat_messages_after(uuid, timestamptz, uuid, integer)
  to authenticated;

comment on function public.get_chat_messages_after(uuid, timestamptz, uuid, integer)
  is 'Recupera, por cursor, mensagens que possam ter sido perdidas durante uma desconexão.';
