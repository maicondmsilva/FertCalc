begin;

do $$
declare
  owner_id uuid := '43000000-0000-4000-8000-000000000001';
  member_one uuid := '43000000-0000-4000-8000-000000000002';
  conversation_id uuid;
begin
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  conversation_id := public.create_group_chat('Equipe comercial', array[member_one]);

  if (select count(*) from public.list_chat_group_members(conversation_id)) <> 2 then
    raise exception 'A lista inicial de participantes está incorreta.';
  end if;

  perform public.update_chat_group_members(conversation_id, '{}'::uuid[]);

  if exists (
    select 1 from public.list_chat_group_members(conversation_id) member
    where member.user_id = member_one
  ) then
    raise exception 'O participante removido permaneceu no grupo.';
  end if;

  if not exists (
    select 1 from public.list_chat_group_members(conversation_id) member
    where member.user_id = owner_id and member.participant_role = 'owner'
  ) then
    raise exception 'O proprietário foi removido ou perdeu sua função.';
  end if;

  perform public.update_chat_group_members(conversation_id, array[member_one]);

  if not exists (
    select 1 from public.list_chat_group_members(conversation_id) member
    where member.user_id = member_one and member.participant_role = 'member'
  ) then
    raise exception 'O participante não foi incluído novamente.';
  end if;

  perform set_config('request.jwt.claim.sub', member_one::text, true);
  begin
    perform public.update_chat_group_members(conversation_id, array[member_one]);
    raise exception 'Um membro comum conseguiu administrar o grupo.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;
