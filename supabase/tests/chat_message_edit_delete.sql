begin;

insert into public.organizations (id, name, slug) values
  ('44000000-0000-4000-8000-000000000001', 'Chat Edit Organização', 'chat-edit-org');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001',
   'chat-edit-a@example.test', 'Chat Edit A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001',
   'chat-edit-b@example.test', 'Chat Edit B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  conversation_id uuid;
  own_message public.chat_messages;
  changed_message public.chat_messages;
begin
  conversation_id := public.get_or_create_direct_chat(
    '45000000-0000-4000-8000-000000000002'
  );
  own_message := public.send_chat_message(
    conversation_id,
    'Texto original',
    '46000000-0000-4000-8000-000000000001'
  );

  changed_message := public.edit_chat_message(own_message.id, 'Texto corrigido');
  if changed_message.body <> 'Texto corrigido' or changed_message.edited_at is null then
    raise exception 'A edição da mensagem não foi persistida.';
  end if;

  changed_message := public.delete_chat_message(own_message.id);
  if changed_message.body <> '' or changed_message.deleted_at is null then
    raise exception 'A exclusão lógica da mensagem não foi persistida.';
  end if;
  if not exists (
    select 1
    from public.get_chat_messages(conversation_id, null, null, 50) message
    where message.id = own_message.id and message.deleted_at is not null
  ) then
    raise exception 'A mensagem excluída não foi mantida no histórico.';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  message_id uuid;
begin
  select id into message_id
  from public.chat_messages
  where sender_id = '45000000-0000-4000-8000-000000000001'
  limit 1;

  begin
    perform public.edit_chat_message(message_id, 'Alteração indevida');
    raise exception 'Foi permitido editar a mensagem de outro usuário.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.delete_chat_message(message_id);
    raise exception 'Foi permitido excluir a mensagem de outro usuário.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
