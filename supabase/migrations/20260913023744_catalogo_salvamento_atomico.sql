-- Corrige ambientes em que a migration de escopo por local não foi aplicada e
-- centraliza o salvamento de matérias-primas em uma única transação.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'macro_materials_id_organization_key'
      and conrelid = 'public.macro_materials'::regclass
  ) then
    alter table public.macro_materials
      add constraint macro_materials_id_organization_key unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'micro_materials_id_organization_key'
      and conrelid = 'public.micro_materials'::regclass
  ) then
    alter table public.micro_materials
      add constraint micro_materials_id_organization_key unique (id, organization_id);
  end if;
end
$$;

create table if not exists public.calculator_extra_product_locations (
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

create unique index if not exists calculator_extra_product_locations_macro_key
  on public.calculator_extra_product_locations (macro_material_id, local_carregamento_id)
  where macro_material_id is not null;

create unique index if not exists calculator_extra_product_locations_micro_key
  on public.calculator_extra_product_locations (micro_material_id, local_carregamento_id)
  where micro_material_id is not null;

create index if not exists calculator_extra_product_locations_organization_idx
  on public.calculator_extra_product_locations (organization_id, local_carregamento_id);

alter table public.calculator_extra_product_locations enable row level security;

revoke all on table public.calculator_extra_product_locations from anon, authenticated;
grant select, insert, update, delete on table public.calculator_extra_product_locations
  to authenticated;

drop policy if exists calculator_extra_product_locations_select_organization
  on public.calculator_extra_product_locations;
create policy calculator_extra_product_locations_select_organization
on public.calculator_extra_product_locations for select to authenticated
using (organization_id = (select public.get_current_organization_id()));

drop policy if exists calculator_extra_product_locations_insert_organization
  on public.calculator_extra_product_locations;
create policy calculator_extra_product_locations_insert_organization
on public.calculator_extra_product_locations for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

drop policy if exists calculator_extra_product_locations_update_organization
  on public.calculator_extra_product_locations;
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

drop policy if exists calculator_extra_product_locations_delete_organization
  on public.calculator_extra_product_locations;
create policy calculator_extra_product_locations_delete_organization
on public.calculator_extra_product_locations for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

drop trigger if exists enforce_calculator_extra_product_locations_organization
  on public.calculator_extra_product_locations;
create trigger enforce_calculator_extra_product_locations_organization
before insert or update on public.calculator_extra_product_locations
for each row execute function private.enforce_row_organization();

-- Preserva os produtos que já estavam marcados como extras antes da criação
-- do vínculo por local, disponibilizando-os inicialmente em todos os locais ativos.
insert into public.calculator_extra_product_locations (
  organization_id, macro_material_id, local_carregamento_id
)
select material.organization_id, material.id, location.id
from public.macro_materials material
join public.locais_carregamento location
  on location.organization_id = material.organization_id and location.ativo = true
where material.available_in_calculator_without_price_list = true
on conflict do nothing;

insert into public.calculator_extra_product_locations (
  organization_id, micro_material_id, local_carregamento_id
)
select material.organization_id, material.id, location.id
from public.micro_materials material
join public.locais_carregamento location
  on location.organization_id = material.organization_id and location.ativo = true
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
    raise exception 'Sem permissão para configurar produtos.' using errcode = '42501';
  end if;

  if p_product_type not in ('macro', 'micro') then
    raise exception 'Tipo de produto inválido.' using errcode = '22023';
  end if;

  select count(distinct location_id) into requested_location_count
  from unnest(coalesce(p_location_ids, '{}'::uuid[])) as location_id;

  if p_enabled and requested_location_count = 0 then
    raise exception 'Selecione ao menos um local de carregamento.' using errcode = '22023';
  end if;

  select count(*) into valid_location_count
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

create or replace function public.save_catalog_material(
  p_product_type text,
  p_product_id uuid,
  p_payload jsonb,
  p_enabled boolean default false,
  p_location_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_organization_id uuid := public.get_current_organization_id();
  saved_product_id uuid := p_product_id;
  product_name text := trim(coalesce(p_payload->>'name', ''));
  category_ids uuid[] := array(
    select value::uuid
    from jsonb_array_elements_text(coalesce(p_payload->'categories', '[]'::jsonb)) as value
  );
begin
  if private.app_user_hierarchy((select auth.uid())) < 80 then
    raise exception 'Sem permissão para salvar produtos.' using errcode = '42501';
  end if;

  if p_product_type not in ('macro', 'micro') then
    raise exception 'Tipo de produto inválido.' using errcode = '22023';
  end if;

  if product_name = '' then
    raise exception 'Nome do produto é obrigatório.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload->'micro_guarantees', '[]'::jsonb)) <> 'array' then
    raise exception 'As garantias informadas são inválidas.' using errcode = '22023';
  end if;

  if p_product_type = 'macro' then
    if saved_product_id is null then
      insert into public.macro_materials (
        organization_id, code, name, min_quantity, categories,
        n, p, k, s, ca, micro_guarantees, brand_id, formula_suffix, is_premium_line,
        available_in_calculator_without_price_list
      ) values (
        current_organization_id, nullif(p_payload->>'code', ''), product_name,
        coalesce((p_payload->>'min_quantity')::numeric, 0), category_ids,
        coalesce((p_payload->>'n')::numeric, 0), coalesce((p_payload->>'p')::numeric, 0),
        coalesce((p_payload->>'k')::numeric, 0), coalesce((p_payload->>'s')::numeric, 0),
        coalesce((p_payload->>'ca')::numeric, 0),
        coalesce(p_payload->'micro_guarantees', '[]'::jsonb),
        nullif(p_payload->>'brand_id', '')::uuid, nullif(p_payload->>'formula_suffix', ''),
        coalesce((p_payload->>'is_premium_line')::boolean, false), p_enabled
      ) returning id into saved_product_id;
    else
      update public.macro_materials set
        code = nullif(p_payload->>'code', ''), name = product_name,
        min_quantity = coalesce((p_payload->>'min_quantity')::numeric, 0),
        categories = category_ids,
        n = coalesce((p_payload->>'n')::numeric, 0),
        p = coalesce((p_payload->>'p')::numeric, 0),
        k = coalesce((p_payload->>'k')::numeric, 0),
        s = coalesce((p_payload->>'s')::numeric, 0),
        ca = coalesce((p_payload->>'ca')::numeric, 0),
        micro_guarantees = coalesce(p_payload->'micro_guarantees', '[]'::jsonb),
        brand_id = nullif(p_payload->>'brand_id', '')::uuid,
        formula_suffix = nullif(p_payload->>'formula_suffix', ''),
        is_premium_line = coalesce((p_payload->>'is_premium_line')::boolean, false),
        updated_at = now()
      where id = saved_product_id and organization_id = current_organization_id;

      if not found then
        raise exception 'Produto macro não encontrado.' using errcode = 'P0002';
      end if;
    end if;
  else
    if saved_product_id is null then
      insert into public.micro_materials (
        organization_id, code, name, min_quantity, categories, micro_guarantees,
        formula_suffix, is_premium_line, available_in_calculator_without_price_list
      ) values (
        current_organization_id, nullif(p_payload->>'code', ''), product_name,
        coalesce((p_payload->>'min_quantity')::numeric, 0), category_ids,
        coalesce(p_payload->'micro_guarantees', '[]'::jsonb),
        nullif(p_payload->>'formula_suffix', ''),
        coalesce((p_payload->>'is_premium_line')::boolean, false), p_enabled
      ) returning id into saved_product_id;
    else
      update public.micro_materials set
        code = nullif(p_payload->>'code', ''), name = product_name,
        min_quantity = coalesce((p_payload->>'min_quantity')::numeric, 0),
        categories = category_ids,
        micro_guarantees = coalesce(p_payload->'micro_guarantees', '[]'::jsonb),
        formula_suffix = nullif(p_payload->>'formula_suffix', ''),
        is_premium_line = coalesce((p_payload->>'is_premium_line')::boolean, false),
        updated_at = now()
      where id = saved_product_id and organization_id = current_organization_id;

      if not found then
        raise exception 'Produto micro não encontrado.' using errcode = 'P0002';
      end if;
    end if;
  end if;

  perform public.set_calculator_extra_product_locations(
    p_product_type, saved_product_id, p_enabled, p_location_ids
  );

  return saved_product_id;
end;
$$;

revoke all on function public.save_catalog_material(text, uuid, jsonb, boolean, uuid[])
  from public, anon;
grant execute on function public.save_catalog_material(text, uuid, jsonb, boolean, uuid[])
  to authenticated;

comment on function public.save_catalog_material(text, uuid, jsonb, boolean, uuid[]) is
  'Salva uma matéria-prima e seus locais extras atomicamente, respeitando empresa e hierarquia.';
