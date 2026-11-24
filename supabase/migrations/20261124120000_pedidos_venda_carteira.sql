-- Pedidos de Venda: dados comerciais novos, carteira com vendedor e resumo.

alter table public.pedidos_venda
  add column if not exists safra text,
  add column if not exists previsao_entrega date,
  add column if not exists local_entrega text,
  add column if not exists numero_contrato text;

-- Criação do pedido passa a gravar os campos novos.
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

  if v_cliente is not null and not exists (
    select 1 from public.clients where id = v_cliente and organization_id = v_org
  ) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  if v_precificacao is not null and not exists (
    select 1 from public.pricing_records where id = v_precificacao and organization_id = v_org
  ) then
    raise exception 'Precificação não encontrada.' using errcode = '42501';
  end if;
  if v_filial is not null and not exists (
    select 1 from public.branches where id = v_filial and organization_id = v_org
  ) then
    raise exception 'Filial não encontrada.' using errcode = '42501';
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
    filial_id, formulacao_alterada, safra, previsao_entrega, local_entrega, numero_contrato
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
    nullif(btrim(p_pedido ->> 'numero_contrato'), '')
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

-- Edição dos dados comerciais (safra, previsão, local de entrega, contrato),
-- com o mesmo controle de acesso da edição protegida e registro no histórico.
create or replace function public.atualizar_dados_comerciais_pedido(
  p_pedido_id uuid,
  p_safra text,
  p_previsao_entrega date,
  p_local_entrega text,
  p_numero_contrato text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_old public.pedidos_venda%rowtype;
  v_new_snapshot jsonb;
  v_old_snapshot jsonb;
  v_changed text[];
begin
  if v_user_id is null or v_org is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  select * into v_old
  from public.pedidos_venda
  where id = p_pedido_id
    and organization_id = v_org
    and (importado_por = v_user_id or private.app_user_hierarchy(v_user_id) >= 60)
  for update;
  if not found then
    raise exception 'Pedido não encontrado ou sem permissão.' using errcode = '42501';
  end if;

  v_old_snapshot := jsonb_build_object(
    'safra', v_old.safra, 'previsao_entrega', v_old.previsao_entrega,
    'local_entrega', v_old.local_entrega, 'numero_contrato', v_old.numero_contrato
  );
  v_new_snapshot := jsonb_build_object(
    'safra', nullif(btrim(p_safra), ''), 'previsao_entrega', p_previsao_entrega,
    'local_entrega', nullif(btrim(p_local_entrega), ''),
    'numero_contrato', nullif(btrim(p_numero_contrato), '')
  );
  select coalesce(array_agg(key order by key), '{}') into v_changed
  from jsonb_object_keys(v_new_snapshot) key
  where v_new_snapshot -> key is distinct from v_old_snapshot -> key;
  if cardinality(v_changed) = 0 then
    return;
  end if;

  update public.pedidos_venda
  set safra = nullif(btrim(p_safra), ''),
      previsao_entrega = p_previsao_entrega,
      local_entrega = nullif(btrim(p_local_entrega), ''),
      numero_contrato = nullif(btrim(p_numero_contrato), ''),
      atualizado_em = clock_timestamp()
  where id = v_old.id;

  insert into public.pedido_venda_audit (
    pedido_venda_id, organization_id, usuario_id, motivo,
    dados_anteriores, dados_novos, campos_alterados
  ) values (
    v_old.id, v_org, v_user_id, 'Dados comerciais atualizados',
    v_old_snapshot, v_new_snapshot, v_changed
  );
end;
$$;
revoke all on function public.atualizar_dados_comerciais_pedido(uuid, text, date, text, text)
  from public, anon;
grant execute on function public.atualizar_dados_comerciais_pedido(uuid, text, date, text, text)
  to authenticated;

-- Carteira de pedidos: filtros, mais recentes primeiro, cliente e vendedor.
-- Roda com as permissões do usuário (as regras de acesso dos pedidos valem).
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
security invoker
set search_path = ''
as $$
  select
    to_jsonb(pedido_venda) || jsonb_build_object(
      'cliente_nome', cliente.name,
      'cliente_ie', cliente.state_registration,
      'cliente_fazenda', cliente.fazenda,
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
      or coalesce(cliente.name, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.state_registration, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(vendedor.name, '') ilike '%' || btrim(p_busca) || '%'
    )
  order by coalesce(pedido_venda.data_pedido, pedido_venda.criado_em::date) desc,
           pedido_venda.criado_em desc, pedido_venda.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;
revoke all on function public.buscar_carteira_pedidos_venda(text, text, uuid, text, integer, integer)
  from public, anon;
grant execute on function public.buscar_carteira_pedidos_venda(text, text, uuid, text, integer, integer)
  to authenticated;

-- Indicadores da carteira (mesmos filtros de filial e safra).
create or replace function public.resumo_carteira_pedidos_venda(
  p_filial_id uuid default null,
  p_safra text default null,
  p_dias_parado integer default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with carteira as (
    select
      pedido.*,
      greatest(
        pedido.criado_em,
        (select max(carga.criado_em) from public.carregamentos carga
          where carga.pedido_venda_id = pedido.id)
      ) as ultima_movimentacao
    from public.pedidos_venda pedido
    where pedido.organization_id = (select public.get_current_organization_id())
      and (p_filial_id is null or pedido.filial_id = p_filial_id)
      and (nullif(btrim(p_safra), '') is null or pedido.safra = btrim(p_safra))
  )
  select jsonb_build_object(
    'ativos', count(*) filter (where status in ('pendente', 'em_carregamento')),
    'em_carregamento', count(*) filter (where status = 'em_carregamento'),
    'concluidos', count(*) filter (where status = 'concluido'),
    'cancelados', count(*) filter (where status = 'cancelado'),
    'volume_ativo', coalesce(sum(coalesce(quantidade_original, quantidade_real, 0))
      filter (where status in ('pendente', 'em_carregamento')), 0),
    'saldo_a_carregar', coalesce(sum(saldo_a_carregar)
      filter (where status in ('pendente', 'em_carregamento')), 0),
    'carregado', coalesce(sum(quantidade_carregada), 0),
    'parados', count(*) filter (
      where status in ('pendente', 'em_carregamento')
        and saldo_a_carregar > 0
        and ultima_movimentacao < now() - make_interval(days => greatest(coalesce(p_dias_parado, 30), 1))
    ),
    'safras', coalesce((
      select jsonb_agg(distinct pedido.safra order by pedido.safra desc)
      from public.pedidos_venda pedido
      where pedido.organization_id = (select public.get_current_organization_id())
        and pedido.safra is not null
    ), '[]'::jsonb)
  )
  from carteira;
$$;
revoke all on function public.resumo_carteira_pedidos_venda(uuid, text, integer) from public, anon;
grant execute on function public.resumo_carteira_pedidos_venda(uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';
