begin;

insert into public.organizations (id, name, slug) values
  ('47000000-0000-4000-8000-000000000001', 'Chat Reactions Organização', 'chat-reactions-org');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('48000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001',
   'chat-reaction-a@example.test', 'Chat Reaction A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('48000000-0000-4000-8000-000000000002', '47000000-0000-4000-8000-000000000001',
   'chat-reaction-b@example.test', 'Chat Reaction B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"48000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  conversation_id uuid;
  sent_message public.chat_messages;
begin
  conversation_id := public.get_or_create_direct_chat(
    '48000000-0000-4000-8000-000000000002'
  );
  sent_message := public.send_chat_message(
    conversation_id,
    'Mensagem com reação',
    '49000000-0000-4000-8000-000000000001'
  );

  if not public.toggle_chat_message_reaction(sent_message.id, '👍') then
    raise exception 'A reação não foi adicionada.';
  end if;
  if not exists (
    select 1 from public.list_chat_message_reactions(conversation_id) reaction
    where reaction.message_id = sent_message.id
      and reaction.emoji = '👍'
      and reaction.reaction_count = 1
      and reaction.reacted_by_me
  ) then
    raise exception 'A reação adicionada não foi listada.';
  end if;
  if public.toggle_chat_message_reaction(sent_message.id, '👍') then
    raise exception 'A reação não foi removida.';
  end if;
end;
$$;

rollback;
