-- Fase 1: persistir o perfil aplicado e impedir escalacao de privilegios pelo cliente.

alter table public.app_users
  add column if not exists access_profile_id uuid;

alter table public.app_users
  drop constraint if exists app_users_access_profile_id_fkey,
  add constraint app_users_access_profile_id_fkey
    foreign key (access_profile_id)
    references public.access_profiles(id)
    on delete set null;

create index if not exists idx_app_users_access_profile_id
  on public.app_users(access_profile_id);

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
  -- Operacoes confiaveis do servidor (postgres/service_role) nao possuem auth.uid().
  if caller_id is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.id_numeric is distinct from old.id_numeric
    or new.created_at is distinct from old.created_at
    or new.password is distinct from old.password then
    raise exception 'immutable app_users fields cannot be changed'
      using errcode = '42501';
  end if;

  if caller_id = old.id and not private.can_manage_app_user(old.id) then
    if new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.permissions is distinct from old.permissions
      or new.managed_user_ids is distinct from old.managed_user_ids
      or new.ativo is distinct from old.ativo
      or new.filiais_permitidas is distinct from old.filiais_permitidas
      or new.carregamento_filial_ids is distinct from old.carregamento_filial_ids
      or new.access_profile_id is distinct from old.access_profile_id then
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

comment on column public.app_users.access_profile_id is
  'Perfil de acesso aplicado; as permissoes sao persistidas como fotografia editavel.';

notify pgrst, 'reload schema';
