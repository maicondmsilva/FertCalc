-- FertCalc Phase 2.1: organization foundation and user isolation.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000001', 'FertCalc', 'fertcalc')
on conflict (id) do nothing;

alter table public.app_users
  add column organization_id uuid references public.organizations(id);

update public.app_users
set organization_id = 'f0000000-0000-4000-8000-000000000001'
where organization_id is null;

alter table public.app_users
  alter column organization_id set not null;

create index idx_app_users_organization_id on public.app_users (organization_id);

create or replace function private.user_organization(user_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.app_users
  where id = user_id and coalesce(ativo, true);
$$;

create or replace function private.can_manage_user(caller_id uuid, target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select caller_id is not null and target_id is not null and caller_id <> target_id
    and private.user_organization(caller_id) is not null
    and private.user_organization(caller_id) = private.user_organization(target_id)
    and private.app_user_hierarchy(caller_id) >= 80
    and (
      private.app_user_hierarchy(caller_id) > private.app_user_hierarchy(target_id)
      or (private.app_user_hierarchy(caller_id) = private.app_user_hierarchy(target_id)
        and private.app_user_hierarchy(caller_id) in (80, 100))
    );
$$;

create or replace function private.enforce_app_users_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  caller_hierarchy integer;
  new_role_hierarchy integer;
begin
  if caller_id is null then return new; end if;

  if new.id is distinct from old.id
    or new.id_numeric is distinct from old.id_numeric
    or new.created_at is distinct from old.created_at
    or new.password is distinct from old.password
    or new.organization_id is distinct from old.organization_id then
    raise exception 'immutable app_users fields cannot be changed' using errcode = '42501';
  end if;

  if caller_id = old.id and not private.can_manage_app_user(old.id) then
    if new.email is distinct from old.email or new.role is distinct from old.role
      or new.permissions is distinct from old.permissions
      or new.managed_user_ids is distinct from old.managed_user_ids
      or new.ativo is distinct from old.ativo
      or new.filiais_permitidas is distinct from old.filiais_permitidas
      or new.carregamento_filial_ids is distinct from old.carregamento_filial_ids then
      raise exception 'users cannot change their own authorization fields' using errcode = '42501';
    end if;
    if new.requer_alteracao_senha is distinct from old.requer_alteracao_senha
      and not (old.requer_alteracao_senha is true and new.requer_alteracao_senha is false) then
      raise exception 'invalid first-access flag transition' using errcode = '42501';
    end if;
    return new;
  end if;

  if not private.can_manage_app_user(old.id) then
    raise exception 'insufficient hierarchy to update this user' using errcode = '42501';
  end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  select coalesce((select al.hierarchy_level from public.access_levels al where al.code = new.role), 0)
    into new_role_hierarchy;
  if new_role_hierarchy > caller_hierarchy
    or (new_role_hierarchy = 100 and caller_hierarchy < 100) then
    raise exception 'cannot assign a role above the caller hierarchy' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.user_organization(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_user(uuid, uuid) from public, anon, authenticated;
revoke all on function private.enforce_app_users_update() from public, anon, authenticated;

create or replace function public.get_current_organization_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select private.user_organization((select auth.uid()));
$$;
revoke all on function public.get_current_organization_id() from public, anon;
grant execute on function public.get_current_organization_id() to authenticated;

alter table public.organizations enable row level security;
revoke all privileges on table public.organizations from anon, authenticated;
grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;
grant all privileges on table public.organizations to service_role;

create policy organizations_select_own on public.organizations for select to authenticated
using (id = (select public.get_current_organization_id()));
create policy organizations_update_admin on public.organizations for update to authenticated
using (id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80)
with check (id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80);

drop policy if exists app_users_select_authenticated on public.app_users;
drop policy if exists app_users_update_self_or_manager on public.app_users;
create policy app_users_select_same_organization on public.app_users for select to authenticated
using (organization_id = (select public.get_current_organization_id()));
create policy app_users_update_same_organization on public.app_users for update to authenticated
using (organization_id = (select public.get_current_organization_id())
  and (id = (select auth.uid()) or (select private.can_manage_app_user(id))))
with check (organization_id = (select public.get_current_organization_id())
  and (id = (select auth.uid()) or (select private.can_manage_app_user(id))));

comment on table public.organizations is 'Tenant boundary for FertCalc application data.';
comment on column public.app_users.organization_id is 'Immutable organization assigned by trusted server-side user provisioning.';
comment on function public.get_current_organization_id() is 'Returns the authenticated application user organization.';
