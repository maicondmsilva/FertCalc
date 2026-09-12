begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'pedidos-fase3@example.test', 'Pedidos Fase 3', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.clients (
  id, organization_id, code, name, state_registration
) values
  ('c3000000-0000-4000-8000-000000000001',
   (select id from public.organizations where slug = 'fertcalc'),
   'FASE3-ORIGEM', 'Cliente Origem Fase 3', 'IE-ORIGEM'),
  ('c3000000-0000-4000-8000-000000000002',
   (select id from public.organizations where slug = 'fertcalc'),
   'FASE3-DESTINO', 'Cliente Destino Fase 3', 'IE-DESTINO');

insert into public.pedidos_venda (
  id, organization_id, numero_pedido, barra_pedido, emitente, cliente_id,
  quantidade_real, quantidade_original, status, status_pedido, importado_por
) values
  ('a3000000-0000-4000-8000-000000000001',
   (select id from public.organizations where slug = 'fertcalc'),
   'REL-FASE3', 'REL-FASE3/1', 1, 'c3000000-0000-4000-8000-000000000001',
   100, 100, 'pendente', 'ativo', 'b3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002',
   (select id from public.organizations where slug = 'fertcalc'),
   'REL-FASE3', 'REL-FASE3/2', 2, 'c3000000-0000-4000-8000-000000000002',
   20, 20, 'pendente', 'ativo', 'b3000000-0000-4000-8000-000000000001');

insert into public.pedidos_venda_itens (
  organization_id, pedido_venda_id, produto_nome, quantidade_ton
) values
  ((select id from public.organizations where slug = 'fertcalc'),
   'a3000000-0000-4000-8000-000000000001', 'Produto A', 60),
  ((select id from public.organizations where slug = 'fertcalc'),
   'a3000000-0000-4000-8000-000000000001', 'Produto B', 40),
  ((select id from public.organizations where slug = 'fertcalc'),
   'a3000000-0000-4000-8000-000000000002', 'Produto Destino', 20);

insert into public.cancelamentos_pedido (
  organization_id, pedido_origem_id, pedido_destino_id, tipo,
  quantidade, motivo, usuario_id, usuario_nome
) values (
  (select id from public.organizations where slug = 'fertcalc'),
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'canc_substitui', 20, 'Teste relatorio',
  'b3000000-0000-4000-8000-000000000001', 'Pedidos Fase 3'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  linha record;
begin
  select * into linha
  from public.buscar_cancelamentos_pedido_relatorio(
    p_numero_pedido => 'REL-FASE3',
    p_cliente_nome => 'Destino Fase 3',
    p_emitente_origem => 1,
    p_emitente_destino => 2,
    p_limit => 20
  );

  if linha.id is null
     or linha.pedido_origem_nome <> 'REL-FASE3/1'
     or linha.pedido_destino_nome <> 'REL-FASE3/2'
     or linha.pedido_origem_cliente <> 'Cliente Origem Fase 3'
     or linha.pedido_destino_cliente <> 'Cliente Destino Fase 3'
     or linha.pedido_origem_ie <> 'IE-ORIGEM'
     or linha.pedido_destino_ie <> 'IE-DESTINO'
     or linha.pedido_origem_produto <> 'Produto A, Produto B'
     or linha.total_registros <> 1
     or linha.total_quantidade <> 20 then
    raise exception 'Relatorio consolidado incorreto: %', to_jsonb(linha);
  end if;
end;
$$;

rollback;
