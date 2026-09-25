-- Preserve the message row for receipts and conversation history while removing
-- its original content without violating chat_messages_body_check.

create or replace function public.delete_chat_message(p_message_id uuid)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_message public.chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;

  select message.*
  into saved_message
  from public.chat_messages message
  where message.id = p_message_id
  for update;

  if saved_message.id is null
     or saved_message.sender_id <> caller_id
     or not private.chat_is_participant(saved_message.conversation_id, caller_id) then
    raise exception 'Mensagem não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  update public.chat_messages
  set body = '[Mensagem excluída]',
      deleted_at = coalesce(deleted_at, now())
  where id = p_message_id
  returning * into saved_message;

  return saved_message;
end;
$$;

revoke all on function public.delete_chat_message(uuid) from public, anon;
grant execute on function public.delete_chat_message(uuid) to authenticated;

comment on function public.delete_chat_message(uuid) is
  'Exclui logicamente uma mensagem do próprio remetente e remove seu conteúdo original.';

