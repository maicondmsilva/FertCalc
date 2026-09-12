begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b4000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'pedidos-fase4@example.test', 'Usuário Saldos Fase 4', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.clients (
  id, organization_id, code, name, state_registration, fazenda
) values (
  'c4000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'FASE4-CLIENTE', 'Cliente Saldos Fase 4', 'IE-FASE4', 'Fazenda Fase 4'
);

insert into public.pedidos_venda (
  id, organization_id, numero_pedido, barra_pedido, emitente, cliente_id,
  quantidade_real, quantidade_original, status, status_pedido, importado_por
) values (
  'a4000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'SALDO-FASE4', 'SALDO-FASE4/2', 2, 'c4000000-0000-4000-8000-000000000001',
  80, 80, 'pendente', 'ativo', 'b4000000-0000-4000-8000-000000000001'
);

insert into public.pedidos_venda_itens (
  organization_id, pedido_venda_id, produto_nome, quantidade_ton
) values (
  (select id from public.organizations where slug = 'fertcalc'),
  'a4000000-0000-4000-8000-000000000001', 'Produto Saldos Fase 4', 80
);

insert into public.cancelamentos_pedido (
  organization_id, pedido_origem_id, tipo, quantidade, motivo, usuario_id, usuario_nome
) values
  ((select id from public.organizations where slug = 'fertcalc'),
   'a4000000-0000-4000-8000-000000000001', 'definitivo', 12.5, 'Cancelamento definitivo',
   'b4000000-0000-4000-8000-000000000001', 'Usuário Saldos Fase 4'),
  ((select id from public.organizations where slug = 'fertcalc'),
   'a4000000-0000-4000-8000-000000000001', 'canc_substitui', 5, 'Não deve aparecer',
   'b4000000-0000-4000-8000-000000000001', 'Usuário Saldos Fase 4');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b4000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  linha record;
begin
  select * into linha
  from public.buscar_saldos_cancelados(p_busca => 'IE-FASE4', p_limit => 20);

  if linha.id is null
     or linha.tipo <> 'definitivo'
     or linha.pedido_origem_nome <> 'SALDO-FASE4/2'
     or linha.pedido_origem_cliente <> 'Cliente Saldos Fase 4'
     or linha.pedido_origem_ie <> 'IE-FASE4'
     or linha.pedido_origem_fazenda <> 'Fazenda Fase 4'
     or linha.pedido_origem_produto <> 'Produto Saldos Fase 4'
     or linha.total_registros <> 1
     or linha.total_quantidade <> 12.5 then
    raise exception 'Consulta de saldos cancelados incorreta: %', to_jsonb(linha);
  end if;

  if exists (
    select 1 from public.buscar_saldos_cancelados(p_busca => 'Não deve aparecer')
  ) then
    raise exception 'Operação Canc/Substitui apareceu em Saldos Cancelados.';
  end if;
end;
$$;

rollback;

