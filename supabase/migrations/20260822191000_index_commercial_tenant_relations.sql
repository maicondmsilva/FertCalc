-- Cover same-organization foreign keys and their legacy single-column counterparts.

create index idx_locations_branch_organization
  on public.locais_carregamento (filial_id, organization_id);

create index idx_price_lists_branch_organization
  on public.price_lists (branch_id, organization_id);

create index idx_price_lists_location_organization
  on public.price_lists (local_carregamento_id, organization_id);
