-- Restringe produtos extras da calculadora aos locais de carregamento escolhidos.

alter table public.macro_materials
  add constraint macro_materials_id_organization_key unique (id, organization_id);

alter table public.micro_materials
  add constraint micro_materials_id_organization_key unique (id, organization_id);

create table public.calculator_extra_product_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.get_current_organization_id()
    references public.organizations(id),
  macro_material_id uuid,
  micro_material_id uuid,
  local_carregamento_id uuid not null,
  created_at timestamptz not null default now(),
  constraint calculator_extra_product_locations_single_product_check check (
    num_nonnulls(macro_material_id, micro_material_id) = 1
  ),
  constraint calculator_extra_product_locations_macro_organization_fk
    foreign key (macro_material_id, organization_id)
    references public.macro_materials (id, organization_id) on delete cascade,
  constraint calculator_extra_product_locations_micro_organization_fk
    foreign key (micro_material_id, organization_id)
    references public.micro_materials (id, organization_id) on delete cascade,
  constraint calculator_extra_product_locations_location_organization_fk
    foreign key (local_carregamento_id, organization_id)
    references public.locais_carregamento (id, organization_id) on delete cascade
);

create unique index calculator_extra_product_locations_macro_key
  on public.calculator_extra_product_locations (macro_material_id, local_carregamento_id)
  where macro_material_id is not null;

create unique index calculator_extra_product_locations_micro_key
  on public.calculator_extra_product_locations (micro_material_id, local_carregamento_id)
  where micro_material_id is not null;

create index calculator_extra_product_locations_organization_idx
  on public.calculator_extra_product_locations (organization_id, local_carregamento_id);

alter table public.calculator_extra_product_locations enable row level security;

revoke all on table public.calculator_extra_product_locations from anon, authenticated;
grant select, insert, update, delete on table public.calculator_extra_product_locations
  to authenticated;

create policy calculator_extra_product_locations_select_organization
on public.calculator_extra_product_locations for select to authenticated
using (organization_id = (select public.get_current_organization_id()));

create policy calculator_extra_product_locations_insert_organization
on public.calculator_extra_product_locations for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

create policy calculator_extra_product_locations_update_organization
on public.calculator_extra_product_locations for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

create policy calculator_extra_product_locations_delete_organization
on public.calculator_extra_product_locations for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

create trigger enforce_calculator_extra_product_locations_organization
before insert or update on public.calculator_extra_product_locations
for each row execute function private.enforce_row_organization();

-- Preserva o comportamento dos produtos extras já existentes.
insert into public.calculator_extra_product_locations (
  organization_id,
  macro_material_id,
  local_carregamento_id
)
select material.organization_id, material.id, location.id
from public.macro_materials material
join public.locais_carregamento location
  on location.organization_id = material.organization_id
 and location.ativo = true
where material.available_in_calculator_without_price_list = true
on conflict do nothing;

insert into public.calculator_extra_product_locations (
  organization_id,
  micro_material_id,
  local_carregamento_id
)
select material.organization_id, material.id, location.id
from public.micro_materials material
join public.locais_carregamento location
  on location.organization_id = material.organization_id
 and location.ativo = true
where material.available_in_calculator_without_price_list = true
on conflict do nothing;

create or replace function public.set_calculator_extra_product_locations(
  p_product_type text,
  p_product_id uuid,
  p_enabled boolean,
  p_location_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_organization_id uuid := public.get_current_organization_id();
  requested_location_count integer;
  valid_location_count integer;
begin
  if private.app_user_hierarchy((select auth.uid())) < 80 then
    raise exception 'Sem permissão para configurar produtos extras.'
      using errcode = '42501';
  end if;

  if p_product_type not in ('macro', 'micro') then
    raise exception 'Tipo de produto inválido.' using errcode = '22023';
  end if;

  select count(distinct location_id)
    into requested_location_count
  from unnest(coalesce(p_location_ids, '{}'::uuid[])) as location_id;

  if p_enabled and requested_location_count = 0 then
    raise exception 'Selecione ao menos um local de carregamento.' using errcode = '22023';
  end if;

  select count(*)
    into valid_location_count
  from public.locais_carregamento
  where organization_id = current_organization_id
    and ativo = true
    and id = any(coalesce(p_location_ids, '{}'::uuid[]));

  if p_enabled and valid_location_count <> requested_location_count then
    raise exception 'Um ou mais locais de carregamento são inválidos ou estão inativos.'
      using errcode = '22023';
  end if;

  if p_product_type = 'macro' then
    if not exists (
      select 1 from public.macro_materials
      where id = p_product_id and organization_id = current_organization_id
    ) then
      raise exception 'Produto macro não encontrado.' using errcode = 'P0002';
    end if;

    delete from public.calculator_extra_product_locations
    where macro_material_id = p_product_id;

    if p_enabled then
      insert into public.calculator_extra_product_locations (
        organization_id, macro_material_id, local_carregamento_id
      )
      select current_organization_id, p_product_id, location_id
      from unnest(p_location_ids) as location_id
      on conflict do nothing;
    end if;

    update public.macro_materials
    set available_in_calculator_without_price_list = p_enabled,
        updated_at = now()
    where id = p_product_id and organization_id = current_organization_id;
  else
    if not exists (
      select 1 from public.micro_materials
      where id = p_product_id and organization_id = current_organization_id
    ) then
      raise exception 'Produto micro não encontrado.' using errcode = 'P0002';
    end if;

    delete from public.calculator_extra_product_locations
    where micro_material_id = p_product_id;

    if p_enabled then
      insert into public.calculator_extra_product_locations (
        organization_id, micro_material_id, local_carregamento_id
      )
      select current_organization_id, p_product_id, location_id
      from unnest(p_location_ids) as location_id
      on conflict do nothing;
    end if;

    update public.micro_materials
    set available_in_calculator_without_price_list = p_enabled,
        updated_at = now()
    where id = p_product_id and organization_id = current_organization_id;
  end if;
end;
$$;

revoke all on function public.set_calculator_extra_product_locations(text, uuid, boolean, uuid[])
  from public, anon;
grant execute on function public.set_calculator_extra_product_locations(text, uuid, boolean, uuid[])
  to authenticated;

comment on table public.calculator_extra_product_locations is
  'Locais em que cada matéria-prima pode aparecer como produto extra na calculadora.';
