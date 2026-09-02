alter table public.historico_precos_formulados
  add column if not exists saved_formula_id uuid references public.saved_formulas(id) on delete set null,
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists local_carregamento_id uuid references public.locais_carregamento(id) on delete set null,
  add column if not exists local_carregamento_nome text,
  add column if not exists price_list_id uuid references public.price_lists(id) on delete set null,
  add column if not exists price_list_name text,
  add column if not exists formula_nome text,
  add column if not exists preco_base numeric(14, 4),
  add column if not exists quantidade_tons numeric(14, 4),
  add column if not exists valor_total numeric(16, 2),
  add column if not exists fatores_comerciais jsonb not null default '{}'::jsonb,
  add column if not exists origem text not null default 'precificacao';

create index if not exists historico_precos_produto_data_idx
  on public.historico_precos_formulados (produto_formulado_id, registrado_em desc);

create index if not exists historico_precos_local_lista_idx
  on public.historico_precos_formulados (local_carregamento_id, price_list_id, registrado_em desc);
