-- FertCalc P0.1: protect app_users from anonymous access, privilege escalation,
-- unauthorized hierarchy changes, and destructive writes from browser clients.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.app_user_hierarchy(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select al.hierarchy_level
      from public.app_users au
      left join public.access_levels al on al.code = au.role
      where au.id = target_user_id
    ),
    0
  );
$$;

create or replace function private.can_manage_app_user(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_hierarchy integer;
  target_hierarchy integer;
begin
  if caller_id is null or caller_id = target_user_id then
    return false;
  end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  target_hierarchy := private.app_user_hierarchy(target_user_id);

  if caller_hierarchy < 80 then
    return false;
  end if;

  return caller_hierarchy > target_hierarchy
    or (caller_hierarchy = 100 and target_hierarchy = 100)
    or (caller_hierarchy = 80 and target_hierarchy = 80);
end;
$$;

revoke all on function private.app_user_hierarchy(uuid) from public;
revoke all on function private.can_manage_app_user(uuid) from public;
grant execute on function private.app_user_hierarchy(uuid) to authenticated;
grant execute on function private.can_manage_app_user(uuid) to authenticated;

create or replace function private.enforce_app_users_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_hierarchy integer;
  new_role_hierarchy integer;
begin
  -- Trusted server-side operations (postgres/service_role) have no auth user.
  if caller_id is null then
    return new;
  end if;

  -- Immutable identity and legacy credential columns are never browser-editable.
  if new.id is distinct from old.id
    or new.id_numeric is distinct from old.id_numeric
    or new.created_at is distinct from old.created_at
    or new.password is distinct from old.password then
    raise exception 'immutable app_users fields cannot be changed'
      using errcode = '42501';
  end if;

  if caller_id = old.id and not private.can_manage_app_user(old.id) then
    -- A regular user may only maintain display fields and complete first access.
    if new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.permissions is distinct from old.permissions
      or new.managed_user_ids is distinct from old.managed_user_ids
      or new.ativo is distinct from old.ativo
      or new.filiais_permitidas is distinct from old.filiais_permitidas
      or new.carregamento_filial_ids is distinct from old.carregamento_filial_ids then
      raise exception 'users cannot change their own authorization fields'
        using errcode = '42501';
    end if;

    if new.requer_alteracao_senha is distinct from old.requer_alteracao_senha
      and not (old.requer_alteracao_senha is true and new.requer_alteracao_senha is false) then
      raise exception 'invalid first-access flag transition'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if not private.can_manage_app_user(old.id) then
    raise exception 'insufficient hierarchy to update this user'
      using errcode = '42501';
  end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  select coalesce(
    (select al.hierarchy_level from public.access_levels al where al.code = new.role),
    0
  ) into new_role_hierarchy;

  if new_role_hierarchy > caller_hierarchy
    or (new_role_hierarchy = 100 and caller_hierarchy < 100) then
    raise exception 'cannot assign a role above the caller hierarchy'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_app_users_update() from public;

drop trigger if exists enforce_app_users_update on public.app_users;
create trigger enforce_app_users_update
before update on public.app_users
for each row execute function private.enforce_app_users_update();

-- Remove every known permissive policy before installing least-privilege rules.
drop policy if exists "Enable all for app_users" on public.app_users;
drop policy if exists "Open access for app_users" on public.app_users;
drop policy if exists "app_users: leitura própria ou admin" on public.app_users;
drop policy if exists "app_users: inserção apenas admin/master" on public.app_users;
drop policy if exists "app_users: atualização própria ou admin" on public.app_users;
drop policy if exists "app_users: exclusão apenas admin/master" on public.app_users;

alter table public.app_users enable row level security;

create policy "app_users_select_authenticated"
on public.app_users
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "app_users_update_self_or_manager"
on public.app_users
for update
to authenticated
using (
  id = (select auth.uid())
  or (select private.can_manage_app_user(id))
)
with check (
  id = (select auth.uid())
  or (select private.can_manage_app_user(id))
);

-- User lifecycle operations are server-side only through trusted Edge Functions.
revoke all privileges on table public.app_users from anon;
revoke all privileges on table public.app_users from authenticated;
grant select, update on table public.app_users to authenticated;
grant all privileges on table public.app_users to service_role;

comment on function private.can_manage_app_user(uuid) is
  'Returns whether the authenticated caller can manage the target app user.';
comment on function private.enforce_app_users_update() is
  'Prevents browser clients from changing protected identity and authorization fields.';

