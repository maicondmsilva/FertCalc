begin;

insert into public.organizations (id, name, slug) values
  ('48000000-0000-4000-8000-000000000001', 'Chat Replies Organização', 'chat-replies-org');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('48000000-0000-4000-8000-000000000001', '48000000-0000-4000-8000-000000000001',
   'chat-reply-a@example.test', 'Chat Reply A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('48000000-0000-4000-8000-000000000002', '48000000-0000-4000-8000-000000000001',
   'chat-reply-b@example.test', 'Chat Reply B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

select set_config('request.jwt.claim.sub', '48000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  conversation_id uuid;
  original_message public.chat_messages;
  reply_message public.chat_messages;
begin
  conversation_id := public.get_or_create_direct_chat(
    '48000000-0000-4000-8000-000000000002'
  );
  original_message := public.send_chat_message(
    conversation_id, 'Mensagem que receberá resposta', gen_random_uuid()
  );
  reply_message := public.send_chat_reply(
    conversation_id, 'Resposta contextual', gen_random_uuid(), original_message.id
  );

  if reply_message.reply_to_message_id <> original_message.id
     or reply_message.reply_preview_body <> 'Mensagem que receberá resposta'
     or reply_message.reply_preview_sender_name <> 'Chat Reply A' then
    raise exception 'A resposta não preservou corretamente a referência.';
  end if;

  begin
    perform public.send_chat_reply(
      conversation_id, 'Resposta inválida', gen_random_uuid(), gen_random_uuid()
    );
    raise exception 'Uma mensagem inexistente não deveria poder ser citada.';
  exception when sqlstate '22023' then
    null;
  end;
end;
$$;

rollback;

