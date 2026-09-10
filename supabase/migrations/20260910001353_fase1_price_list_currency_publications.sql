-- Fase 1 - base de moeda, cambio e publicacoes de listas de preco.
-- Mantem price_lists como a lista por local e adiciona uma publicacao opcional
-- para agrupar listas equivalentes de varios locais.

create sequence if not exists public.price_list_publications_id_numeric_seq start 1;

create table if not exists public.price_list_publications (
  id uuid primary key default gen_random_uuid(),
  id_numeric integer not null default nextval('public.price_list_publications_id_numeric_seq'),
  organization_id uuid not null default public.get_current_organization_id()
    references public.organizations(id),
  name text not null,
  competence date not null,
  revision integer not null default 1,
  currency text not null default 'BRL',
  exchange_rate numeric(14, 6),
  valid_from date,
  valid_until date,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_publications_id_numeric_key unique (id_numeric),
  constraint price_list_publications_id_organization_key unique (id, organization_id),
  constraint price_list_publications_identity_key
    unique (organization_id, name, competence, revision),
  constraint price_list_publications_revision_check check (revision > 0),
  constraint price_list_publications_currency_check check (currency in ('BRL', 'USD')),
  constraint price_list_publications_exchange_rate_check check (
    exchange_rate is null or exchange_rate > 0
  ),
  constraint price_list_publications_usd_rate_check check (
    currency <> 'USD' or exchange_rate > 0
  ),
  constraint price_list_publications_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint price_list_publications_validity_check check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

alter sequence public.price_list_publications_id_numeric_seq
  owned by public.price_list_publications.id_numeric;

alter table public.price_list_publications enable row level security;

revoke all on table public.price_list_publications from anon, authenticated;
grant select, insert, update, delete on table public.price_list_publications to authenticated;
grant usage, select on sequence public.price_list_publications_id_numeric_seq to authenticated;

create policy price_list_publications_select_organization
on public.price_list_publications for select to authenticated
using (organization_id = (select public.get_current_organization_id()));

create policy price_list_publications_insert_organization
on public.price_list_publications for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 60
);

create policy price_list_publications_update_organization
on public.price_list_publications for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 60
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 60
);

create policy price_list_publications_delete_organization
on public.price_list_publications for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

create trigger enforce_price_list_publications_organization
before insert or update on public.price_list_publications
for each row execute function private.enforce_row_organization();

alter table public.price_lists
  add column if not exists publication_id uuid;

update public.price_lists
set currency = 'BRL'
where currency is null;

alter table public.price_lists
  alter column currency set default 'BRL',
  alter column currency set not null,
  alter column id_numeric set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'price_lists_currency_check'
  ) then
    alter table public.price_lists
      add constraint price_lists_currency_check
      check (currency in ('BRL', 'USD'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'price_lists_exchange_rate_check'
  ) then
    alter table public.price_lists
      add constraint price_lists_exchange_rate_check
      check (exchange_rate is null or exchange_rate > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'price_lists_usd_rate_check'
  ) then
    -- NOT VALID preserva a lista USD legada sem cambio. Novas gravacoes ja
    -- precisam cumprir a regra e a constraint podera ser validada apos saneamento.
    alter table public.price_lists
      add constraint price_lists_usd_rate_check
      check (currency <> 'USD' or exchange_rate > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'price_lists_publication_same_organization_fk'
  ) then
    alter table public.price_lists
      add constraint price_lists_publication_same_organization_fk
      foreign key (publication_id, organization_id)
      references public.price_list_publications (id, organization_id)
      on delete set null (publication_id);
  end if;
end
$$;

create index if not exists idx_price_lists_publication
  on public.price_lists (publication_id, organization_id);

create index if not exists idx_price_lists_organization_numeric
  on public.price_lists (organization_id, id_numeric desc);

create index if not exists idx_price_list_publications_organization_competence
  on public.price_list_publications (organization_id, competence desc, revision desc);

comment on table public.price_list_publications is
  'Agrupa listas por local em uma publicacao comercial, com competencia, revisao, moeda e cambio.';

comment on column public.price_lists.id_numeric is
  'Identificador publico sequencial da lista. O UUID permanece como chave interna.';

comment on column public.price_lists.exchange_rate is
  'Cambio padrao da lista quando currency=USD; em BRL pode ser mantido apenas como referencia.';
