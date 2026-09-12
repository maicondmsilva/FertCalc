-- Fase 4 de Pedidos de Venda: saldos cancelados consolidados e paginados.

create or replace function public.buscar_saldos_cancelados(
  p_busca text default null,
  p_data_inicio date default null,
  p_data_fim date default null,
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
  pedido_origem_fazenda text,
  pedido_origem_produto text,
  pedido_origem_quantidade numeric,
  pedido_origem_saldo numeric,
  pedido_origem_disponivel boolean,
  total_registros bigint,
  total_quantidade numeric
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
    cliente.name as pedido_origem_cliente,
    cliente.state_registration as pedido_origem_ie,
    cliente.fazenda as pedido_origem_fazenda,
    coalesce(produtos.produtos, origem.produto_nome) as pedido_origem_produto,
    coalesce(origem.quantidade_original, origem.quantidade_real) as pedido_origem_quantidade,
    origem.saldo_disponivel as pedido_origem_saldo,
    origem.id is not null as pedido_origem_disponivel,
    count(*) over () as total_registros,
    sum(cancelamento.quantidade) over () as total_quantidade
  from public.cancelamentos_pedido cancelamento
  join public.pedidos_venda origem on origem.id = cancelamento.pedido_origem_id
  left join public.clients cliente on cliente.id = origem.cliente_id
  left join lateral (
    select string_agg(item.produto_nome, ', ' order by item.produto_nome, item.id) as produtos
    from public.pedidos_venda_itens item
    where item.pedido_venda_id = origem.id
  ) produtos on true
  where cancelamento.organization_id = (select public.get_current_organization_id())
    and cancelamento.tipo = 'definitivo'
    and (p_data_inicio is null or cancelamento.criado_em >= p_data_inicio::timestamptz)
    and (p_data_fim is null or cancelamento.criado_em < (p_data_fim + 1)::timestamptz)
    and (
      nullif(btrim(p_busca), '') is null
      or origem.numero_pedido ilike '%' || btrim(p_busca) || '%'
      or origem.barra_pedido ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.name, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.state_registration, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(cancelamento.usuario_nome, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(produtos.produtos, origem.produto_nome, '') ilike '%' || btrim(p_busca) || '%'
    )
  order by cancelamento.criado_em desc, cancelamento.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 5000);
$$;

revoke all on function public.buscar_saldos_cancelados(text,date,date,integer,integer)
  from public, anon;
grant execute on function public.buscar_saldos_cancelados(text,date,date,integer,integer)
  to authenticated;

notify pgrst, 'reload schema';

