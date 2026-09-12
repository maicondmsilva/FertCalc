-- Fase 3 de Pedidos de Venda: relatorio consolidado, filtrado e paginado no banco.

create index if not exists idx_cancelamentos_pedido_org_criado_tipo
  on public.cancelamentos_pedido (organization_id, criado_em desc, tipo);

create or replace function public.buscar_cancelamentos_pedido_relatorio(
  p_tipo text default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_numero_pedido text default null,
  p_cliente_nome text default null,
  p_usuario_nome text default null,
  p_emitente_origem integer default null,
  p_emitente_destino integer default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  pedido_origem_id uuid,
  pedido_destino_id uuid,
  tipo text,
  quantidade numeric,
  motivo text,
  usuario_id text,
  usuario_nome text,
  criado_em timestamptz,
  pedido_origem_nome text,
  pedido_origem_cliente text,
  pedido_origem_ie text,
  pedido_origem_produto text,
  pedido_origem_quantidade numeric,
  pedido_origem_saldo numeric,
  pedido_destino_nome text,
  pedido_destino_cliente text,
  pedido_destino_ie text,
  pedido_destino_disponivel boolean,
  total_registros bigint,
  total_quantidade numeric,
  total_definitivos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    cancelamento.id,
    cancelamento.pedido_origem_id,
    cancelamento.pedido_destino_id,
    cancelamento.tipo,
    cancelamento.quantidade,
    cancelamento.motivo,
    cancelamento.usuario_id,
    cancelamento.usuario_nome,
    cancelamento.criado_em,
    coalesce(
      nullif(origem.barra_pedido, ''),
      origem.numero_pedido || '/' || coalesce(origem.emitente, 1)
    ) as pedido_origem_nome,
    cliente_origem.name as pedido_origem_cliente,
    cliente_origem.state_registration as pedido_origem_ie,
    coalesce(produtos_origem.produtos, origem.produto_nome) as pedido_origem_produto,
    coalesce(origem.quantidade_original, origem.quantidade_real) as pedido_origem_quantidade,
    origem.saldo_disponivel as pedido_origem_saldo,
    case when destino.id is null then null else coalesce(
      nullif(destino.barra_pedido, ''),
      destino.numero_pedido || '/' || coalesce(destino.emitente, 1)
    ) end as pedido_destino_nome,
    cliente_destino.name as pedido_destino_cliente,
    cliente_destino.state_registration as pedido_destino_ie,
    destino.id is not null as pedido_destino_disponivel,
    count(*) over () as total_registros,
    sum(cancelamento.quantidade) over () as total_quantidade,
    count(*) filter (where cancelamento.tipo = 'definitivo') over () as total_definitivos
  from public.cancelamentos_pedido cancelamento
  join public.pedidos_venda origem on origem.id = cancelamento.pedido_origem_id
  left join public.pedidos_venda destino on destino.id = cancelamento.pedido_destino_id
  left join public.clients cliente_origem on cliente_origem.id = origem.cliente_id
  left join public.clients cliente_destino on cliente_destino.id = destino.cliente_id
  left join lateral (
    select string_agg(item.produto_nome, ', ' order by item.produto_nome, item.id) as produtos
    from public.pedidos_venda_itens item
    where item.pedido_venda_id = origem.id
  ) produtos_origem on true
  where cancelamento.organization_id = (select public.get_current_organization_id())
    and (p_tipo is null or cancelamento.tipo = p_tipo)
    and (p_data_inicio is null or cancelamento.criado_em >= p_data_inicio::timestamptz)
    and (p_data_fim is null or cancelamento.criado_em < (p_data_fim + 1)::timestamptz)
    and (
      nullif(btrim(p_numero_pedido), '') is null
      or origem.numero_pedido ilike '%' || btrim(p_numero_pedido) || '%'
      or origem.barra_pedido ilike '%' || btrim(p_numero_pedido) || '%'
      or destino.numero_pedido ilike '%' || btrim(p_numero_pedido) || '%'
      or destino.barra_pedido ilike '%' || btrim(p_numero_pedido) || '%'
    )
    and (
      nullif(btrim(p_cliente_nome), '') is null
      or cliente_origem.name ilike '%' || btrim(p_cliente_nome) || '%'
      or cliente_destino.name ilike '%' || btrim(p_cliente_nome) || '%'
    )
    and (
      nullif(btrim(p_usuario_nome), '') is null
      or cancelamento.usuario_nome ilike '%' || btrim(p_usuario_nome) || '%'
    )
    and (p_emitente_origem is null or origem.emitente = p_emitente_origem)
    and (p_emitente_destino is null or destino.emitente = p_emitente_destino)
  order by cancelamento.criado_em desc, cancelamento.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 5000);
$$;

revoke all on function public.buscar_cancelamentos_pedido_relatorio(
  text,date,date,text,text,text,integer,integer,integer,integer
) from public, anon;
grant execute on function public.buscar_cancelamentos_pedido_relatorio(
  text,date,date,text,text,text,integer,integer,integer,integer
) to authenticated;

notify pgrst, 'reload schema';
