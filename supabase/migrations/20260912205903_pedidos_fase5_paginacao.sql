-- Fase 5 de Pedidos de Venda: listagem e pesquisa paginadas no banco.

create or replace function public.buscar_pedidos_venda_paginados(
  p_busca text default null,
  p_status text default null,
  p_filial_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 25
)
returns table (pedido jsonb, total_registros bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    to_jsonb(pedido_venda) || jsonb_build_object(
      'cliente_nome', cliente.name,
      'cliente_ie', cliente.state_registration,
      'cliente_fazenda', cliente.fazenda
    ) as pedido,
    count(*) over () as total_registros
  from public.pedidos_venda pedido_venda
  left join public.clients cliente on cliente.id = pedido_venda.cliente_id
  where pedido_venda.organization_id = (select public.get_current_organization_id())
    and (nullif(btrim(p_status), '') is null or pedido_venda.status = p_status)
    and (p_filial_id is null or pedido_venda.filial_id = p_filial_id)
    and (
      nullif(btrim(p_busca), '') is null
      or pedido_venda.numero_pedido ilike '%' || btrim(p_busca) || '%'
      or pedido_venda.barra_pedido ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.name, '') ilike '%' || btrim(p_busca) || '%'
      or coalesce(cliente.state_registration, '') ilike '%' || btrim(p_busca) || '%'
    )
  order by pedido_venda.criado_em asc, pedido_venda.id asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

revoke all on function public.buscar_pedidos_venda_paginados(text,text,uuid,integer,integer)
  from public, anon;
grant execute on function public.buscar_pedidos_venda_paginados(text,text,uuid,integer,integer)
  to authenticated;

notify pgrst, 'reload schema';

