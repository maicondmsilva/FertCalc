begin;

insert into public.organizations (id, name, slug) values
  ('4d000000-0000-4000-8000-000000000001', 'Chat Attachment Organização', 'chat-attachment-org'),
  ('4d000000-0000-4000-8000-000000000002', 'Chat Attachment Externa', 'chat-attachment-external');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('4d000000-0000-4000-8000-000000000011', '4d000000-0000-4000-8000-000000000001',
   'chat-file-a@example.test', 'Chat File A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('4d000000-0000-4000-8000-000000000012', '4d000000-0000-4000-8000-000000000001',
   'chat-file-b@example.test', 'Chat File B', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('4d000000-0000-4000-8000-000000000013', '4d000000-0000-4000-8000-000000000002',
   'chat-file-external@example.test', 'Chat File External', '', 'user', '{"chat_access":true}', '{}', '{}', true);

select set_config('request.jwt.claim.sub', '4d000000-0000-4000-8000-000000000011', true);
set local role authenticated;

do $$
declare
  target_conversation_id uuid;
  sent_message public.chat_messages;
  valid_attachment_path text;
begin
  target_conversation_id := public.get_or_create_direct_chat(
    '4d000000-0000-4000-8000-000000000012'
  );
  sent_message := public.send_chat_message(
    target_conversation_id, 'Mensagem para autorização', gen_random_uuid()
  );
  valid_attachment_path := '4d000000-0000-4000-8000-000000000001/'
    || target_conversation_id::text
    || '/4d000000-0000-4000-8000-000000000011/documento.pdf';

  if not private.chat_message_access_allowed(
    sent_message.id, '4d000000-0000-4000-8000-000000000011'
  ) then
    raise exception 'O participante não recebeu acesso à própria mensagem.';
  end if;
  if not private.chat_attachment_object_allowed(
    valid_attachment_path, '4d000000-0000-4000-8000-000000000011', true
  ) then
    raise exception 'O caminho válido de anexo foi recusado.';
  end if;
  if private.chat_attachment_object_allowed(
    replace(valid_attachment_path, '4d000000-0000-4000-8000-000000000001',
      '4d000000-0000-4000-8000-000000000002'),
    '4d000000-0000-4000-8000-000000000011', true
  ) then
    raise exception 'Um caminho de outra organização foi autorizado.';
  end if;
  if private.chat_attachment_object_allowed(
    replace(valid_attachment_path, '4d000000-0000-4000-8000-000000000011',
      '4d000000-0000-4000-8000-000000000012'),
    '4d000000-0000-4000-8000-000000000011', true
  ) then
    raise exception 'O usuário recebeu permissão de proprietário sobre anexo alheio.';
  end if;
  if not private.chat_avatar_object_allowed(
    '4d000000-0000-4000-8000-000000000012/avatar.webp',
    '4d000000-0000-4000-8000-000000000011', false
  ) then
    raise exception 'O avatar de usuário da mesma organização foi recusado.';
  end if;
  if private.chat_avatar_object_allowed(
    '4d000000-0000-4000-8000-000000000013/avatar.webp',
    '4d000000-0000-4000-8000-000000000011', false
  ) then
    raise exception 'O avatar de outra organização foi autorizado.';
  end if;
end;
$$;

rollback;

