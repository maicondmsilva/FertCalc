-- Fase 6: agenda e movimenta execuções somente por operações transacionais.

drop trigger if exists trg_on_execucao_status_change on public.carregamento_execucoes;

create or replace function private.can_manage_loading_execution(
  p_organization_id uuid,
  p_filial_id uuid,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.app_users u
     where u.id = (select auth.uid())
       and u.ativo
       and u.organization_id = p_organization_id
       and (
         private.app_user_hierarchy((select auth.uid())) >= 80
         or coalesce(u.permissions @> '{"carregamento_logistica": true}'::jsonb, false)
       )
       and private.can_access_loading_branch(p_filial_id, p_owner_id, true)
  );
$$;

revoke all on function private.can_manage_loading_execution(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function private.agendar_execucao_carregamento(
  p_carregamento_id uuid,
  p_motorista_nome text,
  p_motorista_cpf text,
  p_placa_veiculo text,
  p_placa_carreta text,
  p_quantidade numeric,
  p_data_agendamento timestamptz,
  p_observacoes text
)
returns public.carregamento_execucoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carregamento public.carregamentos%rowtype;
  v_execucao public.carregamento_execucoes%rowtype;
  v_comprometido numeric(15,3);
  v_disponivel numeric(15,3);
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_carregamento
    from public.carregamentos
   where id = p_carregamento_id
   for update;

  if not found then
    raise exception 'loading not found' using errcode = 'P0002';
  end if;

  if not private.can_manage_loading_execution(
    v_carregamento.organization_id,
    v_carregamento.filial_id,
    v_carregamento.criado_por
  ) then
    raise exception 'not allowed to manage loading execution' using errcode = '42501';
  end if;

  if v_carregamento.status not in ('liberado_parcial', 'liberado_total', 'em_carregamento') then
    raise exception 'loading is not released for scheduling' using errcode = '23514';
  end if;

  if nullif(btrim(p_motorista_nome), '') is null
     or nullif(btrim(p_placa_veiculo), '') is null then
    raise exception 'driver and vehicle plate are required' using errcode = '23514';
  end if;

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'scheduled quantity must be positive' using errcode = '23514';
  end if;

  select coalesce(sum(
    case
      when status = 'concluido' then coalesce(quantidade_carregada, 0)
      when status in ('agendado', 'em_carregamento') then quantidade_agendada
      else 0
    end
  ), 0)
    into v_comprometido
    from public.carregamento_execucoes
   where carregamento_id = v_carregamento.id
     and organization_id = v_carregamento.organization_id;

  v_disponivel := greatest(v_carregamento.quantidade_liberada - v_comprometido, 0);
  if round(p_quantidade, 3) > v_disponivel then
    raise exception 'scheduled quantity exceeds released balance' using errcode = '23514';
  end if;

  insert into public.carregamento_execucoes (
    carregamento_id, motorista_nome, motorista_cpf, placa_veiculo, placa_carreta,
    quantidade_agendada, data_agendamento, observacoes, criado_por, status, organization_id
  ) values (
    v_carregamento.id, btrim(p_motorista_nome), nullif(btrim(p_motorista_cpf), ''),
    upper(btrim(p_placa_veiculo)), nullif(upper(btrim(p_placa_carreta)), ''),
    round(p_quantidade, 3), coalesce(p_data_agendamento, now()), nullif(btrim(p_observacoes), ''),
    (select auth.uid()), 'agendado', v_carregamento.organization_id
  ) returning * into v_execucao;

  insert into public.historico_carregamento (
    carregamento_id, status_anterior, status_novo, descricao, alterado_por, organization_id
  ) values (
    v_carregamento.id, v_carregamento.status, v_carregamento.status,
    format('Veículo %s agendado para %s ton.', v_execucao.placa_veiculo, v_execucao.quantidade_agendada),
    (select auth.uid()), v_carregamento.organization_id
  );

  return v_execucao;
end;
$$;

create or replace function private.transicionar_execucao_carregamento(
  p_execucao_id uuid,
  p_acao text,
  p_quantidade_carregada numeric default null,
  p_motivo text default null
)
returns public.carregamento_execucoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_execucao public.carregamento_execucoes%rowtype;
  v_carregamento public.carregamentos%rowtype;
  v_status_anterior text;
  v_total_carregado numeric(15,3);
  v_ativos integer;
  v_status_carregamento text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_execucao
    from public.carregamento_execucoes
   where id = p_execucao_id
   for update;
  if not found then
    raise exception 'execution not found' using errcode = 'P0002';
  end if;

  select * into v_carregamento
    from public.carregamentos
   where id = v_execucao.carregamento_id
     and organization_id = v_execucao.organization_id
   for update;

  if not private.can_manage_loading_execution(
    v_carregamento.organization_id,
    v_carregamento.filial_id,
    v_carregamento.criado_por
  ) then
    raise exception 'not allowed to manage loading execution' using errcode = '42501';
  end if;

  v_status_anterior := v_execucao.status;
  if p_acao = 'iniciar' then
    if v_execucao.status <> 'agendado' then
      raise exception 'only scheduled execution can be started' using errcode = '23514';
    end if;
    update public.carregamento_execucoes
       set status = 'em_carregamento', data_inicio_carregamento = now(), atualizado_em = now()
     where id = v_execucao.id returning * into v_execucao;
  elsif p_acao = 'concluir' then
    if v_execucao.status <> 'em_carregamento' then
      raise exception 'only started execution can be completed' using errcode = '23514';
    end if;
    if coalesce(p_quantidade_carregada, 0) <= 0
       or round(p_quantidade_carregada, 3) > v_execucao.quantidade_agendada then
      raise exception 'loaded quantity is invalid' using errcode = '23514';
    end if;
    update public.carregamento_execucoes
       set status = 'concluido', quantidade_carregada = round(p_quantidade_carregada, 3),
           data_conclusao_carregamento = now(), atualizado_em = now()
     where id = v_execucao.id returning * into v_execucao;
  elsif p_acao = 'cancelar' then
    if v_execucao.status not in ('agendado', 'em_carregamento') then
      raise exception 'execution cannot be cancelled' using errcode = '23514';
    end if;
    if nullif(btrim(p_motivo), '') is null then
      raise exception 'cancellation reason is required' using errcode = '23514';
    end if;
    update public.carregamento_execucoes
       set status = 'cancelado', motivo_cancelamento = btrim(p_motivo), atualizado_em = now()
     where id = v_execucao.id returning * into v_execucao;
  else
    raise exception 'invalid execution action' using errcode = '22023';
  end if;

  select coalesce(sum(quantidade_carregada), 0),
         count(*) filter (where status in ('agendado', 'em_carregamento'))
    into v_total_carregado, v_ativos
    from public.carregamento_execucoes
   where carregamento_id = v_carregamento.id
     and organization_id = v_carregamento.organization_id
     and status <> 'cancelado';

  v_status_carregamento := case
    when v_total_carregado >= v_carregamento.quantidade_liberada then 'carregado'
    when v_ativos > 0 then 'em_carregamento'
    when v_carregamento.quantidade_liberada >= v_carregamento.quantidade_total then 'liberado_total'
    else 'liberado_parcial'
  end;

  update public.carregamentos
     set status = v_status_carregamento,
         quantidade_carregada = v_total_carregado,
         data_real_carregamento = case when v_status_carregamento = 'carregado' then current_date else data_real_carregamento end,
         atualizado_em = now()
   where id = v_carregamento.id
     and organization_id = v_carregamento.organization_id;

  insert into public.historico_carregamento (
    carregamento_id, status_anterior, status_novo, descricao, alterado_por, organization_id
  ) values (
    v_carregamento.id, v_carregamento.status, v_status_carregamento,
    format('Execução do veículo %s: %s → %s.', v_execucao.placa_veiculo, v_status_anterior, v_execucao.status),
    (select auth.uid()), v_carregamento.organization_id
  );

  return v_execucao;
end;
$$;

revoke all on function private.agendar_execucao_carregamento(uuid,text,text,text,text,numeric,timestamptz,text) from public, anon;
revoke all on function private.transicionar_execucao_carregamento(uuid,text,numeric,text) from public, anon;
grant execute on function private.agendar_execucao_carregamento(uuid,text,text,text,text,numeric,timestamptz,text) to authenticated;
grant execute on function private.transicionar_execucao_carregamento(uuid,text,numeric,text) to authenticated;

create or replace function public.agendar_execucao_carregamento(
  p_carregamento_id uuid, p_motorista_nome text, p_motorista_cpf text,
  p_placa_veiculo text, p_placa_carreta text, p_quantidade numeric,
  p_data_agendamento timestamptz, p_observacoes text
)
returns public.carregamento_execucoes
language sql security invoker set search_path = ''
as $$ select private.agendar_execucao_carregamento(p_carregamento_id,p_motorista_nome,p_motorista_cpf,p_placa_veiculo,p_placa_carreta,p_quantidade,p_data_agendamento,p_observacoes); $$;

create or replace function public.transicionar_execucao_carregamento(
  p_execucao_id uuid, p_acao text, p_quantidade_carregada numeric default null, p_motivo text default null
)
returns public.carregamento_execucoes
language sql security invoker set search_path = ''
as $$ select private.transicionar_execucao_carregamento(p_execucao_id,p_acao,p_quantidade_carregada,p_motivo); $$;

revoke all on function public.agendar_execucao_carregamento(uuid,text,text,text,text,numeric,timestamptz,text) from public, anon;
revoke all on function public.transicionar_execucao_carregamento(uuid,text,numeric,text) from public, anon;
grant execute on function public.agendar_execucao_carregamento(uuid,text,text,text,text,numeric,timestamptz,text) to authenticated;
grant execute on function public.transicionar_execucao_carregamento(uuid,text,numeric,text) to authenticated;

revoke insert, update, delete on public.carregamento_execucoes from authenticated;
grant select on public.carregamento_execucoes to authenticated;

notify pgrst, 'reload schema';
