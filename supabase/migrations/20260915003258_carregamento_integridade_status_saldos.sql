-- Integridade operacional: reserva não é carga física.
-- As rotinas transacionais são a única fonte de movimentação das execuções.
drop trigger if exists trg_on_execucao_status_change on public.carregamento_execucoes;
drop trigger if exists trg_execucao_status_change on public.carregamento_execucoes;
drop trigger if exists trg_execucao_after_change on public.carregamento_execucoes;

create or replace function private.loading_status(
  p_status text, p_total numeric, p_released numeric, p_cancelled numeric,
  p_loaded numeric, p_started integer
) returns text language sql immutable set search_path = ''
as $$
  select case
    when p_status = 'cancelado' or p_cancelled >= p_total then 'cancelado'
    when p_loaded > 0 and p_loaded >= p_total - p_cancelled then 'carregado'
    when p_started > 0 then 'em_carregamento'
    when p_released > 0 and p_released >= p_total - p_cancelled then 'liberado_total'
    when p_released > 0 then 'liberado_parcial'
    when p_status in ('carregado', 'em_carregamento', 'liberado_total', 'liberado_parcial') then 'aguardando_liberacao'
    else p_status
  end;
$$;
revoke all on function private.loading_status(text,numeric,numeric,numeric,numeric,integer) from public, anon, authenticated;

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

  if p_quantidade is null or p_quantidade::text in ('NaN', 'Infinity', '-Infinity') or round(p_quantidade, 3) <= 0 then
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

  v_disponivel := greatest(least(v_carregamento.quantidade_liberada, v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) - v_comprometido, 0);
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
   where id = p_execucao_id;
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

  -- Ordem de bloqueio única: solicitação, depois execução.
  select * into v_execucao from public.carregamento_execucoes
   where id = p_execucao_id and carregamento_id = v_carregamento.id for update;
  if not found then
    raise exception 'execution not found' using errcode = 'P0002';
  end if;
  if v_carregamento.status in ('cancelado', 'carregado') then
    raise exception 'loading is already closed' using errcode = '23514';
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
    if p_quantidade_carregada is null
       or p_quantidade_carregada::text in ('NaN', 'Infinity', '-Infinity')
       or round(p_quantidade_carregada, 3) <= 0
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

  select coalesce(sum(quantidade_carregada) filter (where status = 'concluido'), 0),
         count(*) filter (where status = 'em_carregamento')
    into v_total_carregado, v_ativos
    from public.carregamento_execucoes
   where carregamento_id = v_carregamento.id
     and organization_id = v_carregamento.organization_id
     and status <> 'cancelado';

  v_status_carregamento := private.loading_status(
    v_carregamento.status, v_carregamento.quantidade_total,
    v_carregamento.quantidade_liberada, v_carregamento.quantidade_cancelada,
    v_total_carregado, v_ativos
  );

  update public.carregamentos
     set status = v_status_carregamento,
         quantidade_carregada = v_total_carregado,
         data_real_carregamento = case when v_status_carregamento = 'carregado' then (now() at time zone 'America/Sao_Paulo')::date else null end,
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


create or replace function private.liberar_carregamento(
  p_carregamento_id uuid,
  p_tipo text,
  p_quantidade numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_users%rowtype;
  v_carregamento public.carregamentos%rowtype;
  v_quantidade_adicional numeric(15,3);
  v_quantidade_final numeric(15,3);
  v_status_novo text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_tipo not in ('total', 'parcial') then
    raise exception 'invalid release type' using errcode = '22023';
  end if;

  select * into v_carregamento
    from public.carregamentos
   where id = p_carregamento_id
   for update;

  if not found then
    raise exception 'loading not found' using errcode = 'P0002';
  end if;

  select * into v_user
    from public.app_users
   where id = (select auth.uid())
     and organization_id = v_carregamento.organization_id
     and ativo;

  if not found
     or not (
       private.app_user_hierarchy((select auth.uid())) >= 80
       or coalesce(v_user.permissions @> '{"carregamento_liberar": true}'::jsonb, false)
     )
     or not private.can_access_loading_branch(
       v_carregamento.filial_id,
       v_carregamento.criado_por,
       true
     ) then
    raise exception 'not allowed to release loading' using errcode = '42501';
  end if;

  if v_carregamento.status not in ('aguardando_liberacao', 'liberado_parcial', 'em_carregamento') then
    raise exception 'loading is not awaiting release' using errcode = '23514';
  end if;

  if v_carregamento.tipo_frete = 'CIF' and v_carregamento.transportadora_id is null then
    raise exception 'carrier is required before release' using errcode = '23514';
  end if;

  if (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) <= 0
     or v_carregamento.quantidade_liberada < 0
     or v_carregamento.quantidade_liberada >= (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) then
    raise exception 'loading has no quantity available for release' using errcode = '23514';
  end if;

  v_quantidade_adicional := case
    when p_tipo = 'total' then
      (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) - v_carregamento.quantidade_liberada
    else round(coalesce(p_quantidade, 0), 3)
  end;

  if v_quantidade_adicional <= 0
     or v_quantidade_adicional >
       ((v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) - v_carregamento.quantidade_liberada) then
    raise exception 'release quantity exceeds available balance' using errcode = '23514';
  end if;

  v_quantidade_final := v_carregamento.quantidade_liberada + v_quantidade_adicional;
  v_status_novo := case
    when v_carregamento.status = 'em_carregamento' then 'em_carregamento'
    when v_quantidade_final = (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) then 'liberado_total'
    else 'liberado_parcial'
  end;

  update public.carregamentos
     set tipo_liberacao = case when v_quantidade_final = (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) then 'total' else 'parcial' end,
         quantidade_liberada = v_quantidade_final,
         saldo_disponivel = greatest(quantidade_total - quantidade_cancelada - v_quantidade_final, 0),
         status = v_status_novo,
         data_liberacao = now(),
         liberado_por = (select auth.uid()),
         atualizado_em = now()
   where id = v_carregamento.id
     and organization_id = v_carregamento.organization_id;

  insert into public.historico_carregamento (
    carregamento_id,
    status_anterior,
    status_novo,
    descricao,
    alterado_por,
    organization_id
  ) values (
    v_carregamento.id,
    v_carregamento.status,
    v_status_novo,
    format(
      'Liberação de %s ton confirmada. Total liberado: %s de %s ton.',
      v_quantidade_adicional,
      v_quantidade_final,
      (v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada)
    ),
    (select auth.uid()),
    v_carregamento.organization_id
  );

  return jsonb_build_object(
    'carregamento_id', v_carregamento.id,
    'status', v_status_novo,
    'quantidade_adicional', v_quantidade_adicional,
    'quantidade_liberada', v_quantidade_final,
    'saldo_liberacao', greatest((v_carregamento.quantidade_total - v_carregamento.quantidade_cancelada) - v_quantidade_final, 0)
  );
end;
$$;


-- Cancela apenas volume livre; a quantidade enviada é conferida sob bloqueio.
-- Não reduz quantidade_total: preserva a base original e evita dupla devolução.
create or replace function private.cancelar_saldo_carregamento(
  p_carregamento_id uuid, p_quantidade numeric, p_motivo text
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.carregamentos%rowtype;
  v_loaded numeric(15,3);
  v_reserved numeric(15,3);
  v_started integer;
  v_cancelled numeric(15,3);
  v_released numeric(15,3);
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into c from public.carregamentos where id = p_carregamento_id for update;
  if not found then raise exception 'loading not found' using errcode = 'P0002'; end if;
  if not private.can_manage_loading_execution(c.organization_id, c.filial_id, c.criado_por)
     and not exists (
       select 1 from public.app_users u
        where u.id=(select auth.uid()) and u.ativo and u.organization_id=c.organization_id
          and private.can_access_loading_branch(c.filial_id,c.criado_por,true)
          and (
            coalesce(u.permissions @> '{"carregamento_aprovar":true}'::jsonb,false)
            or (u.id=c.criado_por and c.status='aguardando_liberacao' and c.quantidade_liberada=0)
          )
     ) then
    raise exception 'not allowed to cancel loading balance' using errcode = '42501';
  end if;
  if c.status in ('cancelado','carregado') then
    raise exception 'loading is already closed' using errcode = '23514';
  end if;
  if p_quantidade is null or p_quantidade::text in ('NaN','Infinity','-Infinity')
     or round(p_quantidade,3) <= 0 or nullif(btrim(p_motivo),'') is null then
    raise exception 'positive quantity and cancellation reason required' using errcode = '23514';
  end if;
  select coalesce(sum(quantidade_carregada) filter (where status='concluido'),0),
         coalesce(sum(quantidade_agendada) filter (where status in ('agendado','em_carregamento')),0),
         count(*) filter (where status='em_carregamento')
    into v_loaded,v_reserved,v_started from public.carregamento_execucoes
   where carregamento_id=c.id and organization_id=c.organization_id;
  -- Protege também carregamentos históricos com carga informada no cabeçalho.
  v_loaded := greatest(v_loaded, coalesce(c.quantidade_carregada,0));
  if round(p_quantidade,3) > c.quantidade_total - c.quantidade_cancelada - v_loaded - v_reserved then
    raise exception 'cancellation exceeds unreserved balance; refresh loading' using errcode = '23514';
  end if;
  v_cancelled := c.quantidade_cancelada + round(p_quantidade,3);
  v_released := least(c.quantidade_liberada, c.quantidade_total-v_cancelled);
  v_status := private.loading_status(c.status,c.quantidade_total,v_released,v_cancelled,v_loaded,v_started);
  update public.carregamentos set
    quantidade_cancelada=v_cancelled, quantidade_liberada=v_released,
    quantidade_carregada=v_loaded, motivo_cancelamento_saldo=btrim(p_motivo),
    cancelado_por_id=(select auth.uid()),
    cancelado_por_nome=(select name from public.app_users where id=(select auth.uid())),
    cancelado_em=now(),
    obs_cancelamento_parcial=case when v_cancelled<c.quantidade_total
      then format('Cancelamento parcial de %s ton: %s',round(p_quantidade,3),btrim(p_motivo))
      else obs_cancelamento_parcial end,
    status=v_status, atualizado_em=now(),
    saldo_disponivel=greatest(quantidade_total-v_cancelled-v_released,0),
    data_real_carregamento=case when v_status='carregado'
      then coalesce(data_real_carregamento,(now() at time zone 'America/Sao_Paulo')::date)
      else data_real_carregamento end
  where id=c.id;
  perform public.write_audit_log_entry(
    'carregamentos',c.id::text,'UPDATE',to_jsonb(c),
    (select to_jsonb(updated) from public.carregamentos updated where updated.id=c.id),
    array['quantidade_cancelada','quantidade_liberada','status'],
    btrim(p_motivo)
  );
  insert into public.historico_carregamento(
    carregamento_id,status_anterior,status_novo,descricao,alterado_por,organization_id
  ) values(c.id,c.status,v_status,
    format('Cancelamento de %s ton livres. Motivo: %s',round(p_quantidade,3),btrim(p_motivo)),
    (select auth.uid()),c.organization_id);
  -- O gatilho atualizar_saldo_pedido sincroniza o pedido na mesma transação.
end;
$$;
revoke all on function private.cancelar_saldo_carregamento(uuid,numeric,text) from public,anon;
grant execute on function private.cancelar_saldo_carregamento(uuid,numeric,text) to authenticated;
create or replace function public.cancelar_saldo_carregamento(
  p_carregamento_id uuid,p_quantidade numeric,p_motivo text
) returns void language sql security invoker set search_path = ''
as $$ select private.cancelar_saldo_carregamento(p_carregamento_id,p_quantidade,p_motivo); $$;
revoke all on function public.cancelar_saldo_carregamento(uuid,numeric,text) from public,anon;
grant execute on function public.cancelar_saldo_carregamento(uuid,numeric,text) to authenticated;

-- Impede que clientes antigos contornem as operações de saldo e execução.
create or replace function private.guard_loading_integrity()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.quantidade_total <= 0 or new.quantidade_cancelada < 0
     or new.quantidade_cancelada > new.quantidade_total
     or new.quantidade_liberada < 0
     or new.quantidade_liberada > new.quantidade_total-new.quantidade_cancelada
     or new.quantidade_carregada < 0 or new.quantidade_carregada > new.quantidade_liberada then
    raise exception 'invalid loading quantities' using errcode = '23514';
  end if;
  if current_user in ('authenticated','anon') and (
    new.quantidade_cancelada is distinct from old.quantidade_cancelada
    or new.quantidade_liberada is distinct from old.quantidade_liberada
    or new.quantidade_carregada is distinct from old.quantidade_carregada
    or (new.status is distinct from old.status and new.status in ('carregado','em_carregamento','cancelado'))
    or (new.quantidade_total is distinct from old.quantidade_total and
        (old.quantidade_liberada > 0 or exists(
          select 1 from public.carregamento_execucoes e where e.carregamento_id=old.id
        )))
  ) then
    raise exception 'use loading operations to change quantities or execution status' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_loading_integrity() from public,anon,authenticated;
create trigger guard_loading_integrity before update of
  status,quantidade_total,quantidade_liberada,quantidade_carregada,quantidade_cancelada
  on public.carregamentos for each row execute function private.guard_loading_integrity();

-- Não inferir carga física de status histórico sem execuções.
-- Registros antigos sem evidência são listados no relatório de reconciliação.
notify pgrst, 'reload schema';
