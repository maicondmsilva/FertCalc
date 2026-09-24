begin;

do $$
declare
  user_one uuid := '43000000-0000-4000-8000-000000000001';
  user_two uuid := '43000000-0000-4000-8000-000000000002';
  conversation_id uuid;
begin
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  conversation_id := public.get_or_create_direct_chat(user_two);
  perform public.send_chat_message(conversation_id, 'Antes da exclusão', gen_random_uuid());
  perform public.delete_chat_conversation(conversation_id);

  if exists (
    select 1 from public.list_chat_conversations(50) item
    where item.conversation_id = conversation_id
  ) then
    raise exception 'A conversa excluída permaneceu visível para o usuário.';
  end if;

  if exists (select 1 from public.get_chat_messages(conversation_id, null, null, 50)) then
    raise exception 'O histórico anterior permaneceu visível apó a exclusão.';
  end if;

  perform set_config('request.jwt.claim.sub', user_two::text, true);
  perform public.send_chat_message(conversation_id, 'Depois da exclusão', gen_random_uuid());

  perform set_config('request.jwt.claim.sub', user_one::text, true);
  if not exists (
    select 1 from public.list_chat_conversations(50) item
    where item.conversation_id = conversation_id
      and item.last_message_body = 'Depois da exclusão'
  ) then
    raise exception 'A conversa não reapareceu com a nova mensagem.';
  end if;

  if (select count(*) from public.get_chat_messages(conversation_id, null, null, 50)) <> 1 then
    raise exception 'Mensagens anteriores à exclusão reapareceram.';
  end if;
end;
$$;

rollback;
