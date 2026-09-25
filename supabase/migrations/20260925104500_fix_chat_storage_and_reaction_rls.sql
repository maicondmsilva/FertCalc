-- RLS policies must not call generic private tenant helpers directly. Expose
-- narrowly scoped authorization predicates that also bind the authenticated user.

create or replace function private.chat_message_access_allowed(
  p_message_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    and private.chat_user_enabled(p_user_id)
    and exists (
      select 1
      from public.chat_messages message
      where message.id = p_message_id
        and private.chat_is_participant(message.conversation_id, p_user_id)
    );
$$;

create or replace function private.chat_attachment_object_allowed(
  p_object_name text,
  p_user_id uuid,
  p_require_owner boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[] := string_to_array(p_object_name, '/');
  path_organization uuid;
  path_conversation uuid;
  path_owner uuid;
begin
  if p_user_id is null
     or p_user_id <> (select auth.uid())
     or array_length(path_parts, 1) <> 4
     or path_parts[1] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[2] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[3] !~ '^[0-9a-fA-F-]{36}$'
     or coalesce(path_parts[4], '') = '' then
    return false;
  end if;

  begin
    path_organization := path_parts[1]::uuid;
    path_conversation := path_parts[2]::uuid;
    path_owner := path_parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return private.chat_user_enabled(p_user_id)
    and path_organization = private.user_organization(p_user_id)
    and private.chat_is_participant(path_conversation, p_user_id)
    and (not p_require_owner or path_owner = p_user_id);
end;
$$;

create or replace function private.chat_avatar_object_allowed(
  p_object_name text,
  p_user_id uuid,
  p_require_owner boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[] := string_to_array(p_object_name, '/');
  avatar_owner uuid;
begin
  if p_user_id is null
     or p_user_id <> (select auth.uid())
     or array_length(path_parts, 1) <> 2
     or path_parts[1] !~ '^[0-9a-fA-F-]{36}$'
     or path_parts[2] !~ '^avatar\.(png|jpg|jpeg|webp)$' then
    return false;
  end if;

  begin
    avatar_owner := path_parts[1]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return private.chat_user_enabled(p_user_id)
    and (not p_require_owner or avatar_owner = p_user_id)
    and exists (
      select 1
      from public.app_users owner_user
      where owner_user.id = avatar_owner
        and owner_user.ativo is true
        and owner_user.organization_id = private.user_organization(p_user_id)
    );
end;
$$;

revoke all on function private.chat_message_access_allowed(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.chat_attachment_object_allowed(text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function private.chat_avatar_object_allowed(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function private.chat_message_access_allowed(uuid, uuid) to authenticated;
grant execute on function private.chat_attachment_object_allowed(text, uuid, boolean) to authenticated;
grant execute on function private.chat_avatar_object_allowed(text, uuid, boolean) to authenticated;

drop policy if exists chat_message_reactions_select_participant on public.chat_message_reactions;
create policy chat_message_reactions_select_participant
on public.chat_message_reactions for select to authenticated
using (
  private.chat_message_access_allowed(message_id, (select auth.uid()))
);

drop policy if exists chat_attachments_select_participant on public.chat_message_attachments;
create policy chat_attachments_select_participant
on public.chat_message_attachments for select to authenticated
using (
  private.chat_message_access_allowed(message_id, (select auth.uid()))
);

drop policy if exists chat_attachment_objects_select_participant on storage.objects;
create policy chat_attachment_objects_select_participant
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and private.chat_attachment_object_allowed(name, (select auth.uid()), false)
);

drop policy if exists chat_attachment_objects_insert_participant on storage.objects;
create policy chat_attachment_objects_insert_participant
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and private.chat_attachment_object_allowed(name, (select auth.uid()), true)
);

drop policy if exists chat_attachment_objects_delete_own on storage.objects;
create policy chat_attachment_objects_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and private.chat_attachment_object_allowed(name, (select auth.uid()), true)
);

drop policy if exists chat_avatar_read_same_organization on storage.objects;
create policy chat_avatar_read_same_organization
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-avatars'
  and private.chat_avatar_object_allowed(name, (select auth.uid()), false)
);

drop policy if exists chat_avatar_insert_own on storage.objects;
create policy chat_avatar_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-avatars'
  and private.chat_avatar_object_allowed(name, (select auth.uid()), true)
);

drop policy if exists chat_avatar_update_own on storage.objects;
create policy chat_avatar_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'chat-avatars'
  and private.chat_avatar_object_allowed(name, (select auth.uid()), true)
)
with check (
  bucket_id = 'chat-avatars'
  and private.chat_avatar_object_allowed(name, (select auth.uid()), true)
);

drop policy if exists chat_avatar_delete_own on storage.objects;
create policy chat_avatar_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-avatars'
  and private.chat_avatar_object_allowed(name, (select auth.uid()), true)
);

