-- Pedido ↔ precificação ↔ carregamento.
--  • O pedido guarda local de carregamento, endereço de entrega e a cotação de
--    frete; tudo herdado da precificação (e do cadastro do cliente) ao criar.
--  • O endereço de entrega pode mudar, sempre com motivo e histórico
--    (pedido_venda_audit).
--  • Solicitar carregamento a partir do pedido já leva número/emitente, filial,
--    local, endereço e a transportadora/frete da cotação.

alter table public.pedidos_venda
  add column if not exists local_carregamento_id uuid references public.locais_carregamento (id),
  add column if not exists endereco_entrega text,
  add column if not exists cidade_entrega text,
  add column if not exists estado_entrega text,
  add column if not exists maps_url text,
  add column if not exists cotacao_frete_id uuid references public.cotacoes_solicitadas (id);

-- Endereço de entrega do cliente (entrega, senão o principal) a partir do JSON.
create or replace function private.endereco_do_cliente(p_client jsonb)
returns table(endereco text, cidade text, estado text)
language sql
immutable
set search_path = ''
as $$
  with a as (
    select case
      when coalesce(p_client -> 'deliveryAddress' ->> 'street', '') <> '' then p_client -> 'deliveryAddress'
      else p_client -> 'address'
    end as addr
  )
  select
    nullif(concat_ws(', ',
      nullif(btrim(concat_ws(' ', nullif(addr ->> 'street', ''), nullif(addr ->> 'number', ''))), ''),
      nullif(addr ->> 'neighborhood', '')), ''),
    nullif(addr ->> 'city', ''),
    nullif(addr ->> 'state', '')
  from a;
$$;

-- Preenche os pedidos já existentes a partir da precificação.
update public.pedidos_venda pv
   set local_carregamento_id = coalesce(pv.local_carregamento_id, (
         select l.id from public.locais_carregamento l
          where l.organization_id = pv.organization_id
            and l.id::text = pr.factors ->> 'local_carregamento_id')),
       cotacao_frete_id = coalesce(pv.cotacao_frete_id, (
         select c.id from public.cotacoes_solicitadas c
          where c.organization_id = pv.organization_id
            and c.id::text = coalesce(nullif(pr.factors ->> 'cotacaoFreteId', ''), pr.cotacao_frete_id::text))),
       endereco_entrega = coalesce(pv.endereco_entrega, e.endereco),
       cidade_entrega = coalesce(pv.cidade_entrega, e.cidade),
       estado_entrega = coalesce(pv.estado_entrega, e.estado)
  from public.pricing_records pr
  cross join lateral private.endereco_do_cliente(pr.factors -> 'client') e
 where pr.id = pv.precificacao_id;

-- Criar pedido (mesma função, agora herdando local, endereço e cotação).
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
  v_local uuid := nullif(p_pedido ->> 'local_carregamento_id', '')::uuid;
  v_cotacao uuid := nullif(p_pedido ->> 'cotacao_frete_id', '')::uuid;
  v_endereco text := nullif(btrim(p_pedido ->> 'endereco_entrega'), '');
  v_cidade text := nullif(btrim(p_pedido ->> 'cidade_entrega'), '');
  v_estado text := nullif(btrim(p_pedido ->> 'estado_entrega'), '');
  v_pricing public.pricing_records%rowtype;
  v_end record;
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
    if v_cliente is null then
      select c.id into v_cliente from public.clients c
       where c.organization_id = v_org and c.id::text = v_pricing.factors -> 'client' ->> 'id';
    end if;
    if v_filial is null then
      select b.id into v_filial from public.branches b
       where b.organization_id = v_org and b.id::text = v_pricing.factors ->> 'branchId';
    end if;
    if v_local is null then
      select l.id into v_local from public.locais_carregamento l
       where l.organization_id = v_org and l.id::text = v_pricing.factors ->> 'local_carregamento_id';
    end if;
    if v_cotacao is null then
      select c.id into v_cotacao from public.cotacoes_solicitadas c
       where c.organization_id = v_org
         and c.id::text = coalesce(nullif(v_pricing.factors ->> 'cotacaoFreteId', ''),
                                   v_pricing.cotacao_frete_id::text);
    end if;
    if v_endereco is null then
      select * into v_end from private.endereco_do_cliente(v_pricing.factors -> 'client');
      v_endereco := v_end.endereco;
      v_cidade := coalesce(v_cidade, v_end.cidade);
      v_estado := coalesce(v_estado, v_end.estado);
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
  if v_local is not null and not exists (
    select 1 from public.locais_carregamento where id = v_local and organization_id = v_org
  ) then
    raise exception 'Local de carregamento não encontrado.' using errcode = '42501';
  end if;
  if v_cotacao is not null and not exists (
    select 1 from public.cotacoes_solicitadas where id = v_cotacao and organization_id = v_org
  ) then
    raise exception 'Cotação de frete não encontrada.' using errcode = '42501';
  end if;

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
    region_id, local_carregamento_id, cotacao_frete_id, endereco_entrega, cidade_entrega,
    estado_entrega, maps_url
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
    v_region,
    v_local,
    v_cotacao,
    v_endereco,
    v_cidade,
    v_estado,
    nullif(btrim(p_pedido ->> 'maps_url'), '')
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

-- Alterar o endereço de entrega: com motivo e histórico.
create or replace function public.alterar_endereco_entrega_pedido(
  p_pedido_id uuid,
  p_endereco text,
  p_cidade text,
  p_estado text,
  p_maps_url text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  pv public.pedidos_venda%rowtype;
  motivo text := btrim(coalesce(p_motivo, ''));
  novo jsonb;
  antes jsonb;
begin
  select * into pv from public.pedidos_venda
   where id = p_pedido_id and organization_id = public.get_current_organization_id()
   for update;
  if not found or not private.can_access_pedido(pv.importado_por, pv.region_id) then
    raise exception 'Pedido não encontrado ou fora do seu acesso.' using errcode = '42501';
  end if;
  if pv.status in ('cancelado', 'concluido') then
    raise exception 'Pedido encerrado não pode mudar o endereço.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_endereco, '')), '') is null then
    raise exception 'Informe o endereço de entrega.' using errcode = '22023';
  end if;
  if length(motivo) < 5 then
    raise exception 'Informe o motivo da alteração.' using errcode = '22023';
  end if;

  antes := jsonb_build_object('endereco_entrega', pv.endereco_entrega, 'cidade_entrega', pv.cidade_entrega,
                              'estado_entrega', pv.estado_entrega, 'maps_url', pv.maps_url);
  novo := jsonb_build_object('endereco_entrega', btrim(p_endereco),
                             'cidade_entrega', nullif(btrim(coalesce(p_cidade, '')), ''),
                             'estado_entrega', nullif(upper(btrim(coalesce(p_estado, ''))), ''),
                             'maps_url', nullif(btrim(coalesce(p_maps_url, '')), ''));
  if antes = novo then
    raise exception 'O endereço informado é igual ao atual.' using errcode = '22023';
  end if;

  update public.pedidos_venda
     set endereco_entrega = novo ->> 'endereco_entrega',
         cidade_entrega = novo ->> 'cidade_entrega',
         estado_entrega = novo ->> 'estado_entrega',
         maps_url = novo ->> 'maps_url',
         atualizado_em = now()
   where id = pv.id;

  insert into public.pedido_venda_audit (
    pedido_venda_id, organization_id, usuario_id, motivo, dados_anteriores, dados_novos, campos_alterados
  ) values (
    pv.id, pv.organization_id, v_user, 'Endereço de entrega alterado: ' || motivo, antes, novo,
    array(select k from jsonb_object_keys(novo) k where antes -> k is distinct from novo -> k)
  );
end;
$$;
revoke all on function public.alterar_endereco_entrega_pedido(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.alterar_endereco_entrega_pedido(uuid, text, text, text, text, text) to authenticated;

-- Solicitar carregamento: herda do pedido número/emitente, filial, local,
-- endereço, cliente e a transportadora/frete da cotação aprovada.
create or replace function public.criar_carregamento(p_payload jsonb, p_itens jsonb, p_request_id uuid)
returns public.carregamentos
language plpgsql
set search_path = ''
as $$
declare
  u public.app_users%rowtype;
  c public.carregamentos%rowtype;
  pedido public.pedidos_venda%rowtype;
  cot public.cotacoes_solicitadas%rowtype;
  v_total numeric(15,3);
  v_soma numeric(15,3);
  v_order uuid;
  v_branch uuid;
  v_location uuid;
  v_pricing uuid;
  v_request jsonb;
  v_numero text := nullif(p_payload ->> 'pedido_venda_numero', '');
  v_frete numeric := nullif(p_payload ->> 'valor_frete', '')::numeric;
  v_cliente_nome text;
begin
  select * into u from public.app_users where id = (select auth.uid()) and ativo;
  if not found then raise exception 'Sessão expirada.' using errcode = '42501'; end if;
  if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception 'Dados da solicitação inválidos.' using errcode = '23514';
  end if;
  v_request := jsonb_build_object('payload', p_payload, 'itens', p_itens);
  perform pg_advisory_xact_lock(hashtextextended(u.id::text || p_request_id::text, 0));
  select * into c from public.carregamentos
   where organization_id = u.organization_id and criado_por = u.id and creation_request_id = p_request_id;
  if found then
    if c.creation_request is distinct from v_request then
      raise exception 'Esta solicitação já foi salva com outros dados. Atualize a página.' using errcode = '23514';
    end if;
    return c;
  end if;
  v_total := (p_payload ->> 'quantidade_total')::numeric;
  if v_total is null or v_total::text in ('NaN', 'Infinity', '-Infinity') or v_total <= 0
    or coalesce(p_payload ->> 'tipo_frete', '') not in ('CIF', 'FOB') then
    raise exception 'Quantidade e tipo de frete inválidos.' using errcode = '23514';
  end if;
  v_order := nullif(p_payload ->> 'pedido_venda_id', '')::uuid;
  v_branch := nullif(p_payload ->> 'filial_id', '')::uuid;
  v_location := nullif(p_payload ->> 'local_carregamento_id', '')::uuid;
  v_pricing := nullif(p_payload ->> 'pedido_precificacao_id', '')::uuid;

  if v_order is not null then
    select * into pedido from public.pedidos_venda
     where id = v_order and organization_id = u.organization_id for update;
    if not found then raise exception 'Pedido indisponível para solicitar carga.' using errcode = '42501'; end if;
    -- Do pedido: filial, local, precificação e o número/emitente.
    v_branch := coalesce(v_branch, pedido.filial_id);
    v_location := coalesce(v_location, pedido.local_carregamento_id);
    v_pricing := coalesce(v_pricing, pedido.precificacao_id);
    v_numero := coalesce(pedido.barra_pedido, pedido.numero_pedido || '/' || pedido.emitente, v_numero);
    select name into v_cliente_nome from public.clients where id = pedido.cliente_id;
    if pedido.cotacao_frete_id is not null then
      select * into cot from public.cotacoes_solicitadas
       where id = pedido.cotacao_frete_id and status = 'aprovado';
    end if;
  end if;

  if v_branch is not null and not exists(select 1 from public.branches where id = v_branch and organization_id = u.organization_id) then
    raise exception 'Filial indisponível.' using errcode = '42501';
  end if;
  if v_location is not null and not exists(
    select 1 from public.locais_carregamento where id = v_location and organization_id = u.organization_id
      and (v_branch is null or filial_id = v_branch)
  ) then raise exception 'Local de carregamento incompatível com a filial.' using errcode = '23514'; end if;
  if v_pricing is not null and not exists(select 1 from public.pricing_records where id = v_pricing and organization_id = u.organization_id) then
    raise exception 'Precificação indisponível.' using errcode = '42501';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_itens) i
     where jsonb_typeof(i) is distinct from 'object' or nullif(btrim(i ->> 'produto_nome'), '') is null
       or i ->> 'quantidade_ton' is null or (i ->> 'quantidade_ton')::numeric::text in ('NaN', 'Infinity', '-Infinity')
       or round((i ->> 'quantidade_ton')::numeric, 3) <= 0
  ) then raise exception 'Todos os produtos precisam de nome e quantidade positiva.' using errcode = '23514'; end if;
  select coalesce(sum(round((i ->> 'quantidade_ton')::numeric, 3)), 0) into v_soma from jsonb_array_elements(p_itens) i;
  if jsonb_array_length(p_itens) > 0 and v_soma <> v_total then
    raise exception 'A soma dos produtos não coincide com o total.' using errcode = '23514';
  end if;
  if v_order is not null then
    if pedido.status in ('cancelado', 'concluido') or pedido.status_pedido in ('cancelado', 'concluido') then
      raise exception 'Pedido encerrado.' using errcode = '23514';
    end if;
    if jsonb_array_length(p_itens) = 0 then raise exception 'Selecione os produtos do pedido.' using errcode = '23514'; end if;
    if v_total > coalesce(pedido.saldo_disponivel, 0) then raise exception 'Saldo insuficiente no pedido.' using errcode = '23514'; end if;
    perform item.id from public.pedidos_venda_itens item
     where item.pedido_venda_id = v_order order by item.id for update;
    if exists(
      select 1 from jsonb_array_elements(p_itens) i
      left join public.pedidos_venda_itens item on item.id = nullif(i ->> 'pedido_venda_item_id', '')::uuid
        and item.pedido_venda_id = v_order and item.organization_id = u.organization_id
      where item.id is null
    ) then raise exception 'Produto não pertence ao pedido informado.' using errcode = '23514'; end if;
    if exists(
      select 1 from jsonb_array_elements(p_itens) i
      join public.pedidos_venda_itens item on item.id = (i ->> 'pedido_venda_item_id')::uuid
      group by item.id, item.saldo_disponivel
      having sum(round((i ->> 'quantidade_ton')::numeric, 3)) > coalesce(item.saldo_disponivel, 0)
    ) then raise exception 'Saldo insuficiente para um dos produtos.' using errcode = '23514'; end if;
  elsif exists(select 1 from jsonb_array_elements(p_itens) i where nullif(i ->> 'pedido_venda_item_id', '') is not null) then
    raise exception 'Informe o pedido dos produtos selecionados.' using errcode = '23514';
  end if;

  insert into public.carregamentos(
    organization_id, criado_por, numero_carregamento, tipo_frete, status, quantidade_total,
    quantidade_liberada, quantidade_carregada, filial_id, local_carregamento_id,
    pedido_precificacao_id, pedido_venda_id, pedido_venda_numero, data_prevista_carregamento,
    observacoes, valor_frete, creation_request_id, creation_request,
    transportadora_id, valor_frete_unitario, cotacao_id, endereco_entrega, maps_url, cliente_nome
  ) values(
    u.organization_id, u.id, '', p_payload ->> 'tipo_frete', 'aguardando_liberacao', v_total,
    0, 0, v_branch, v_location, v_pricing, v_order, v_numero,
    coalesce(nullif(p_payload ->> 'data_prevista_carregamento', '')::date, pedido.previsao_entrega),
    p_payload ->> 'observacoes',
    -- Frete por tonelada, como no pedido.
    coalesce(v_frete, cot.valor_frete_unitario),
    p_request_id, v_request,
    cot.transportadora_id,
    cot.valor_frete_unitario,
    cot.id,
    nullif(concat_ws(' · ', pedido.endereco_entrega,
                     nullif(concat_ws('/', pedido.cidade_entrega, pedido.estado_entrega), '')), ''),
    pedido.maps_url,
    coalesce(v_cliente_nome, nullif(p_payload ->> 'cliente_nome', ''))
  ) returning * into c;

  insert into public.carregamento_itens(
    organization_id, carregamento_id, pedido_venda_item_id, produto_nome, quantidade_ton, embalagem
  ) select u.organization_id, c.id, nullif(i ->> 'pedido_venda_item_id', '')::uuid,
    btrim(i ->> 'produto_nome'), round((i ->> 'quantidade_ton')::numeric, 3), i ->> 'embalagem'
    from jsonb_array_elements(p_itens) i;
  perform public.write_audit_log_entry('carregamentos', c.id::text, 'INSERT', null, to_jsonb(c), null, 'Criação da solicitação e produtos.');
  return c;
end;
$$;
