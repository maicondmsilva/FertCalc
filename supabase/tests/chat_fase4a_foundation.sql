begin;

insert into public.organizations (id, name, slug) values
  ('40000000-0000-4000-8000-000000000001', 'Chat Organização A', 'chat-org-a'),
  ('40000000-0000-4000-8000-000000000002', 'Chat Organização B', 'chat-org-b');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'chat-a1@example.test', 'Chat A1', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001',
   'chat-a2@example.test', 'Chat A2', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001',
   'chat-disabled@example.test', 'Chat Bloqueado', '', 'user', '{}', '{}', '{}', true),
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   'chat-b1@example.test', 'Chat B1', '', 'user', '{"chat_access":true}', '{}', '{}', true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  conversation_one uuid;
  conversation_two uuid;
  message_one public.chat_messages;
  message_two public.chat_messages;
begin
  conversation_one := public.get_or_create_direct_chat(
    '41000000-0000-4000-8000-000000000002'
  );
  conversation_two := public.get_or_create_direct_chat(
    '41000000-0000-4000-8000-000000000002'
  );
  if conversation_one <> conversation_two then
    raise exception 'Conversa direta duplicada.';
  end if;

  message_one := public.send_chat_message(
    conversation_one, 'Mensagem segura', '43000000-0000-4000-8000-000000000001'
  );
  message_two := public.send_chat_message(
    conversation_one, 'Mensagem segura', '43000000-0000-4000-8000-000000000001'
  );
  if message_one.id <> message_two.id then
    raise exception 'Retentativa criou mensagem duplicada.';
  end if;

  if (select count(*) from public.get_chat_messages(conversation_one, null, null, 50)) <> 1 then
    raise exception 'Paginação não retornou a mensagem esperada.';
  end if;

  if (select count(*) from public.list_chat_contacts('Chat A2', 20)) <> 1 then
    raise exception 'Busca segura de contatos retornou resultado incorreto.';
  end if;
  if (select count(*) from public.list_chat_conversations(50)) <> 1 then
    raise exception 'Lista de conversas retornou resultado incorreto.';
  end if;

  perform public.mark_chat_read(conversation_one, now());

  begin
    perform public.get_or_create_direct_chat('42000000-0000-4000-8000-000000000001');
    raise exception 'Conversa entre organizações foi permitida.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.get_or_create_direct_chat('41000000-0000-4000-8000-000000000003');
    raise exception 'Usuário sem permissão foi incluído.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  if exists (select 1 from public.chat_conversations)
     or exists (select 1 from public.chat_messages) then
    raise exception 'RLS expôs conversa de outra organização.';
  end if;
end;
$$;

rollback;
