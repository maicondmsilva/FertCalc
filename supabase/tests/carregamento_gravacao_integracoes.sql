begin;
insert into public.app_users(id,organization_id,email,name,password,role,permissions,ativo)
values
 ('b9000000-0000-4000-8000-000000000001','09000000-0000-4000-8000-000000000001','owner@test','Owner','','master','{}',true),
 ('b9000000-0000-4000-8000-000000000002','09000000-0000-4000-8000-000000000001','other@test','Other','','vendedor','{}',true);
insert into public.pedidos_venda(id,organization_id,status,status_pedido,saldo_disponivel)
values('a9000000-0000-4000-8000-000000000001','09000000-0000-4000-8000-000000000001','pendente','ativo',100);
insert into public.pedidos_venda_itens(id,organization_id,pedido_venda_id,produto_nome,quantidade_ton,saldo_disponivel)
values('a9000000-0000-4000-8000-000000000002','09000000-0000-4000-8000-000000000001',
 'a9000000-0000-4000-8000-000000000001','Produto teste',100,100);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare
 c public.carregamentos%rowtype;
 repeated public.carregamentos%rowtype;
 second public.carregamentos%rowtype;
 request_id uuid := 'a9000000-0000-4000-8000-000000000010';
 payload jsonb := jsonb_build_object(
   'tipo_frete','FOB','quantidade_total',30,
   'pedido_venda_id','a9000000-0000-4000-8000-000000000001',
   'pedido_venda_numero','TEST-1','status','carregado',
   'organization_id','ffffffff-ffff-4fff-8fff-ffffffffffff'
 );
 itens jsonb := jsonb_build_array(jsonb_build_object(
   'pedido_venda_item_id','a9000000-0000-4000-8000-000000000002',
   'produto_nome','Produto teste','quantidade_ton',30
 ));
begin
 c:=public.criar_carregamento(payload,itens,request_id);
 if c.status<>'aguardando_liberacao' or c.organization_id<>'09000000-0000-4000-8000-000000000001'
    or c.numero_carregamento !~ '^CAR-[0-9]{4}-[0-9]{4,}$' then
   raise exception 'Cabeçalho gerado com dados controlados pelo cliente';
 end if;
 repeated:=public.criar_carregamento(payload,itens,request_id);
 if repeated.id<>c.id or (select count(*) from public.carregamentos where creation_request_id=request_id)<>1 then
   raise exception 'Repetição da requisição criou duplicidade';
 end if;
 begin
   perform public.criar_carregamento(payload||'{"quantidade_total":31}'::jsonb,itens,request_id);
   raise exception 'Reutilizou a chave com dados diferentes';
 exception when check_violation then null; end;
 begin
   perform public.criar_carregamento(payload||'{"quantidade_total":31}'::jsonb,itens,
     'a9000000-0000-4000-8000-000000000011');
   raise exception 'Gravou cabeçalho apesar da soma inválida';
 exception when check_violation then null; end;
 if exists(select 1 from public.carregamentos where creation_request_id='a9000000-0000-4000-8000-000000000011') then
   raise exception 'Sobrou cabeçalho órfão';
 end if;
 second:=public.criar_carregamento(payload,itens,'a9000000-0000-4000-8000-000000000012');
 if second.numero_carregamento=c.numero_carregamento then raise exception 'Número de carga duplicado'; end if;
 if (substring(second.numero_carregamento from '[0-9]+$'))::bigint
    <=(substring(c.numero_carregamento from '[0-9]+$'))::bigint then
   raise exception 'Sequência de carga não avançou';
 end if;
 -- Criador pode excluir enquanto ainda não houve liberação ou execução.
 perform public.excluir_carregamento(second.id,'Solicitação criada para teste');
 if exists(select 1 from public.carregamentos where id=second.id)
    or not exists(select 1 from public.audit_log where registro_id=second.id::text and acao='DELETE') then
   raise exception 'Exclusão e auditoria não foram atômicas';
 end if;
 -- Usa o fluxo oficial para simular uma solicitação que já entrou em operação.
 perform public.liberar_carregamento(c.id,'parcial',1);
 begin
   perform public.excluir_carregamento(c.id,'Não deve excluir');
   raise exception 'Excluiu uma solicitação movimentada';
 exception when check_violation then null; end;
end;
$$;

insert into public.cotacoes_solicitadas(organization_id,numero_cotacao)
values('09000000-0000-4000-8000-000000000001','IGNORADO'),
      ('09000000-0000-4000-8000-000000000001','IGNORADO');
do $$
begin
 if (select count(distinct numero_cotacao) from public.cotacoes_solicitadas)<>2
   or exists(select 1 from public.cotacoes_solicitadas where numero_cotacao!~'^COT-[0-9]{4}-[0-9]{4,}$') then
   raise exception 'Numeração de cotação não foi atribuída pelo banco';
 end if;
end;
$$;

select set_config('request.jwt.claims','{"sub":"b9000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$
begin
 begin
   perform public.excluir_carregamento(
     (select id from public.carregamentos where creation_request_id='a9000000-0000-4000-8000-000000000010'),
     'Sem permissão'
   );
   raise exception 'Outro usuário excluiu solicitação';
 exception when insufficient_privilege then null; end;
end;
$$;
rollback;
