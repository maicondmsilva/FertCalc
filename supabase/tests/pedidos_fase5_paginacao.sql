begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b5000000-0000-4000-8000-000000000001',
  (select id from public.organizations where slug = 'fertcalc'),
  'pedidos-fase5@example.test', 'Pedidos Fase 5', '', 'master', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.clients (
  id, organization_id, code, name, state_registration, fazenda
) values
  ('c5000000-0000-4000-8000-000000000001',
   (select id from public.organizations where slug = 'fertcalc'),
   'FASE5-A', 'Cliente Alfa Fase 5', 'IE-ALFA-5', 'Fazenda Alfa'),
  ('c5000000-0000-4000-8000-000000000002',
   (select id from public.organizations where slug = 'fertcalc'),
   'FASE5-B', 'Cliente Beta Fase 5', 'IE-BETA-5', 'Fazenda Beta');

insert into public.pedidos_venda (
  id, organization_id, numero_pedido, barra_pedido, emitente, cliente_id,
  quantidade_real, quantidade_original, status, status_pedido, importado_por, criado_em
) values
  ('a5000000-0000-4000-8000-000000000001',
   (select id from public.organizations where slug = 'fertcalc'),
   'PAG-FASE5', 'PAG-FASE5/1', 1, 'c5000000-0000-4000-8000-000000000001',
   10, 10, 'pendente', 'ativo', 'b5000000-0000-4000-8000-000000000001', '2026-01-01'),
  ('a5000000-0000-4000-8000-000000000002',
   (select id from public.organizations where slug = 'fertcalc'),
   'PAG-FASE5', 'PAG-FASE5/2', 2, 'c5000000-0000-4000-8000-000000000002',
   20, 20, 'cancelado', 'cancelado', 'b5000000-0000-4000-8000-000000000001', '2026-01-02');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b5000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  linha record;
begin
  select * into linha
  from public.buscar_pedidos_venda_paginados(p_busca => 'IE-ALFA-5', p_limit => 25);

  if linha.pedido->>'id' <> 'a5000000-0000-4000-8000-000000000001'
     or linha.pedido->>'cliente_nome' <> 'Cliente Alfa Fase 5'
     or linha.pedido->>'cliente_ie' <> 'IE-ALFA-5'
     or linha.total_registros <> 1 then
    raise exception 'Pesquisa consolidada incorreta: %', to_jsonb(linha);
  end if;

  select * into linha
  from public.buscar_pedidos_venda_paginados(
    p_busca => 'PAG-FASE5', p_status => 'cancelado', p_offset => 0, p_limit => 1
  );

  if linha.pedido->>'barra_pedido' <> 'PAG-FASE5/2' or linha.total_registros <> 1 then
    raise exception 'Filtro de status ou paginação incorreto: %', to_jsonb(linha);
  end if;
end;
$$;

rollback;

