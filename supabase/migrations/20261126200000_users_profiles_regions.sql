-- Etapa 3: Usuários + Perfis de acesso.
--
-- 1) Perfis de acesso passam a pertencer à empresa (organization_id). Antes,
--    qualquer usuário logado via os perfis de todas as empresas, e cada regra
--    existia em dobro (8 políticas para 4 ações).
-- 2) Região principal: no máximo uma por usuário; é a região que já vem marcada
--    ao salvar a precificação.
-- 3) Quem gerencia um usuário (hierarquia) também vincula as regiões dele, além
--    de quem tem "Regiões — Gerenciar".

-- ── 1. Perfis de acesso por empresa ───────────────────────────────────────
alter table public.access_profiles
  add column if not exists organization_id uuid references public.organizations (id);

do $$
declare
  orgs integer;
begin
  select count(*) into orgs from public.organizations;
  if orgs = 1 then
    update public.access_profiles
       set organization_id = (select id from public.organizations limit 1)
     where organization_id is null;
  end if;
  if not exists (select 1 from public.access_profiles where organization_id is null) then
    alter table public.access_profiles alter column organization_id set not null;
  else
    raise notice 'access_profiles sem empresa: revise antes de tornar obrigatório';
  end if;
end;
$$;

create index if not exists access_profiles_org_idx on public.access_profiles (organization_id);

drop trigger if exists enforce_access_profiles_organization on public.access_profiles;
create trigger enforce_access_profiles_organization before insert or update on public.access_profiles
  for each row execute function private.enforce_row_organization();

-- Nome único dentro da empresa (sem diferença de maiúsculas).
create unique index if not exists access_profiles_org_name_key
  on public.access_profiles (organization_id, lower(btrim(name)));

drop policy if exists "Admin e master podem criar perfis de acesso" on public.access_profiles;
drop policy if exists "Admin e master podem editar perfis de acesso" on public.access_profiles;
drop policy if exists "Admin e master podem excluir perfis de acesso" on public.access_profiles;
drop policy if exists "Autenticados podem ver perfis de acesso" on public.access_profiles;
drop policy if exists "access_profiles: delete" on public.access_profiles;
drop policy if exists "access_profiles: insert" on public.access_profiles;
drop policy if exists "access_profiles: select" on public.access_profiles;
drop policy if exists "access_profiles: update" on public.access_profiles;

alter table public.access_profiles enable row level security;
revoke all on public.access_profiles from anon;

create policy access_profiles_select on public.access_profiles for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));
create policy access_profiles_insert on public.access_profiles for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id())
              and (select public.is_admin_or_master()));
create policy access_profiles_update on public.access_profiles for update to authenticated
  using (organization_id = (select public.get_current_organization_id())
         and (select public.is_admin_or_master()))
  with check (organization_id = (select public.get_current_organization_id())
              and (select public.is_admin_or_master()));
create policy access_profiles_delete on public.access_profiles for delete to authenticated
  using (organization_id = (select public.get_current_organization_id())
         and (select public.is_admin_or_master()));

-- Usuário só pode receber perfil da própria empresa.
create or replace function private.check_app_user_profile_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.access_profile_id is not null and not exists (
    select 1 from public.access_profiles ap
     where ap.id = new.access_profile_id
       and ap.organization_id = new.organization_id
  ) then
    raise exception 'Perfil de acesso de outra empresa.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists check_app_user_profile_organization on public.app_users;
create trigger check_app_user_profile_organization
  before insert or update of access_profile_id on public.app_users
  for each row execute function private.check_app_user_profile_organization();

-- ── 2. Região principal ───────────────────────────────────────────────────
alter table public.user_regions
  add column if not exists principal boolean not null default false;
create unique index if not exists user_regions_one_principal
  on public.user_regions (user_id) where principal;

-- ── 3. Quem vincula regiões a um usuário ──────────────────────────────────
create or replace function private.can_link_user_regions(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_regions() or private.can_manage_app_user(target_user_id);
$$;
revoke all on function private.can_link_user_regions(uuid) from public, anon;
grant execute on function private.can_link_user_regions(uuid) to authenticated;

drop policy if exists user_regions_insert on public.user_regions;
drop policy if exists user_regions_delete on public.user_regions;
drop policy if exists user_regions_update on public.user_regions;
create policy user_regions_insert on public.user_regions for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id())
              and private.can_link_user_regions(user_id));
create policy user_regions_update on public.user_regions for update to authenticated
  using (organization_id = (select public.get_current_organization_id())
         and private.can_link_user_regions(user_id))
  with check (organization_id = (select public.get_current_organization_id())
              and private.can_link_user_regions(user_id));
create policy user_regions_delete on public.user_regions for delete to authenticated
  using (organization_id = (select public.get_current_organization_id())
         and private.can_link_user_regions(user_id));

-- Região do vínculo precisa ser da mesma empresa e estar ativa ao vincular.
create or replace function private.check_user_region_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.regions r
     where r.id = new.region_id and r.organization_id = new.organization_id
       and (r.ativo or tg_op = 'UPDATE')
  ) then
    raise exception 'Região inativa ou de outra empresa.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_check_user_region_link on public.user_regions;
create trigger trg_check_user_region_link before insert or update on public.user_regions
  for each row execute function private.check_user_region_link();

-- Salva de uma vez as regiões de um usuário (e a principal), numa transação.
create or replace function public.definir_regioes_usuario(
  p_user_id uuid,
  p_region_ids uuid[],
  p_principal uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ids uuid[] := coalesce(p_region_ids, '{}');
begin
  if not private.can_link_user_regions(p_user_id) then
    raise exception 'Sem permissão para alterar as regiões deste usuário.' using errcode = '42501';
  end if;
  if p_principal is not null and not (p_principal = any (ids)) then
    raise exception 'A região principal precisa estar entre as regiões do usuário.' using errcode = '22023';
  end if;

  delete from public.user_regions where user_id = p_user_id and not (region_id = any (ids));
  update public.user_regions set principal = false where user_id = p_user_id and principal;
  insert into public.user_regions (user_id, region_id)
    select p_user_id, r from unnest(ids) as r
    on conflict (user_id, region_id) do nothing;
  -- Uma região só: ela é a principal.
  update public.user_regions
     set principal = true
   where user_id = p_user_id
     and region_id = coalesce(p_principal, case when cardinality(ids) = 1 then ids[1] end);
end;
$$;
revoke all on function public.definir_regioes_usuario(uuid, uuid[], uuid) from public, anon;
grant execute on function public.definir_regioes_usuario(uuid, uuid[], uuid) to authenticated;
