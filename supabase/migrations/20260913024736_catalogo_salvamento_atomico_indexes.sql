create index if not exists calculator_extra_product_locations_location_org_idx
  on public.calculator_extra_product_locations (local_carregamento_id, organization_id);

create index if not exists calculator_extra_product_locations_macro_org_idx
  on public.calculator_extra_product_locations (macro_material_id, organization_id);

create index if not exists calculator_extra_product_locations_micro_org_idx
  on public.calculator_extra_product_locations (micro_material_id, organization_id);
