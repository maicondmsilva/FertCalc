-- Cadastro de nutrientes (micros e secundários): sigla, nome e nomes alternativos.
-- As garantias dos produtos passam a usar a sigla do cadastro, em vez de texto
-- digitado ("ZN", "Zn", "Zinco" viravam nutrientes diferentes quando fora da lista
-- fixa do código). As garantias já gravadas são padronizadas para a sigla.

create table if not exists public.nutrientes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sigla text not null check (char_length(btrim(sigla)) between 1 and 4),
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  tipo text not null default 'micro' check (tipo in ('micro', 'secundario')),
  aliases text[] not null default '{}',
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists nutrientes_organization_sigla_key
  on public.nutrientes (organization_id, upper(btrim(sigla)));

drop trigger if exists enforce_nutrientes_organization on public.nutrientes;
create trigger enforce_nutrientes_organization
  before insert or update on public.nutrientes
  for each row execute function private.enforce_row_organization();

alter table public.nutrientes enable row level security;
revoke all on public.nutrientes from anon;
grant select, insert, update, delete on public.nutrientes to authenticated;

drop policy if exists nutrientes_select_organization on public.nutrientes;
create policy nutrientes_select_organization on public.nutrientes
  for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));

drop policy if exists nutrientes_write_admin on public.nutrientes;
create policy nutrientes_write_admin on public.nutrientes
  for all to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and private.app_user_hierarchy((select auth.uid())) >= 80
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and private.app_user_hierarchy((select auth.uid())) >= 80
  );

-- Nutrientes que o código já reconhecia, para todas as organizações.
insert into public.nutrientes (organization_id, sigla, nome, tipo, aliases, ordem)
select o.id, n.sigla, n.nome, n.tipo, n.aliases, n.ordem
from public.organizations o
cross join (values
  ('B',  'Boro',       'micro',      array['BORO'], 10),
  ('Zn', 'Zinco',      'micro',      array['ZINCO'], 20),
  ('Mn', 'Manganês',   'micro',      array['MANGANES', 'MANGANÊS'], 30),
  ('Cu', 'Cobre',      'micro',      array['COBRE'], 40),
  ('Fe', 'Ferro',      'micro',      array['FERRO'], 50),
  ('Mo', 'Molibdênio', 'micro',      array['MOLIBDENIO', 'MOLIBDÊNIO'], 60),
  ('Co', 'Cobalto',    'micro',      array['COBALTO'], 70),
  ('Ni', 'Níquel',     'micro',      array['NIQUEL', 'NÍQUEL'], 80),
  ('Cl', 'Cloro',      'micro',      array['CLORO'], 90),
  ('Se', 'Selênio',    'micro',      array['SELENIO', 'SELÊNIO'], 100),
  ('Si', 'Silício',    'micro',      array['SILICIO', 'SILÍCIO'], 110),
  ('Mg', 'Magnésio',   'secundario', array['MAGNESIO', 'MAGNÉSIO'], 200),
  ('S',  'Enxofre',    'secundario', array['ENXOFRE'], 210),
  ('Ca', 'Cálcio',     'secundario', array['CALCIO', 'CÁLCIO'], 220)
) as n(sigla, nome, tipo, aliases, ordem)
on conflict do nothing;

-- Sigla do cadastro para um nome de garantia (sigla, nome ou nome alternativo).
create or replace function private.nutrient_sigla(p_organization_id uuid, p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select n.sigla
  from public.nutrientes n
  where n.organization_id = p_organization_id
    and (
      upper(btrim(n.sigla)) = upper(btrim(p_name))
      or upper(btrim(n.nome)) = upper(btrim(p_name))
      or upper(btrim(p_name)) = any (n.aliases)
    )
  order by n.ordem
  limit 1;
$$;

revoke all on function private.nutrient_sigla(uuid, text) from public, anon, authenticated;

-- Padroniza as garantias já gravadas nos produtos (só troca o nome; valor igual).
update public.macro_materials m
set micro_guarantees = (
  select jsonb_agg(
    case
      when private.nutrient_sigla(m.organization_id, g ->> 'name') is not null
        then jsonb_set(g, '{name}', to_jsonb(private.nutrient_sigla(m.organization_id, g ->> 'name')))
      else g
    end
  )
  from jsonb_array_elements(m.micro_guarantees) g
)
where jsonb_typeof(m.micro_guarantees) = 'array'
  and jsonb_array_length(m.micro_guarantees) > 0;

update public.micro_materials m
set micro_guarantees = (
  select jsonb_agg(
    case
      when private.nutrient_sigla(m.organization_id, g ->> 'name') is not null
        then jsonb_set(g, '{name}', to_jsonb(private.nutrient_sigla(m.organization_id, g ->> 'name')))
      else g
    end
  )
  from jsonb_array_elements(m.micro_guarantees) g
)
where jsonb_typeof(m.micro_guarantees) = 'array'
  and jsonb_array_length(m.micro_guarantees) > 0;
