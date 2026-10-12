alter table public.macro_materials
  add column if not exists max_quantity numeric not null default 0;

alter table public.micro_materials
  add column if not exists max_quantity numeric not null default 0;

alter table public.macro_materials
  drop constraint if exists macro_materials_max_quantity_valid,
  add constraint macro_materials_max_quantity_valid
    check (max_quantity >= 0 and (max_quantity = 0 or max_quantity >= min_quantity));

alter table public.micro_materials
  drop constraint if exists micro_materials_max_quantity_valid,
  add constraint micro_materials_max_quantity_valid
    check (max_quantity >= 0 and (max_quantity = 0 or max_quantity >= min_quantity));

comment on column public.macro_materials.max_quantity is
  'Quantidade máxima padrão em kg na calculadora; zero significa sem limite específico.';

comment on column public.micro_materials.max_quantity is
  'Quantidade máxima padrão em kg na calculadora; zero significa sem limite específico.';

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
  minimum_quantity numeric := coalesce((p_payload->>'min_quantity')::numeric, 0);
  maximum_quantity numeric := coalesce((p_payload->>'max_quantity')::numeric, 0);
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

  if minimum_quantity < 0 or maximum_quantity < 0 then
    raise exception 'As quantidades mínima e máxima não podem ser negativas.' using errcode = '22023';
  end if;

  if maximum_quantity > 0 and minimum_quantity > maximum_quantity then
    raise exception 'A quantidade mínima não pode ser maior que a quantidade máxima.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload->'micro_guarantees', '[]'::jsonb)) <> 'array' then
    raise exception 'As garantias informadas são inválidas.' using errcode = '22023';
  end if;

  if p_product_type = 'macro' then
    if saved_product_id is null then
      insert into public.macro_materials (
        organization_id, code, name, min_quantity, max_quantity, categories,
        n, p, k, s, ca, micro_guarantees, brand_id, formula_suffix, is_premium_line,
        available_in_calculator_without_price_list
      ) values (
        current_organization_id, nullif(p_payload->>'code', ''), product_name,
        minimum_quantity, maximum_quantity, category_ids,
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
        min_quantity = minimum_quantity,
        max_quantity = maximum_quantity,
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
        organization_id, code, name, min_quantity, max_quantity, categories, micro_guarantees,
        formula_suffix, is_premium_line, available_in_calculator_without_price_list
      ) values (
        current_organization_id, nullif(p_payload->>'code', ''), product_name,
        minimum_quantity, maximum_quantity, category_ids,
        coalesce(p_payload->'micro_guarantees', '[]'::jsonb),
        nullif(p_payload->>'formula_suffix', ''),
        coalesce((p_payload->>'is_premium_line')::boolean, false), p_enabled
      ) returning id into saved_product_id;
    else
      update public.micro_materials set
        code = nullif(p_payload->>'code', ''), name = product_name,
        min_quantity = minimum_quantity,
        max_quantity = maximum_quantity,
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

