-- Propostas de preços (Batidas Salvas → aba Propostas).
-- Cada geração de preços para o cliente vira uma proposta numerada, com a
-- "fotografia" dos preços daquele momento, validade e histórico de eventos.
-- Gravação só pelas funções abaixo (sem insert/update direto da tela).
-- Permissões (por usuário/perfil; admin e master sempre podem):
--   propostas          → ver a aba;
--   propostas_criar    → criar proposta e escolher a validade;
--   propostas_editar   → alterar a validade de uma proposta;
--   propostas_cancelar → cancelar.

create table if not exists public.propostas_precos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  numero bigint generated always as identity,
  criado_por uuid not null references auth.users (id),
  criado_por_nome text not null default '',
  region_id uuid references public.regions (id),
  client_id uuid references public.clients (id) on delete set null,
  cliente_nome text not null default '',
  cliente_documento text,
  cliente_dados jsonb not null default '{}'::jsonb,
  price_list_id uuid references public.price_lists (id) on delete set null,
  price_list_nome text,
  local_carregamento_id uuid references public.locais_carregamento (id) on delete set null,
  local_nome text,
  moeda text not null default 'BRL' check (moeda in ('BRL', 'USD')),
  taxa_cambio numeric(12, 4),
  valida_ate date not null,
  incluir_composicao boolean not null default false,
  observacoes text,
  status text not null default 'vigente'
    check (status in ('vigente', 'aceita', 'recusada', 'convertida', 'cancelada')),
  pricing_id uuid references public.pricing_records (id) on delete set null,
  valor_total numeric(15, 2) not null default 0,
  toneladas_total numeric(15, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists propostas_precos_numero_idx on public.propostas_precos (numero);
create index if not exists propostas_precos_org_idx on public.propostas_precos (organization_id, created_at desc);
create index if not exists propostas_precos_criador_idx on public.propostas_precos (criado_por);
create index if not exists propostas_precos_region_idx on public.propostas_precos (region_id);
create index if not exists propostas_precos_client_idx on public.propostas_precos (client_id);

create table if not exists public.propostas_precos_itens (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas_precos (id) on delete cascade,
  ordem integer not null default 0,
  saved_formula_id uuid references public.saved_formulas (id) on delete set null,
  codigo text,
  formula_nome text not null,
  npk text,
  garantias text,
  embalagem text,
  preco_tonelada numeric(15, 2) not null check (preco_tonelada >= 0),
  quantidade_sugerida numeric(15, 3) check (quantidade_sugerida is null or quantidade_sugerida >= 0),
  composicao jsonb not null default '[]'::jsonb,
  fatores jsonb not null default '{}'::jsonb
);
create index if not exists propostas_precos_itens_proposta_idx on public.propostas_precos_itens (proposta_id, ordem);

create table if not exists public.propostas_precos_eventos (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas_precos (id) on delete cascade,
  tipo text not null,
  descricao text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid references auth.users (id),
  criado_por_nome text,
  created_at timestamptz not null default now()
);
create index if not exists propostas_precos_eventos_proposta_idx on public.propostas_precos_eventos (proposta_id, created_at);

alter table public.propostas_precos enable row level security;
alter table public.propostas_precos_itens enable row level security;
alter table public.propostas_precos_eventos enable row level security;

-- Permissão do módulo: admin/master sempre; os demais pela chave gravada.
create or replace function private.proposta_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.app_user_hierarchy((select auth.uid())) >= 80
      or private.current_user_has_permission(p_permissao);
$$;
revoke all on function private.proposta_permissao(text) from public, anon;
grant execute on function private.proposta_permissao(text) to authenticated;

-- Quem enxerga a proposta: mesma regra da precificação (dono, equipe, região, ver todas).
create or replace function private.can_access_proposta(p_criado_por uuid, p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_user_data(p_criado_por::text)
      or (p_region_id is not null
          and private.app_user_hierarchy((select auth.uid())) >= 60
          and p_region_id = any (private.current_user_region_ids()))
      or private.current_user_has_permission('pricing_viewAllRegions');
$$;
revoke all on function private.can_access_proposta(uuid, uuid) from public, anon;
grant execute on function private.can_access_proposta(uuid, uuid) to authenticated;

drop policy if exists propostas_select on public.propostas_precos;
create policy propostas_select on public.propostas_precos for select to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and private.proposta_permissao('propostas')
    and private.can_access_proposta(criado_por, region_id)
  );

drop policy if exists propostas_itens_select on public.propostas_precos_itens;
create policy propostas_itens_select on public.propostas_precos_itens for select to authenticated
  using (exists (select 1 from public.propostas_precos p where p.id = proposta_id));

drop policy if exists propostas_eventos_select on public.propostas_precos_eventos;
create policy propostas_eventos_select on public.propostas_precos_eventos for select to authenticated
  using (exists (select 1 from public.propostas_precos p where p.id = proposta_id));

grant select on public.propostas_precos, public.propostas_precos_itens, public.propostas_precos_eventos
  to authenticated;
revoke insert, update, delete on public.propostas_precos, public.propostas_precos_itens,
  public.propostas_precos_eventos from authenticated, anon;

create or replace function private.nome_usuario_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.name from public.app_users u where u.id = (select auth.uid())), '');
$$;
revoke all on function private.nome_usuario_atual() from public, anon;

-- Cria a proposta com os itens numa transação. Devolve o id.
create or replace function public.criar_proposta_precos(p_proposta jsonb, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_id uuid;
  v_validade date := nullif(p_proposta ->> 'valida_ate', '')::date;
  v_region uuid := nullif(p_proposta ->> 'region_id', '')::uuid;
  v_client uuid := nullif(p_proposta ->> 'client_id', '')::uuid;
  v_nome text := private.nome_usuario_atual();
  v_item jsonb;
  v_ordem integer := 0;
  v_total numeric := 0;
  v_tons numeric := 0;
begin
  if v_user is null or v_org is null then
    raise exception 'Entre no sistema para gerar a proposta.' using errcode = '42501';
  end if;
  if not private.proposta_permissao('propostas_criar') then
    raise exception 'Seu usuário não tem permissão para criar propostas.' using errcode = '42501';
  end if;
  if v_validade is null then
    raise exception 'Informe a validade da proposta.' using errcode = '22023';
  end if;
  if v_validade < current_date then
    raise exception 'A validade não pode ser anterior a hoje.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A proposta precisa de ao menos um produto.' using errcode = '22023';
  end if;
  if v_client is not null and not exists (
    select 1 from public.clients c where c.id = v_client and c.organization_id = v_org
  ) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  if v_region is null then
    v_region := private.regiao_principal_do_usuario(v_user);
  elsif not exists (select 1 from public.regions r where r.id = v_region and r.organization_id = v_org) then
    raise exception 'Região inválida.' using errcode = '42501';
  end if;

  insert into public.propostas_precos (
    organization_id, criado_por, criado_por_nome, region_id, client_id, cliente_nome,
    cliente_documento, cliente_dados, price_list_id, price_list_nome, local_carregamento_id,
    local_nome, moeda, taxa_cambio, valida_ate, incluir_composicao, observacoes)
  values (
    v_org, v_user, v_nome, v_region, v_client,
    coalesce(nullif(btrim(p_proposta ->> 'cliente_nome'), ''), 'Cliente não informado'),
    nullif(btrim(p_proposta ->> 'cliente_documento'), ''),
    coalesce(p_proposta -> 'cliente_dados', '{}'::jsonb),
    nullif(p_proposta ->> 'price_list_id', '')::uuid,
    nullif(p_proposta ->> 'price_list_nome', ''),
    nullif(p_proposta ->> 'local_carregamento_id', '')::uuid,
    nullif(p_proposta ->> 'local_nome', ''),
    case when p_proposta ->> 'moeda' = 'USD' then 'USD' else 'BRL' end,
    nullif(p_proposta ->> 'taxa_cambio', '')::numeric,
    v_validade,
    coalesce((p_proposta ->> 'incluir_composicao')::boolean, false),
    nullif(btrim(p_proposta ->> 'observacoes'), ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_ordem := v_ordem + 1;
    insert into public.propostas_precos_itens (
      proposta_id, ordem, saved_formula_id, codigo, formula_nome, npk, garantias, embalagem,
      preco_tonelada, quantidade_sugerida, composicao, fatores)
    values (
      v_id, v_ordem,
      (select sf.id from public.saved_formulas sf
        where sf.id = nullif(v_item ->> 'saved_formula_id', '')::uuid and sf.organization_id = v_org),
      nullif(v_item ->> 'codigo', ''),
      coalesce(nullif(btrim(v_item ->> 'formula_nome'), ''), 'Produto'),
      nullif(v_item ->> 'npk', ''),
      nullif(v_item ->> 'garantias', ''),
      nullif(v_item ->> 'embalagem', ''),
      greatest(coalesce((v_item ->> 'preco_tonelada')::numeric, 0), 0),
      nullif(v_item ->> 'quantidade_sugerida', '')::numeric,
      coalesce(v_item -> 'composicao', '[]'::jsonb),
      coalesce(v_item -> 'fatores', '{}'::jsonb));
    v_total := v_total + greatest(coalesce((v_item ->> 'preco_tonelada')::numeric, 0), 0)
                         * coalesce(nullif(v_item ->> 'quantidade_sugerida', '')::numeric, 0);
    v_tons := v_tons + coalesce(nullif(v_item ->> 'quantidade_sugerida', '')::numeric, 0);
  end loop;

  update public.propostas_precos set valor_total = v_total, toneladas_total = v_tons where id = v_id;

  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (v_id, 'criada',
          format('Proposta criada com %s produto(s), válida até %s.', v_ordem, to_char(v_validade, 'DD/MM/YYYY')),
          jsonb_build_object('valida_ate', v_validade), v_user, v_nome);
  return v_id;
end;
$$;
revoke all on function public.criar_proposta_precos(jsonb, jsonb) from public, anon;
grant execute on function public.criar_proposta_precos(jsonb, jsonb) to authenticated;

-- Carrega a proposta respeitando o acesso (para as funções de alteração).
create or replace function private.proposta_para_alterar(p_id uuid)
returns public.propostas_precos
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
begin
  select * into rec from public.propostas_precos p
   where p.id = p_id and p.organization_id = (select public.get_current_organization_id())
   for update;
  if not found or not private.can_access_proposta(rec.criado_por, rec.region_id) then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  return rec;
end;
$$;
revoke all on function private.proposta_para_alterar(uuid) from public, anon;

create or replace function public.alterar_validade_proposta(p_id uuid, p_valida_ate date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
begin
  if not private.proposta_permissao('propostas_editar') then
    raise exception 'Seu usuário não tem permissão para alterar a validade.' using errcode = '42501';
  end if;
  rec := private.proposta_para_alterar(p_id);
  if rec.status <> 'vigente' then
    raise exception 'Só é possível alterar a validade de proposta em aberto.' using errcode = '22023';
  end if;
  if p_valida_ate is null or p_valida_ate < current_date then
    raise exception 'A nova validade não pode ser anterior a hoje.' using errcode = '22023';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da alteração.' using errcode = '22023';
  end if;
  update public.propostas_precos set valida_ate = p_valida_ate, updated_at = now() where id = rec.id;
  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (rec.id, 'validade_alterada',
          format('Validade alterada de %s para %s. Motivo: %s',
                 to_char(rec.valida_ate, 'DD/MM/YYYY'), to_char(p_valida_ate, 'DD/MM/YYYY'), btrim(p_motivo)),
          jsonb_build_object('de', rec.valida_ate, 'para', p_valida_ate, 'motivo', btrim(p_motivo)),
          (select auth.uid()), private.nome_usuario_atual());
end;
$$;
revoke all on function public.alterar_validade_proposta(uuid, date, text) from public, anon;
grant execute on function public.alterar_validade_proposta(uuid, date, text) to authenticated;

create or replace function public.cancelar_proposta(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
begin
  if not private.proposta_permissao('propostas_cancelar') then
    raise exception 'Seu usuário não tem permissão para cancelar propostas.' using errcode = '42501';
  end if;
  rec := private.proposta_para_alterar(p_id);
  if rec.status in ('cancelada', 'convertida') then
    raise exception 'Esta proposta não pode mais ser cancelada.' using errcode = '22023';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '22023';
  end if;
  update public.propostas_precos set status = 'cancelada', updated_at = now() where id = rec.id;
  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (rec.id, 'cancelada', format('Proposta cancelada. Motivo: %s', btrim(p_motivo)),
          jsonb_build_object('motivo', btrim(p_motivo)), (select auth.uid()), private.nome_usuario_atual());
end;
$$;
revoke all on function public.cancelar_proposta(uuid, text) from public, anon;
grant execute on function public.cancelar_proposta(uuid, text) to authenticated;

-- Registra que o PDF ou o Excel foi gerado (vigente ou vencida).
create or replace function public.registrar_documento_proposta(p_id uuid, p_formato text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
  v_formato text := case when p_formato = 'excel' then 'Excel' else 'PDF' end;
begin
  rec := private.proposta_para_alterar(p_id);
  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (rec.id, 'documento_gerado',
          case when rec.valida_ate < current_date
               then format('%s gerado com a marca de preços fora da validade.', v_formato)
               else format('%s gerado.', v_formato) end,
          jsonb_build_object('formato', lower(v_formato), 'vencida', rec.valida_ate < current_date),
          (select auth.uid()), private.nome_usuario_atual());
end;
$$;
revoke all on function public.registrar_documento_proposta(uuid, text) from public, anon;
grant execute on function public.registrar_documento_proposta(uuid, text) to authenticated;

-- Quem já gera relatório de preços em Batidas Salvas passa a ver e criar propostas.
update public.app_users
   set permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object(
         'propostas', true, 'propostas_criar', true, 'propostas_editar', true)
 where coalesce(permissions ->> 'savedFormulas', 'true') <> 'false'
   and role not in ('transportadora')
   and not (coalesce(permissions, '{}'::jsonb) ? 'propostas');

update public.access_profiles
   set permissions = permissions || jsonb_build_object(
         'propostas', true, 'propostas_criar', true, 'propostas_editar', true)
 where coalesce(permissions ->> 'savedFormulas', 'false') = 'true'
   and not (permissions ? 'propostas');
