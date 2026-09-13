begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b1000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'catalogo-fase1@example.test', 'Catálogo Fase 1', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.locais_carregamento (id, organization_id, nome, ativo)
values (
  'c1000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'Catálogo Fase 1 - Local', true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  saved_id uuid;
  assignment_count integer;
  failed_product_count integer;
begin
  saved_id := public.save_catalog_material(
    'macro',
    null,
    jsonb_build_object(
      'code', 'CAT-F1',
      'name', 'Produto Atômico Fase 1',
      'min_quantity', 10,
      'categories', '[]'::jsonb,
      'n', 10,
      'p', 20,
      'k', 30,
      's', 0,
      'ca', 0,
      'micro_guarantees', '[]'::jsonb,
      'is_premium_line', false
    ),
    true,
    array['c1000000-0000-4000-8000-000000000001'::uuid]
  );

  select count(*) into assignment_count
  from public.calculator_extra_product_locations
  where macro_material_id = saved_id
    and local_carregamento_id = 'c1000000-0000-4000-8000-000000000001';

  if assignment_count <> 1 then
    raise exception 'O produto e o local não foram salvos na mesma operação.';
  end if;

  begin
    perform public.save_catalog_material(
      'macro',
      null,
      jsonb_build_object(
        'code', 'CAT-F1-FAIL',
        'name', 'Produto que deve sofrer rollback',
        'categories', '[]'::jsonb,
        'micro_guarantees', '[]'::jsonb
      ),
      true,
      array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid]
    );
    raise exception 'A operação aceitou um local inválido.';
  exception when invalid_parameter_value then
    null;
  end;

  select count(*) into failed_product_count
  from public.macro_materials
  where name = 'Produto que deve sofrer rollback';

  if failed_product_count <> 0 then
    raise exception 'O produto permaneceu gravado após falha na configuração do local.';
  end if;
end
$$;

rollback;
