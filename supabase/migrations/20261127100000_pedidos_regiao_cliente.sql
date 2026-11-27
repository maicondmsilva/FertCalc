-- Pedidos de venda: região como dona do registro + cliente/filial vindos da precificação.
--
-- 1) Bug: o pedido criado a partir da precificação mostrava o nome do cliente na
--    tela, mas gravava sem cliente (e sem filial). Agora o banco herda cliente,
--    filial e região da precificação quando a tela não mandar.
-- 2) Região: todo pedido é registrado pela região (o usuário que registrou
--    continua gravado em importado_por). Obrigatória quando a empresa tem
--    regiões. A região de um pedido não muda: para mudar de região, cria-se um
--    novo emitente (o /1 fica na região original).
-- 3) Quem vê/edita: quem registrou, quem está na região do pedido, admin/master
--    e quem tem "Ver precificações de todas as regiões" (leitura). Pedidos antigos
--    sem região continuam como antes (gerente ou acima).

alter table public.pedidos_venda
  add column if not exists region_id uuid references public.regions (id);
create index if not exists pedidos_venda_region_idx on public.pedidos_venda (region_id);

-- Corrige os pedidos já criados sem cliente/filial/região (vindos da precificação).
update public.pedidos_venda pv
   set cliente_id = coalesce(pv.cliente_id, (
         select c.id from public.clients c
          where c.organization_id = pv.organization_id
            and c.id::text = pr.factors -> 'client' ->> 'id')),
       filial_id = coalesce(pv.filial_id, (
         select b.id from public.branches b
          where b.organization_id = pv.organization_id
            and b.id::text = pr.factors ->> 'branchId')),
       region_id = coalesce(pv.region_id, pr.region_id)
  from public.pricing_records pr
 where pr.id = pv.precificacao_id
   and (pv.cliente_id is null or pv.filial_id is null or pv.region_id is null);

-- Região não muda por edição.
create or replace function private.guard_pedido_region()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.region_id is distinct from old.region_id then
    raise exception 'Para mudar o pedido de região, crie um novo emitente.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_pedido_region on public.pedidos_venda;
create trigger guard_pedido_region before update on public.pedidos_venda
  for each row execute function private.guard_pedido_region();

-- Quem pode ver/editar um pedido.
create or replace function private.can_access_pedido(p_importado_por uuid, p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_importado_por = (select auth.uid())
    or private.app_user_hierarchy((select auth.uid())) >= 80
    or (p_region_id is not null and p_region_id = any (private.current_user_region_ids()))
    or (p_region_id is null and private.app_user_hierarchy((select auth.uid())) >= 60);
$$;
revoke all on function private.can_access_pedido(uuid, uuid) from public, anon;
grant execute on function private.can_access_pedido(uuid, uuid) to authenticated;

drop policy if exists pedidos_venda_select_organization on public.pedidos_venda;
create policy pedidos_venda_select_organization on public.pedidos_venda for select to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (private.can_access_pedido(importado_por, region_id)
         or private.current_user_has_permission('pricing_viewAllRegions'))
  );

drop policy if exists pedidos_venda_update_organization on public.pedidos_venda;
create policy pedidos_venda_update_organization on public.pedidos_venda for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and private.can_access_pedido(importado_por, region_id)
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and private.can_access_pedido(importado_por, region_id)
  );

-- Criar pedido: herda cliente, filial e região da precificação; confere a região.
create or replace function public.criar_pedido_venda(p_pedido jsonb, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_pedido_id uuid;
  v_total numeric(15,3);
  v_numero text := nullif(btrim(p_pedido ->> 'numero_pedido'), '');
  v_emitente integer;
  v_cliente uuid := nullif(p_pedido ->> 'cliente_id', '')::uuid;
  v_precificacao uuid := nullif(p_pedido ->> 'precificacao_id', '')::uuid;
  v_filial uuid := nullif(p_pedido ->> 'filial_id', '')::uuid;
  v_region uuid := nullif(p_pedido ->> 'region_id', '')::uuid;
  v_pricing public.pricing_records%rowtype;
begin
  if v_user_id is null or v_org is null or not exists (
    select 1 from public.app_users where id = v_user_id and ativo and organization_id = v_org
  ) then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if private.app_user_hierarchy(v_user_id) < 20 then
    raise exception 'Seu perfil não pode criar pedidos de venda.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pedido) is distinct from 'object'
     or jsonb_typeof(p_itens) is distinct from 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um produto no pedido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) item
    where jsonb_typeof(item) is distinct from 'object'
       or nullif(btrim(item ->> 'produto_nome'), '') is null
       or nullif(item ->> 'quantidade_ton', '') is null
       or (item ->> 'quantidade_ton')::numeric::text in ('NaN', 'Infinity', '-Infinity')
       or round((item ->> 'quantidade_ton')::numeric, 3) <= 0
  ) then
    raise exception 'Todos os produtos precisam de nome e quantidade maior que zero.'
      using errcode = '22023';
  end if;

  begin
    v_emitente := coalesce(nullif(p_pedido ->> 'emitente', '')::integer, 1);
  exception when invalid_text_representation then
    raise exception 'Informe um emitente válido.' using errcode = '22023';
  end;
  if v_emitente < 1 then
    raise exception 'Informe um emitente válido.' using errcode = '22023';
  end if;

  if v_precificacao is not null then
    select * into v_pricing from public.pricing_records
     where id = v_precificacao and organization_id = v_org;
    if not found then
      raise exception 'Precificação não encontrada.' using errcode = '42501';
    end if;
    -- Herda da precificação o que a tela não mandou.
    if v_cliente is null then
      select c.id into v_cliente from public.clients c
       where c.organization_id = v_org and c.id::text = v_pricing.factors -> 'client' ->> 'id';
    end if;
    if v_filial is null then
      select b.id into v_filial from public.branches b
       where b.organization_id = v_org and b.id::text = v_pricing.factors ->> 'branchId';
    end if;
    v_region := coalesce(v_region, v_pricing.region_id);
  end if;

  if v_cliente is not null and not exists (
    select 1 from public.clients where id = v_cliente and organization_id = v_org
  ) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  if v_filial is not null and not exists (
    select 1 from public.branches where id = v_filial and organization_id = v_org
  ) then
    raise exception 'Filial não encontrada.' using errcode = '42501';
  end if;

  -- Região: obrigatória quando a empresa tem regiões; precisa ser ativa e
  -- ser do usuário (ou a da precificação de origem; admin/master: qualquer).
  if v_region is null then
    if exists (select 1 from public.regions r where r.organization_id = v_org and r.ativo) then
      raise exception 'Informe a região do pedido.' using errcode = '23502';
    end if;
  else
    if not exists (
      select 1 from public.regions r where r.id = v_region and r.organization_id = v_org and r.ativo
    ) then
      raise exception 'Região inativa ou de outra empresa.' using errcode = '42501';
    end if;
    if private.app_user_hierarchy(v_user_id) < 80
       and not (v_region = any (private.current_user_region_ids()))
       and v_region is distinct from v_pricing.region_id then
      raise exception 'Você só pode registrar pedidos nas suas regiões.' using errcode = '42501';
    end if;
  end if;

  select sum(round((item ->> 'quantidade_ton')::numeric, 3)) into v_total
  from jsonb_array_elements(p_itens) item;

  insert into public.pedidos_venda (
    organization_id, precificacao_id, numero_pedido, barra_pedido, emitente,
    data_pedido, data_vencimento, quantidade_real, quantidade_original,
    quantidade_desmembrada, quantidade_cancelada_definitiva,
    embalagem, valor_unitario_negociado, valor_total_negociado, tipo_frete,
    valor_frete, status, status_pedido, pdf_url, dados_extraidos, importado_por,
    produto_nome, cliente_id, preco_unitario, condicao_pagamento, observacoes,
    filial_id, formulacao_alterada, safra, previsao_entrega, local_entrega, numero_contrato,
    region_id
  ) values (
    v_org,
    v_precificacao,
    v_numero,
    coalesce(
      nullif(btrim(p_pedido ->> 'barra_pedido'), ''),
      case when v_numero is null then null else v_numero || '/' || v_emitente end
    ),
    v_emitente,
    nullif(p_pedido ->> 'data_pedido', '')::date,
    nullif(p_pedido ->> 'data_vencimento', '')::date,
    v_total,
    v_total,
    0,
    0,
    nullif(btrim(p_pedido ->> 'embalagem'), ''),
    nullif(p_pedido ->> 'valor_unitario_negociado', '')::numeric,
    nullif(p_pedido ->> 'valor_total_negociado', '')::numeric,
    nullif(btrim(p_pedido ->> 'tipo_frete'), ''),
    nullif(p_pedido ->> 'valor_frete', '')::numeric,
    'pendente',
    'ativo',
    nullif(p_pedido ->> 'pdf_url', ''),
    case when jsonb_typeof(p_pedido -> 'dados_extraidos') = 'object'
      then p_pedido -> 'dados_extraidos' else null end,
    v_user_id,
    (
      select string_agg(btrim(item ->> 'produto_nome'), ', ' order by position)
      from jsonb_array_elements(p_itens) with ordinality as elements(item, position)
    ),
    v_cliente,
    nullif(p_pedido ->> 'preco_unitario', '')::numeric,
    nullif(btrim(p_pedido ->> 'condicao_pagamento'), ''),
    nullif(btrim(p_pedido ->> 'observacoes'), ''),
    v_filial,
    coalesce(nullif(p_pedido ->> 'formulacao_alterada', '')::boolean, false),
    nullif(btrim(p_pedido ->> 'safra'), ''),
    nullif(p_pedido ->> 'previsao_entrega', '')::date,
    nullif(btrim(p_pedido ->> 'local_entrega'), ''),
    nullif(btrim(p_pedido ->> 'numero_contrato'), ''),
    v_region
  ) returning id into v_pedido_id;

  insert into public.pedidos_venda_itens (
    organization_id, pedido_venda_id, produto_nome, formulacao, quantidade_ton,
    saldo_disponivel, saldo_a_carregar, preco_unitario, embalagem, precificacao_id
  )
  select
    v_org,
    v_pedido_id,
    btrim(item ->> 'produto_nome'),
    nullif(btrim(item ->> 'formulacao'), ''),
    round((item ->> 'quantidade_ton')::numeric, 3),
    round((item ->> 'quantidade_ton')::numeric, 3),
    round((item ->> 'quantidade_ton')::numeric, 3),
    nullif(item ->> 'preco_unitario', '')::numeric,
    nullif(btrim(item ->> 'embalagem'), ''),
    coalesce(nullif(item ->> 'precificacao_id', '')::uuid, v_precificacao)
  from jsonb_array_elements(p_itens) item;

  perform private.recalcular_pedido_venda(v_pedido_id);
  return v_pedido_id;
exception
  when unique_violation then
    raise exception 'Pedido duplicado: já existe um pedido com esse número e emitente.'
      using errcode = '23505';
end;
$$;

-- Carteira: nome do cliente também pela precificação (pedidos antigos) e a região.
create or replace function public.buscar_carteira_pedidos_venda(
  p_busca text default null,
  p_status text default null,
  p_filial_id uuid default null,
  p_safra text default null,
  p_offset integer default 0,
  p_limit integer default 25
)
returns table(pedido jsonb, total_registros bigint)
language sql
stable
set search_path = ''
as $$
  select
    to_jsonb(pedido_venda) || jsonb_build_object(
      'cliente_nome', coalesce(cliente.name, precificacao.factors -> 'client' ->> 'name'),
      'cliente_ie', coalesce(cliente.state_registration,
                             precificacao.factors -> 'client' ->> 'stateRegistration'),
      'cliente_fazenda', cliente.fazenda,
      'regiao_nome', regiao.name,
      'vendedor_nome', coalesce(nullif(btrim(vendedor.nickname), ''), vendedor.name),
      'ultima_movimentacao', greatest(
        pedido_venda.criado_em,
        (select max(carga.criado_em) from public.carregamentos carga
          where carga.pedido_venda_id = pedido_venda.id)
      )
    ) as pedido,
    count(*) over () as total_registros
  from public.pedidos_venda pedido_venda
  left join public.clients cliente on cliente.id = pedido_venda.cliente_id
  left join public.pricing_records precificacao on precificacao.id = pedido_venda.precificacao_id
  left join public.regions regiao on regiao.id = pedido_venda.region_id
  left join public.app_users vendedor on vendedor.id = pedido_venda.importado_por
  where pedido_venda.organization_id = (select public.get_current_organization_id())
    and (nullif(btrim(p_status), '') is null or pedido_venda.status = p_status)
    and (p_filial_id is null or pedido_venda.filial_id = p_filial_id)
    and (nullif(btrim(p_safra), '') is null or pedido_venda.safra = btrim(p_safra))
    and (
      nullif(btrim(p_busca), '') is null
      or pedido_venda.numero_pedido ilike '%' || btrim(p_busca) || '%'
      or pedido_venda.barra_pedido ilike '%' || btrim(p_busca) || '%'
      or coalesce(pedido_venda.numero_contrato, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(pedido_venda.produto_nome, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.name, precificacao.factors -> 'client' ->> 'name', '')
           ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.state_registration, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(vendedor.name, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(regiao.name, '') ilike '%' || btrim(p_busca) || '%'
    )
  order by coalesce(pedido_venda.data_pedido, pedido_venda.criado_em::date) desc,
           pedido_venda.criado_em desc, pedido_venda.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;
