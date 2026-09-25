begin;

insert into public.organizations (id, name, slug) values
  ('4b000000-0000-4000-8000-000000000001', 'Chat Deletion Organização', 'chat-deletion-org');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('4b000000-0000-4000-8000-000000000001', '4b000000-0000-4000-8000-000000000001',
   'chat-delete-a@example.test', 'Chat Delete A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('4b000000-0000-4000-8000-000000000002', '4b000000-0000-4000-8000-000000000001',
   'chat-delete-b@example.test', 'Chat Delete B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

set local role authenticated;

do $$
declare
  user_one uuid := '4b000000-0000-4000-8000-000000000001';
  user_two uuid := '4b000000-0000-4000-8000-000000000002';
  target_conversation_id uuid;
begin
  perform set_config('request.jwt.claim.sub', user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  target_conversation_id := public.get_or_create_direct_chat(user_two);
  perform public.send_chat_message(target_conversation_id, 'Antes da exclusão', gen_random_uuid());
  perform public.delete_chat_conversation(target_conversation_id);

  if exists (
    select 1 from public.list_chat_conversations(50) item
    where item.conversation_id = target_conversation_id
  ) then
    raise exception 'A conversa excluída permaneceu visível para o usuário.';
  end if;

  if exists (select 1 from public.get_chat_messages(target_conversation_id, null, null, 50)) then
    raise exception 'O histórico anterior permaneceu visível apó a exclusão.';
  end if;

  perform set_config('request.jwt.claim.sub', user_two::text, true);
  perform public.send_chat_message(target_conversation_id, 'Depois da exclusão', gen_random_uuid());

  perform set_config('request.jwt.claim.sub', user_one::text, true);
  if not exists (
    select 1 from public.list_chat_conversations(50) item
    where item.conversation_id = target_conversation_id
  ) then
    raise exception 'A conversa não reapareceu com a nova mensagem.';
  end if;
end;
$$;

rollback;

