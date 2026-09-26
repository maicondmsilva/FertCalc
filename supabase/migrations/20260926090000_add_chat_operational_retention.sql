-- Fase 4 do chat: operação observável e retenção controlada.
-- Mensagens permanecem fora da limpeza automática até existir aprovação formal.

create index if not exists chat_operation_metrics_retention_idx
  on private.chat_operation_metrics (created_at, id);

create or replace function private.preview_chat_retention()
returns table (
  dataset text,
  retention_days integer,
  enabled boolean,
  candidate_count bigint,
  oldest_candidate_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    policy.dataset,
    policy.retention_days,
    policy.enabled,
    case policy.dataset
      when 'operation_metrics' then (
        select count(*)
        from private.chat_operation_metrics metric
        where metric.created_at < now() - make_interval(days => policy.retention_days)
      )
      when 'messages' then (
        select count(*)
        from public.chat_messages message
        where message.created_at < now() - make_interval(days => policy.retention_days)
      )
      else 0
    end as candidate_count,
    case policy.dataset
      when 'operation_metrics' then (
        select min(metric.created_at)
        from private.chat_operation_metrics metric
        where metric.created_at < now() - make_interval(days => policy.retention_days)
      )
      when 'messages' then (
        select min(message.created_at)
        from public.chat_messages message
        where message.created_at < now() - make_interval(days => policy.retention_days)
      )
      else null
    end as oldest_candidate_at
  from private.chat_retention_policies policy
  order by policy.dataset;
$$;

create or replace function private.apply_chat_metrics_retention(
  p_batch_size integer default 1000
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  retention_window integer;
  deleted_count integer := 0;
begin
  if p_batch_size not between 1 and 10000 then
    raise exception 'O lote deve possuir entre 1 e 10000 registros.' using errcode = '22023';
  end if;

  select policy.retention_days
    into retention_window
  from private.chat_retention_policies policy
  where policy.dataset = 'operation_metrics'
    and policy.enabled;

  if retention_window is null then
    return 0;
  end if;

  with candidates as (
    select metric.id
    from private.chat_operation_metrics metric
    where metric.created_at < now() - make_interval(days => retention_window)
    order by metric.created_at, metric.id
    limit p_batch_size
    for update skip locked
  ), deleted as (
    delete from private.chat_operation_metrics metric
    using candidates
    where metric.id = candidates.id
    returning metric.id
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end;
$$;

revoke all on function private.preview_chat_retention() from public, anon, authenticated;
revoke all on function private.apply_chat_metrics_retention(integer) from public, anon, authenticated;
grant execute on function private.preview_chat_retention() to service_role;
grant execute on function private.apply_chat_metrics_retention(integer) to service_role;
grant delete on private.chat_operation_metrics to service_role;

comment on function private.preview_chat_retention() is
  'Prévia somente leitura dos registros elegíveis às políticas de retenção do chat.';
comment on function private.apply_chat_metrics_retention(integer) is
  'Remove, em lote, somente métricas operacionais vencidas. Nunca remove mensagens.';

