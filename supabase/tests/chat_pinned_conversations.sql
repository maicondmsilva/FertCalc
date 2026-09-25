begin;

insert into public.organizations (id, name, slug) values
  ('4a000000-0000-4000-8000-000000000001', 'Chat Pinned Organização', 'chat-pinned-org');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  ('4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001',
   'chat-pin-a@example.test', 'Chat Pin A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('4a000000-0000-4000-8000-000000000002', '4a000000-0000-4000-8000-000000000001',
   'chat-pin-b@example.test', 'Chat Pin B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  target_conversation_id uuid;
begin
  target_conversation_id := public.get_or_create_direct_chat(
    '4a000000-0000-4000-8000-000000000002'
  );

  perform public.update_chat_preferences(target_conversation_id, false, null, true);

  if not exists (
    select 1
    from public.list_chat_conversations(50, false) conversation
    where conversation.conversation_id = target_conversation_id
      and conversation.pinned_at is not null
  ) then
    raise exception 'A conversa fixada não foi retornada corretamente.';
  end if;

  perform public.update_chat_preferences(target_conversation_id, false, null, false);

  if exists (
    select 1
    from public.chat_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = '4a000000-0000-4000-8000-000000000001'
      and participant.pinned_at is not null
  ) then
    raise exception 'A conversa permaneceu fixada após a remoção da preferência.';
  end if;
end;
$$;

rollback;

