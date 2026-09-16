-- Etapa 2: gravação única, números atribuídos no banco e auditoria de exclusão.
create table private.loading_number_counters(
  prefix text primary key,
  last_value bigint not null check(last_value>0)
);
alter table private.loading_number_counters enable row level security;
revoke all on private.loading_number_counters from public,anon,authenticated;

-- Lê sufixos numéricos como números, inclusive após 9999; ignora os legados alfanuméricos.
insert into private.loading_number_counters(prefix,last_value)
select match[1],max(match[2]::bigint)
from (
  select regexp_match(numero_carregamento,'^(CAR-[0-9]{4}-)([0-9]+)$') as match from public.carregamentos
  union all
  select regexp_match(numero_cotacao,'^(COT-[0-9]{4}-)([0-9]+)$') from public.cotacoes_solicitadas
) numbers where match is not null and match[2]::numeric>0
group by match[1];

create or replace function private.next_loading_number(p_kind text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_prefix text; v_next bigint;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.app_users where id=(select auth.uid()) and ativo
  ) then raise exception 'Sessão expirada.' using errcode='42501'; end if;
  if p_kind not in ('CAR','COT') then raise exception 'Tipo de numeração inválido.'; end if;
  v_prefix:=p_kind||'-'||to_char(now() at time zone 'America/Sao_Paulo','YYYY')||'-';
  insert into private.loading_number_counters(prefix,last_value) values(v_prefix,1)
  on conflict(prefix) do update set last_value=private.loading_number_counters.last_value+1
  returning last_value into v_next;
  return v_prefix||lpad(v_next::text,greatest(4,length(v_next::text)),'0');
end;
$$;
revoke all on function private.next_loading_number(text) from public,anon,authenticated;

create or replace function private.assign_loading_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_number text; v_match text[];
begin
  -- Importações administrativas preservam números explícitos e avançam o contador.
  if (select auth.uid()) is null then
    if tg_table_name='carregamentos' then v_number:=new.numero_carregamento;
    else v_number:=new.numero_cotacao; end if;
    if nullif(v_number,'') is null then raise exception 'Sessão expirada.' using errcode='42501'; end if;
    v_match:=regexp_match(v_number,'^((?:CAR|COT)-[0-9]{4}-)([0-9]+)$');
    if v_match is not null and v_match[2]::numeric>0 then
      insert into private.loading_number_counters(prefix,last_value) values(v_match[1],v_match[2]::bigint)
      on conflict(prefix) do update set last_value=greatest(private.loading_number_counters.last_value,excluded.last_value);
    end if;
    return new;
  end if;
  if tg_table_name='carregamentos' then new.numero_carregamento:=private.next_loading_number('CAR');
  else new.numero_cotacao:=private.next_loading_number('COT'); end if;
  return new;
end;
$$;
revoke all on function private.assign_loading_number() from public,anon,authenticated;
create trigger assign_loading_number before insert on public.carregamentos
for each row execute function private.assign_loading_number();
create trigger assign_loading_number before insert on public.cotacoes_solicitadas
for each row execute function private.assign_loading_number();

-- O gerador legado apenas sugeria um número e era vulnerável a concorrência.
-- Novas cotações recebem o número exclusivamente no INSERT.
revoke all on function public.fn_proximo_numero_cotacao() from public,anon,authenticated;

alter table public.carregamentos add column creation_request_id uuid, add column creation_request jsonb;
create unique index carregamentos_creation_request_unique
on public.carregamentos(organization_id,criado_por,creation_request_id)
where creation_request_id is not null;

create or replace function public.criar_carregamento(
  p_payload jsonb,p_itens jsonb,p_request_id uuid
) returns public.carregamentos language plpgsql security invoker set search_path = ''
as $$
declare
  u public.app_users%rowtype;
  c public.carregamentos%rowtype;
  pedido public.pedidos_venda%rowtype;
  v_total numeric(15,3);
  v_soma numeric(15,3);
  v_order uuid;
  v_branch uuid;
  v_location uuid;
  v_pricing uuid;
  v_request jsonb;
begin
  select * into u from public.app_users where id=(select auth.uid()) and ativo;
  if not found then raise exception 'Sessão expirada.' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception 'Dados da solicitação inválidos.' using errcode='23514';
  end if;
  v_request:=jsonb_build_object('payload',p_payload,'itens',p_itens);
  -- Serializa tentativas do mesmo formulário e recupera gravações cuja resposta foi perdida.
  perform pg_advisory_xact_lock(hashtextextended(u.id::text||p_request_id::text,0));
  select * into c from public.carregamentos
   where organization_id=u.organization_id and criado_por=u.id and creation_request_id=p_request_id;
  if found then
    if c.creation_request is distinct from v_request then
      raise exception 'Esta solicitação já foi salva com outros dados. Atualize a página.' using errcode='23514';
    end if;
    return c;
  end if;
  v_total:=(p_payload->>'quantidade_total')::numeric;
  if v_total is null or v_total::text in ('NaN','Infinity','-Infinity') or v_total<=0
    or coalesce(p_payload->>'tipo_frete','') not in ('CIF','FOB') then
    raise exception 'Quantidade e tipo de frete inválidos.' using errcode='23514';
  end if;
  v_order:=nullif(p_payload->>'pedido_venda_id','')::uuid;
  v_branch:=nullif(p_payload->>'filial_id','')::uuid;
  v_location:=nullif(p_payload->>'local_carregamento_id','')::uuid;
  v_pricing:=nullif(p_payload->>'pedido_precificacao_id','')::uuid;

  -- Todas as consultas/escritas respeitam as políticas RLS do usuário chamador.
  if v_branch is not null and not exists(select 1 from public.branches where id=v_branch and organization_id=u.organization_id) then
    raise exception 'Filial indisponível.' using errcode='42501';
  end if;
  if v_location is not null and not exists(
    select 1 from public.locais_carregamento where id=v_location and organization_id=u.organization_id
      and (v_branch is null or filial_id=v_branch)
  ) then raise exception 'Local de carregamento incompatível com a filial.' using errcode='23514'; end if;
  if v_pricing is not null and not exists(select 1 from public.pricing_records where id=v_pricing and organization_id=u.organization_id) then
    raise exception 'Precificação indisponível.' using errcode='42501';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_itens) i
     where jsonb_typeof(i) is distinct from 'object' or nullif(btrim(i->>'produto_nome'),'') is null
       or i->>'quantidade_ton' is null or (i->>'quantidade_ton')::numeric::text in ('NaN','Infinity','-Infinity')
       or round((i->>'quantidade_ton')::numeric,3)<=0
  ) then raise exception 'Todos os produtos precisam de nome e quantidade positiva.' using errcode='23514'; end if;
  select coalesce(sum(round((i->>'quantidade_ton')::numeric,3)),0) into v_soma from jsonb_array_elements(p_itens) i;
  if jsonb_array_length(p_itens)>0 and v_soma<>v_total then
    raise exception 'A soma dos produtos não coincide com o total.' using errcode='23514';
  end if;
  if v_order is not null then
    -- Solicitações concorrentes do mesmo pedido conferem saldo após o bloqueio.
    select * into pedido from public.pedidos_venda
     where id=v_order and organization_id=u.organization_id for update;
    if not found then raise exception 'Pedido indisponível para solicitar carga.' using errcode='42501'; end if;
    if pedido.status in ('cancelado','concluido') or pedido.status_pedido in ('cancelado','concluido') then
      raise exception 'Pedido encerrado.' using errcode='23514';
    end if;
    if jsonb_array_length(p_itens)=0 then raise exception 'Selecione os produtos do pedido.' using errcode='23514'; end if;
    if v_total>coalesce(pedido.saldo_disponivel,0) then raise exception 'Saldo insuficiente no pedido.' using errcode='23514'; end if;
    perform item.id from public.pedidos_venda_itens item
     where item.pedido_venda_id=v_order order by item.id for update;
    if exists(
      select 1 from jsonb_array_elements(p_itens) i
      left join public.pedidos_venda_itens item on item.id=nullif(i->>'pedido_venda_item_id','')::uuid
        and item.pedido_venda_id=v_order and item.organization_id=u.organization_id
      where item.id is null
    ) then raise exception 'Produto não pertence ao pedido informado.' using errcode='23514'; end if;
    if exists(
      select 1 from jsonb_array_elements(p_itens) i
      join public.pedidos_venda_itens item on item.id=(i->>'pedido_venda_item_id')::uuid
      group by item.id,item.saldo_disponivel
      having sum(round((i->>'quantidade_ton')::numeric,3))>coalesce(item.saldo_disponivel,0)
    ) then raise exception 'Saldo insuficiente para um dos produtos.' using errcode='23514'; end if;
  elsif exists(select 1 from jsonb_array_elements(p_itens) i where nullif(i->>'pedido_venda_item_id','') is not null) then
    raise exception 'Informe o pedido dos produtos selecionados.' using errcode='23514';
  end if;

  insert into public.carregamentos(
    organization_id,criado_por,numero_carregamento,tipo_frete,status,quantidade_total,
    quantidade_liberada,quantidade_carregada,filial_id,local_carregamento_id,
    pedido_precificacao_id,pedido_venda_id,pedido_venda_numero,data_prevista_carregamento,
    observacoes,valor_frete,creation_request_id,creation_request
  ) values(
    u.organization_id,u.id,'',p_payload->>'tipo_frete','aguardando_liberacao',v_total,
    0,0,v_branch,v_location,v_pricing,v_order,p_payload->>'pedido_venda_numero',
    nullif(p_payload->>'data_prevista_carregamento','')::date,p_payload->>'observacoes',
    nullif(p_payload->>'valor_frete','')::numeric,p_request_id,v_request
  ) returning * into c;

  insert into public.carregamento_itens(
    organization_id,carregamento_id,pedido_venda_item_id,produto_nome,quantidade_ton,embalagem
  ) select u.organization_id,c.id,nullif(i->>'pedido_venda_item_id','')::uuid,
    btrim(i->>'produto_nome'),round((i->>'quantidade_ton')::numeric,3),i->>'embalagem'
    from jsonb_array_elements(p_itens) i;
  perform public.write_audit_log_entry('carregamentos',c.id::text,'INSERT',null,to_jsonb(c),null,'Criação da solicitação e produtos.');
  return c;
end;
$$;
revoke all on function public.criar_carregamento(jsonb,jsonb,uuid) from public,anon;
grant execute on function public.criar_carregamento(jsonb,jsonb,uuid) to authenticated;

create or replace function private.excluir_carregamento(p_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.carregamentos%rowtype; u public.app_users%rowtype; v_deleted uuid;
begin
  if nullif(btrim(p_motivo),'') is null then raise exception 'Informe o motivo da exclusão.' using errcode='23514'; end if;
  select * into c from public.carregamentos where id=p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode='P0002'; end if;
  select * into u from public.app_users
   where id=(select auth.uid()) and ativo and organization_id=c.organization_id;
  if not found or not private.can_access_loading_branch(c.filial_id,c.criado_por,false)
     or not (private.app_user_hierarchy(u.id)>=80
       or (u.id=c.criado_por and c.status='aguardando_liberacao')) then
    raise exception 'Sem permissão para excluir esta solicitação.' using errcode='42501';
  end if;
  if c.quantidade_liberada>0 or c.quantidade_carregada>0 or exists(
    select 1 from public.carregamento_execucoes where carregamento_id=c.id
  ) then raise exception 'Solicitação movimentada não pode ser excluída. Utilize cancelamento do saldo.' using errcode='23514'; end if;
  delete from public.carregamentos where id=c.id returning id into v_deleted;
  if v_deleted is null then raise exception 'Sem permissão para excluir.' using errcode='42501'; end if;
  perform public.write_audit_log_entry('carregamentos',c.id::text,'DELETE',to_jsonb(c),null,null,p_motivo);
end;
$$;
revoke all on function private.excluir_carregamento(uuid,text) from public,anon;
grant execute on function private.excluir_carregamento(uuid,text) to authenticated;
create or replace function public.excluir_carregamento(p_id uuid,p_motivo text)
returns void language sql security invoker set search_path = ''
as $$ select private.excluir_carregamento(p_id,p_motivo); $$;
revoke all on function public.excluir_carregamento(uuid,text) from public,anon;
grant execute on function public.excluir_carregamento(uuid,text) to authenticated;
notify pgrst,'reload schema';
