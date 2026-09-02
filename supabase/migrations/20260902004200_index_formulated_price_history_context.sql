create index if not exists historico_precos_saved_formula_idx
  on public.historico_precos_formulados (saved_formula_id);

create index if not exists historico_precos_organization_idx
  on public.historico_precos_formulados (organization_id);

create index if not exists historico_precos_price_list_idx
  on public.historico_precos_formulados (price_list_id);
