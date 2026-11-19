-- Personalização: o nome da empresa passa a ser opcional e a exibição do nome ao
-- lado da logo vira uma escolha (padrão: mostrar, como hoje).
alter table public.app_settings
  alter column company_name drop not null;

alter table public.app_settings
  add column if not exists show_company_name boolean not null default true;

comment on column public.app_settings.show_company_name is
  'Quando falso, o topo das páginas e os relatórios mostram somente a logo.';
