-- Regiões (Etapa 2): cadastro por organização e vínculo usuário ↔ regiões.
-- Gerenciar (criar, editar, excluir, desativar): admin/master ou permissão
-- "regions_manage". Todos da organização leem (para escolher/filtrar).
-- Excluir só apaga região sem uso; com uso, desativa (mantém histórico).

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  name text not null check (length(btrim(name)) between 2 and 80),
  code text check (code is null or length(btrim(code)) between 1 and 20),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists regions_org_name_key
  on public.regions (organization_id, lower(btrim(name)));
create unique index if not exists regions_org_code_key
  on public.regions (organization_id, upper(btrim(code))) where code is not null and btrim(code) <> '';

create table if not exists public.user_regions (
  user_id uuid not null references public.app_users (id) on delete cascade,
  region_id uuid not null references public.regions (id) on delete cascade,
  organization_id uuid references public.organizations (id),
  created_at timestamptz not null default now(),
  primary key (user_id, region_id)
);
create index if not exists user_regions_region_idx on public.user_regions (region_id);

drop trigger if exists enforce_regions_organization on public.regions;
create trigger enforce_regions_organization before insert or update on public.regions
  for each row execute function private.enforce_row_organization();
drop trigger if exists enforce_user_regions_organization on public.user_regions;
create trigger enforce_user_regions_organization before insert or update on public.user_regions
  for each row execute function private.enforce_row_organization();

create or replace function private.can_manage_regions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.app_user_hierarchy((select auth.uid())) >= 80
    or private.current_user_has_permission('regions_manage');
$$;
revoke all on function private.can_manage_regions() from public, anon;
grant execute on function private.can_manage_regions() to authenticated;

alter table public.regions enable row level security;
alter table public.user_regions enable row level security;
revoke all on public.regions, public.user_regions from anon;

create policy regions_select on public.regions for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));
create policy regions_insert on public.regions for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions());
create policy regions_update on public.regions for update to authenticated
  using (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions())
  with check (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions());
create policy regions_delete on public.regions for delete to authenticated
  using (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions());

create policy user_regions_select on public.user_regions for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));
create policy user_regions_insert on public.user_regions for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions());
create policy user_regions_delete on public.user_regions for delete to authenticated
  using (organization_id = (select public.get_current_organization_id()) and private.can_manage_regions());

-- Atualiza o carimbo de alteração.
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_regions_updated_at on public.regions;
create trigger touch_regions_updated_at before update on public.regions
  for each row execute function private.touch_updated_at();

-- Excluir ou desativar: com usuários vinculados (ou, nas próximas etapas,
-- registros da região), desativa; sem uso, apaga.
create or replace function public.excluir_ou_desativar_regiao(p_region_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  in_use boolean;
begin
  if not private.can_manage_regions() then
    raise exception 'Sem permissão para gerenciar regiões.' using errcode = '42501';
  end if;
  select exists (select 1 from public.user_regions ur where ur.region_id = p_region_id)
    into in_use;
  if in_use then
    update public.regions set ativo = false where id = p_region_id;
    if not found then
      raise exception 'Região não encontrada.' using errcode = 'P0002';
    end if;
    return 'desativada';
  end if;
  delete from public.regions where id = p_region_id;
  if not found then
    raise exception 'Região não encontrada.' using errcode = 'P0002';
  end if;
  return 'excluida';
end;
$$;
revoke all on function public.excluir_ou_desativar_regiao(uuid) from public, anon;
grant execute on function public.excluir_ou_desativar_regiao(uuid) to authenticated;
