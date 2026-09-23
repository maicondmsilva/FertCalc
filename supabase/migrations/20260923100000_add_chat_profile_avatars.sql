-- Avatar privado do chat, visível somente para usuários habilitados da mesma organização.

alter table public.app_users
  add column if not exists avatar_path text;

alter table public.app_users
  add constraint app_users_avatar_path_check
  check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/avatar\.(png|jpg|jpeg|webp)$')
  ) not valid;
alter table public.app_users validate constraint app_users_avatar_path_check;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-avatars',
  'chat-avatars',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_avatar_read_same_organization on storage.objects;
create policy chat_avatar_read_same_organization
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-avatars'
  and exists (
    select 1
    from public.app_users owner_user
    where owner_user.id::text = (storage.foldername(name))[1]
      and owner_user.organization_id = private.user_organization((select auth.uid()))
      and private.chat_user_enabled(owner_user.id)
  )
);

drop policy if exists chat_avatar_insert_own on storage.objects;
create policy chat_avatar_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.chat_user_enabled((select auth.uid()))
);

drop policy if exists chat_avatar_update_own on storage.objects;
create policy chat_avatar_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'chat-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'chat-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists chat_avatar_delete_own on storage.objects;
create policy chat_avatar_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.set_own_chat_avatar(p_avatar_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if p_avatar_path is not null
     and p_avatar_path !~ ('^' || caller_id::text || '/avatar\.(png|jpg|jpeg|webp)$') then
    raise exception 'Caminho de avatar inválido.' using errcode = '22023';
  end if;
  update public.app_users
  set avatar_path = p_avatar_path, updated_at = now()
  where id = caller_id;
end;
$$;

revoke all on function public.set_own_chat_avatar(text) from public, anon;
grant execute on function public.set_own_chat_avatar(text) to authenticated;

drop function if exists public.get_chat_profile(uuid);
create function public.get_chat_profile(p_user_id uuid)
returns table (
  id uuid, name text, nickname text, email text, phone text, job_title text,
  role text, chat_status text, chat_status_message text, avatar_path text
)
language plpgsql stable security definer set search_path = ''
as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  return query
  select u.id, u.name, u.nickname, u.email, u.phone, u.job_title, u.role,
         u.chat_status, u.chat_status_message, u.avatar_path
  from public.app_users u
  where u.id = p_user_id
    and u.organization_id = private.user_organization(caller_id)
    and u.ativo is true and private.chat_user_enabled(u.id);
end;
$$;

drop function if exists public.list_chat_contact_statuses();
create function public.list_chat_contact_statuses()
returns table (user_id uuid, chat_status text, avatar_path text)
language plpgsql stable security definer set search_path = ''
as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  return query
  select u.id, u.chat_status, u.avatar_path
  from public.app_users u
  where u.organization_id = private.user_organization(caller_id)
    and u.ativo is true and private.chat_user_enabled(u.id);
end;
$$;

revoke all on function public.get_chat_profile(uuid) from public, anon;
revoke all on function public.list_chat_contact_statuses() from public, anon;
grant execute on function public.get_chat_profile(uuid) to authenticated;
grant execute on function public.list_chat_contact_statuses() to authenticated;

