-- Fatores comerciais por moeda, status do catálogo, perfil persistido e histórico monetário.

alter table public.app_settings
  add column if not exists default_factor_brl numeric(12,6) not null default 0.8,
  add column if not exists default_factor_usd numeric(12,6) not null default 0;

alter table public.app_settings
  drop constraint if exists app_settings_default_factor_brl_nonnegative,
  add constraint app_settings_default_factor_brl_nonnegative check (default_factor_brl >= 0),
  drop constraint if exists app_settings_default_factor_usd_nonnegative,
  add constraint app_settings_default_factor_usd_nonnegative check (default_factor_usd >= 0);

alter table public.macro_materials
  add column if not exists ativo boolean not null default true;

alter table public.micro_materials
  add column if not exists ativo boolean not null default true;

alter table public.app_users
  add column if not exists access_profile_id uuid;

alter table public.app_users
  drop constraint if exists app_users_access_profile_id_fkey,
  add constraint app_users_access_profile_id_fkey
    foreign key (access_profile_id)
    references public.access_profiles(id)
    on delete set null;

create index if not exists idx_app_users_access_profile_id
  on public.app_users(access_profile_id);

alter table public.historico_precos_formulados
  add column if not exists moeda text not null default 'BRL',
  add column if not exists taxa_cambio numeric(14,6),
  add column if not exists preco_final_brl numeric(14,2);

update public.historico_precos_formulados
set moeda = 'BRL',
    preco_final_brl = coalesce(preco_final_brl, preco_final)
where moeda is null
   or preco_final_brl is null;

alter table public.historico_precos_formulados
  drop constraint if exists historico_precos_formulados_moeda_check,
  add constraint historico_precos_formulados_moeda_check check (moeda in ('BRL', 'USD')),
  drop constraint if exists historico_precos_formulados_taxa_cambio_check,
  add constraint historico_precos_formulados_taxa_cambio_check
    check (taxa_cambio is null or taxa_cambio > 0);

comment on column public.app_users.access_profile_id is
  'Perfil de acesso aplicado ao usuário; permissões continuam persistidas como fotografia editável.';
comment on column public.historico_precos_formulados.preco_final is
  'Preço final na moeda original da lista de preços.';
comment on column public.historico_precos_formulados.preco_final_brl is
  'Preço final equivalente em BRL no momento do registro.';

notify pgrst, 'reload schema';
