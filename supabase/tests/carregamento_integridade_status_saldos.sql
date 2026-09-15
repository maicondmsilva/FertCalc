-- Executar após as migrations. Fixtures e alterações são revertidas ao final.
begin;
insert into public.app_users (
  id,organization_id,email,name,password,role,permissions,managed_user_ids,filiais_permitidas,ativo
) values
('b8000000-0000-4000-8000-000000000001',(select id from public.organizations where slug='fertcalc'),
 'loading-integrity@example.test','Loading integrity','','master','{}','{}','{}',true),
('b8000000-0000-4000-8000-000000000002',(select id from public.organizations where slug='fertcalc'),
 'loading-denied@example.test','Loading denied','','vendedor','{}','{}','{}',true);

insert into public.carregamentos(
 id,organization_id,numero_carregamento,tipo_frete,status,
 quantidade_total,quantidade_liberada,quantidade_carregada,quantidade_cancelada,criado_por
) values
('a8000000-0000-4000-8000-000000000001',(select id from public.organizations where slug='fertcalc'),
 'TEST-INTEGRIDADE-1','FOB','liberado_parcial',100,20,0,0,'b8000000-0000-4000-8000-000000000001'),
('a8000000-0000-4000-8000-000000000002',(select id from public.organizations where slug='fertcalc'),
 'TEST-INTEGRIDADE-2','FOB','liberado_total',20,20,0,0,'b8000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare
 e public.carregamento_execucoes%rowtype;
 c public.carregamentos%rowtype;
 other public.carregamento_execucoes%rowtype;
begin
 e := public.agendar_execucao_carregamento('a8000000-0000-4000-8000-000000000001','Motorista',null,'TEST001',null,20,null,null);
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'liberado_parcial' or c.quantidade_carregada <> 0 then
   raise exception 'Agendamento alterou status ou carga física';
 end if;
 begin
   perform public.agendar_execucao_carregamento(c.id,'Motorista',null,'TEST002',null,1,null,null);
   raise exception 'Aceitou agendamento acima do liberado';
 exception when check_violation then null; end;
 begin
   perform public.agendar_execucao_carregamento(c.id,'Motorista',null,'TEST002',null,0.0001,null,null);
   raise exception 'Aceitou quantidade que arredonda para zero';
 exception when check_violation then null; end;
 begin
   perform public.cancelar_saldo_carregamento(c.id,81,'Teste');
   raise exception 'Cancelou volume reservado';
 exception when check_violation then null; end;
 perform public.transicionar_execucao_carregamento(e.id,'iniciar');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'em_carregamento' then raise exception 'Não iniciou carga'; end if;
 perform public.transicionar_execucao_carregamento(e.id,'concluir',18);
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'liberado_parcial' or c.quantidade_carregada <> 18 then
   raise exception 'Conclusão parcial encerrou toda a solicitação';
 end if;
 begin
   perform public.transicionar_execucao_carregamento(e.id,'concluir',18);
   raise exception 'Permitiu conclusão duplicada';
 exception when check_violation then null; end;
 other := public.agendar_execucao_carregamento(c.id,'Motorista',null,'TEST002',null,2,null,null);
 perform public.transicionar_execucao_carregamento(other.id,'cancelar',null,'Teste');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'liberado_parcial' or c.quantidade_carregada <> 18 then
   raise exception 'Cancelamento do veículo alterou carga realizada';
 end if;
 perform public.cancelar_saldo_carregamento(c.id,80,'Cancelar volume não liberado');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.quantidade_total <> 100 or c.quantidade_liberada <> 20 or c.quantidade_cancelada <> 80 then
   raise exception 'Cancelamento alterou base original ou descontou liberação duas vezes';
 end if;
 other := public.agendar_execucao_carregamento(c.id,'Motorista',null,'TEST003',null,2,null,null);
 perform public.transicionar_execucao_carregamento(other.id,'iniciar');
 perform public.transicionar_execucao_carregamento(other.id,'concluir',2);
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'carregado' or c.quantidade_carregada <> 20 or c.data_real_carregamento is null then
   raise exception 'Não concluiu após carga física de todo o saldo líquido';
 end if;
 -- O total agendado também não pode concluir uma liberação integral.
 e := public.agendar_execucao_carregamento('a8000000-0000-4000-8000-000000000002','Motorista',null,'TEST004',null,20,null,null);
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'liberado_total' then raise exception 'Reserva integral concluiu a carga'; end if;
 perform public.transicionar_execucao_carregamento(e.id,'cancelar',null,'Teste');
 perform public.cancelar_saldo_carregamento(c.id,5,'Reduzir volume já liberado');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.quantidade_liberada <> 15 then raise exception 'Liberação excedeu saldo líquido após cancelamento'; end if;
 begin
   update public.carregamentos set status='em_carregamento' where id=c.id;
   raise exception 'Cliente antigo iniciou status diretamente';
 exception when check_violation then null; end;
 perform public.cancelar_saldo_carregamento(c.id,15,'Cancelar restante');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.status <> 'cancelado' or c.quantidade_carregada <> 0 then
   raise exception 'Cancelamento total virou carga física';
 end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$
begin
 begin
   perform public.cancelar_saldo_carregamento('a8000000-0000-4000-8000-000000000001',1,'Sem permissão');
   raise exception 'Usuário sem permissão cancelou saldo';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Liberação após cancelamento considera apenas a quantidade líquida.
insert into public.carregamentos(
 id,organization_id,numero_carregamento,tipo_frete,status,quantidade_total,
 quantidade_liberada,quantidade_carregada,quantidade_cancelada,criado_por
) values (
 'a8000000-0000-4000-8000-000000000003',(select id from public.organizations where slug='fertcalc'),
 'TEST-INTEGRIDADE-3','FOB','liberado_parcial',100,20,0,10,'b8000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare c public.carregamentos%rowtype; e public.carregamento_execucoes%rowtype;
begin
 e := public.agendar_execucao_carregamento('a8000000-0000-4000-8000-000000000003','Motorista',null,'TEST005',null,20,null,null);
 perform public.transicionar_execucao_carregamento(e.id,'iniciar');
 perform public.liberar_carregamento(e.carregamento_id,'total');
 select * into c from public.carregamentos where id=e.carregamento_id;
 if c.quantidade_liberada<>90 or c.status<>'em_carregamento' then
   raise exception 'Nova liberação ignorou cancelamento ou interrompeu carga em andamento';
 end if;
end;
$$;
reset role;
do $$
begin
 if exists(select 1 from pg_trigger where tgrelid='public.carregamento_execucoes'::regclass
   and tgname in ('trg_execucao_after_change','trg_execucao_status_change','trg_on_execucao_status_change')) then
   raise exception 'Gatilho conflitante permanece ativo';
 end if;
end;
$$;
rollback;
