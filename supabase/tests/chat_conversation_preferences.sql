begin;

insert into public.organizations (id, name, slug) values
  ('49000000-0000-4000-8000-000000000001', 'Chat Preferences Organização', 'chat-preferences-org');

insert into public.app_users (
  id, organization_id, email, name, phone, role, permissions, assigned_manager_ids,
  settings, ativo
) values
  ('49000000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001',
   'chat-pref-a@example.test', 'Chat Pref A', '', 'user', '{"chat_access":true}', '{}', '{}', true),
  ('49000000-0000-4000-8000-000000000002', '49000000-0000-4000-8000-000000000001',
   'chat-pref-b@example.test', 'Chat Pref B', '', 'user', '{"chat_access":true}', '{}', '{}', true);

select set_config('request.jwt.claim.sub', '49000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  target_conversation_id uuid;
  archived_count integer;
  active_count integer;
begin
  target_conversation_id := public.get_or_create_direct_chat(
    '49000000-0000-4000-8000-000000000002'
  );

  perform public.update_chat_preferences(target_conversation_id, true, now() + interval '8 hours');
  select count(*) into archived_count
  from public.list_chat_conversations(50, true) conversation
  where conversation.conversation_id = target_conversation_id
    and conversation.archived_at is not null
    and conversation.muted_until > now();

  if archived_count <> 1 then
    raise exception 'A conversa arquivada e silenciada não foi listada.';
  end if;

  select set_config('request.jwt.claim.sub', '49000000-0000-4000-8000-000000000002', true);
  perform public.get_or_create_direct_chat('49000000-0000-4000-8000-000000000001');
  select set_config('request.jwt.claim.sub', '49000000-0000-4000-8000-000000000001', true);

  if not exists (
    select 1 from public.chat_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = '49000000-0000-4000-8000-000000000001'
      and participant.archived_at is not null
  ) then
    raise exception 'Outro participante alterou indevidamente a preferência de arquivamento.';
  end if;

  perform public.update_chat_preferences(target_conversation_id, false, null);
  select count(*) into active_count
  from public.list_chat_conversations(50, false) conversation
  where conversation.conversation_id = target_conversation_id
    and conversation.archived_at is null
    and conversation.muted_until is null;

  if active_count <> 1 then
    raise exception 'A conversa não foi restaurada corretamente.';
  end if;
end;
$$;

rollback;
