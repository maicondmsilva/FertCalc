begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b2000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'pedidos-fase2@example.test', 'Pedidos Fase 2', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.pedidos_venda (
  id, organization_id, numero_pedido, emitente, quantidade_real,
  quantidade_original, status, status_pedido, importado_por
) values (
  'a2000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'TESTE-FASE2', 1, 100, 100, 'pendente', 'ativo',
  'b2000000-0000-4000-8000-000000000001'
);

insert into public.pedidos_venda_itens (
  id, organization_id, pedido_venda_id, produto_nome, quantidade_ton
) values (
  'a2000000-0000-4000-8000-000000000002',
  (select id from public.organizations where slug = 'fertcalc'),
  'a2000000-0000-4000-8000-000000000001', 'Produto origem', 100
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  filho_id uuid;
  pai public.pedidos_venda%rowtype;
  filho public.pedidos_venda%rowtype;
  item_filho public.pedidos_venda_itens%rowtype;
  cancelado numeric;
begin
  filho_id := public.executar_pedido_canc_substitui(
    'a2000000-0000-4000-8000-000000000001',
    30,
    'Produto destino',
    'Troca solicitada pelo cliente',
    jsonb_build_object(
      'numero_pedido', 'TESTE-FASE2',
      'emitente', 2,
      'preco_unitario', 3500,
      'tipo_frete', 'FOB'
    )
  );

  select * into pai from public.pedidos_venda
  where id = 'a2000000-0000-4000-8000-000000000001';
  select * into filho from public.pedidos_venda where id = filho_id;
  select * into item_filho from public.pedidos_venda_itens
  where pedido_venda_id = filho_id;

  if pai.quantidade_desmembrada <> 30 or pai.saldo_disponivel <> 70 then
    raise exception 'Saldo do pedido origem incorreto: %', to_jsonb(pai);
  end if;
  if filho.quantidade_real <> 30 or filho.saldo_disponivel <> 30
     or filho.status <> 'pendente' or filho.pedido_pai_id <> pai.id then
    raise exception 'Pedido destino incorreto: %', to_jsonb(filho);
  end if;
  if item_filho.quantidade_ton <> 30 or item_filho.produto_nome <> 'Produto destino' then
    raise exception 'Item do pedido destino incorreto: %', to_jsonb(item_filho);
  end if;
  if not exists (
    select 1 from public.cancelamentos_pedido
    where pedido_origem_id = pai.id and pedido_destino_id = filho.id
      and tipo = 'canc_substitui' and quantidade = 30
  ) then
    raise exception 'Historico de substituicao nao foi criado.';
  end if;

  cancelado := public.executar_pedido_cancelamento_definitivo(
    pai.id, 20, 'Reducao definitiva solicitada pelo cliente'
  );
  select * into pai from public.pedidos_venda where id = pai.id;
  if cancelado <> 20 or pai.quantidade_cancelada_definitiva <> 20
     or pai.saldo_disponivel <> 50 then
    raise exception 'Cancelamento definitivo incorreto: %', to_jsonb(pai);
  end if;

  begin
    perform public.executar_pedido_cancelamento_definitivo(
      pai.id, 999, 'Teste de protecao de saldo'
    );
    raise exception 'Cancelamento acima do saldo foi aceito.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

rollback;
