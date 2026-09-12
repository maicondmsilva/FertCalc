begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
)
values (
  'b0000000-0000-4000-8000-000000000121',
  (select id from public.organizations where slug = 'fertcalc'),
  'p121-master@example.test', 'P121 Master', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.locais_carregamento (id, organization_id, nome, ativo)
values (
  'c0000000-0000-4000-8000-000000000121',
  (select id from public.organizations where slug = 'fertcalc'),
  'P121 Local', true
);

insert into public.macro_materials (id, organization_id, name)
values (
  'd0000000-0000-4000-8000-000000000121',
  (select id from public.organizations where slug = 'fertcalc'),
  'P121 Macro'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000121","role":"authenticated"}',
  true
);

select public.set_calculator_extra_product_locations(
  'macro',
  'd0000000-0000-4000-8000-000000000121',
  true,
  array['c0000000-0000-4000-8000-000000000121'::uuid]
);

do $$
declare
  assignment_count integer;
  product_enabled boolean;
begin
  select count(*) into assignment_count
  from public.calculator_extra_product_locations
  where macro_material_id = 'd0000000-0000-4000-8000-000000000121';

  select available_in_calculator_without_price_list into product_enabled
  from public.macro_materials
  where id = 'd0000000-0000-4000-8000-000000000121';

  if assignment_count <> 1 or not product_enabled then
    raise exception 'extra product location was not persisted';
  end if;

  begin
    perform public.set_calculator_extra_product_locations(
      'macro',
      'd0000000-0000-4000-8000-000000000121',
      true,
      '{}'::uuid[]
    );
    raise exception 'enabled extra product accepted an empty location list';
  exception when invalid_parameter_value then null;
  end;
end
$$;

rollback;
