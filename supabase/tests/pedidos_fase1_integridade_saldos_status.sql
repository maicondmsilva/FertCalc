begin;

insert into public.pedidos_venda (
  id, organization_id, numero_pedido, emitente, quantidade_real,
  quantidade_original, status, status_pedido
)
values (
  'a1000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'TESTE-FASE1-SALDO', 99, 100, 100, 'pendente', 'ativo'
);

insert into public.pedidos_venda_itens (
  id, organization_id, pedido_venda_id, produto_nome, quantidade_ton
)
values (
  'a1000000-0000-4000-8000-000000000002',
  (select id from public.organizations where slug = 'fertcalc'),
  'a1000000-0000-4000-8000-000000000001',
  'Produto teste', 100
);

insert into public.carregamentos (
  id, organization_id, numero_carregamento, tipo_frete, status,
  quantidade_total, quantidade_liberada, quantidade_carregada, pedido_venda_id
)
values (
  'a1000000-0000-4000-8000-000000000003',
  (select id from public.organizations where slug = 'fertcalc'),
  'TESTE-FASE1-SALDO', 'FOB', 'aguardando_liberacao', 40, 0, 0,
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.carregamento_itens (
  id, organization_id, carregamento_id, pedido_venda_item_id,
  produto_nome, quantidade_ton
)
values (
  'a1000000-0000-4000-8000-000000000004',
  (select id from public.organizations where slug = 'fertcalc'),
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000002',
  'Produto teste', 40
);

do $$
declare
  pedido public.pedidos_venda%rowtype;
begin
  select * into pedido from public.pedidos_venda
  where id = 'a1000000-0000-4000-8000-000000000001';

  if pedido.quantidade_reservada <> 40
     or pedido.quantidade_carregada <> 0
     or pedido.saldo_disponivel <> 60
     or pedido.saldo_a_carregar <> 100
     or pedido.status <> 'pendente' then
    raise exception 'Pedido aguardando aprovação foi consolidado incorretamente: %', to_jsonb(pedido);
  end if;
end;
$$;

update public.carregamentos
set status = 'liberado_total', quantidade_liberada = 40, quantidade_carregada = 10
where id = 'a1000000-0000-4000-8000-000000000003';

do $$
declare
  pedido public.pedidos_venda%rowtype;
  item public.pedidos_venda_itens%rowtype;
begin
  select * into pedido from public.pedidos_venda
  where id = 'a1000000-0000-4000-8000-000000000001';
  select * into item from public.pedidos_venda_itens
  where id = 'a1000000-0000-4000-8000-000000000002';

  if pedido.quantidade_reservada <> 40
     or pedido.quantidade_carregada <> 10
     or pedido.saldo_disponivel <> 60
     or pedido.saldo_a_carregar <> 90
     or pedido.status <> 'em_carregamento'
     or pedido.status_pedido <> 'ativo' then
    raise exception 'Pedido aprovado foi consolidado incorretamente: %', to_jsonb(pedido);
  end if;

  if item.quantidade_reservada <> 40
     or item.quantidade_carregada <> 10
     or item.saldo_disponivel <> 60
     or item.saldo_a_carregar <> 90 then
    raise exception 'Item foi consolidado incorretamente: %', to_jsonb(item);
  end if;
end;
$$;

rollback;
