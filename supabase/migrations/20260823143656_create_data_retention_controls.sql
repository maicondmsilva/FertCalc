-- FertCalc 8.6: controlled, observable retention without automatic destructive execution.

create table private.data_retention_policies (
  dataset text primary key check (
    dataset in ('notifications', 'runtime_error_events', 'audit_logs', 'audit_log')
  ),
  retention_days integer not null check (retention_days between 30 and 3650),
  enabled boolean not null default false,
  read_rows_only boolean not null default false,
  updated_at timestamptz not null default now()
);

create table private.data_retention_runs (
  id bigint generated always as identity primary key,
  dataset text not null,
  rows_deleted bigint not null check (rows_deleted >= 0),
  executed_by text not null default current_user,
  executed_at timestamptz not null default now()
);

insert into private.data_retention_policies (
  dataset,
  retention_days,
  enabled,
  read_rows_only
)
values
  ('notifications', 180, true, true),
  ('runtime_error_events', 90, true, false),
  ('audit_logs', 1825, false, false),
  ('audit_log', 1825, false, false)
on conflict (dataset) do nothing;

create index notifications_retention_read_created_at_idx
  on public.notifications (created_at)
  where is_read = true or read = true;

create index if not exists audit_log_criado_em_idx
  on public.audit_log (criado_em);

create or replace function private.preview_data_retention()
returns table (
  dataset text,
  retention_days integer,
  enabled boolean,
  candidate_rows bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    policy.dataset,
    policy.retention_days,
    policy.enabled,
    case policy.dataset
      when 'notifications' then (
        select count(*)
        from public.notifications notification
        where (notification.is_read = true or notification.read = true)
          and notification.created_at < now() - make_interval(days => policy.retention_days)
      )
      when 'runtime_error_events' then (
        select count(*)
        from public.runtime_error_events runtime_error
        where runtime_error.created_at < now() - make_interval(days => policy.retention_days)
      )
      when 'audit_logs' then (
        select count(*)
        from public.audit_logs audit_event
        where audit_event.created_at < now() - make_interval(days => policy.retention_days)
      )
      when 'audit_log' then (
        select count(*)
        from public.audit_log audit_event
        where audit_event.criado_em < now() - make_interval(days => policy.retention_days)
      )
    end::bigint as candidate_rows
  from private.data_retention_policies policy
  order by policy.dataset;
$$;

create or replace function private.apply_data_retention(p_batch_size integer default 1000)
returns table (dataset text, rows_deleted bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy record;
  deleted_rows bigint;
begin
  if p_batch_size < 1 or p_batch_size > 10000 then
    raise exception 'batch size must be between 1 and 10000' using errcode = '22023';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '2min', true);

  for policy in
    select retention_policy.dataset, retention_policy.retention_days
    from private.data_retention_policies retention_policy
    where retention_policy.enabled
    order by retention_policy.dataset
  loop
    deleted_rows := 0;

    case policy.dataset
      when 'notifications' then
        with candidates as (
          select notification.id
          from public.notifications notification
          where (notification.is_read = true or notification.read = true)
            and notification.created_at < now() - make_interval(days => policy.retention_days)
          order by notification.created_at
          limit p_batch_size
          for update skip locked
        )
        delete from public.notifications notification
        using candidates
        where notification.id = candidates.id;
      when 'runtime_error_events' then
        with candidates as (
          select runtime_error.id
          from public.runtime_error_events runtime_error
          where runtime_error.created_at < now() - make_interval(days => policy.retention_days)
          order by runtime_error.created_at
          limit p_batch_size
          for update skip locked
        )
        delete from public.runtime_error_events runtime_error
        using candidates
        where runtime_error.id = candidates.id;
      when 'audit_logs' then
        with candidates as (
          select audit_event.id
          from public.audit_logs audit_event
          where audit_event.created_at < now() - make_interval(days => policy.retention_days)
          order by audit_event.created_at
          limit p_batch_size
          for update skip locked
        )
        delete from public.audit_logs audit_event
        using candidates
        where audit_event.id = candidates.id;
      when 'audit_log' then
        with candidates as (
          select audit_event.id
          from public.audit_log audit_event
          where audit_event.criado_em < now() - make_interval(days => policy.retention_days)
          order by audit_event.criado_em
          limit p_batch_size
          for update skip locked
        )
        delete from public.audit_log audit_event
        using candidates
        where audit_event.id = candidates.id;
    end case;

    get diagnostics deleted_rows = row_count;

    insert into private.data_retention_runs (dataset, rows_deleted)
    values (policy.dataset, deleted_rows);

    dataset := policy.dataset;
    rows_deleted := deleted_rows;
    return next;
  end loop;
end;
$$;

revoke all on table private.data_retention_policies from public, anon, authenticated;
revoke all on table private.data_retention_runs from public, anon, authenticated;
revoke all on function private.preview_data_retention() from public, anon, authenticated;
revoke all on function private.apply_data_retention(integer) from public, anon, authenticated;

grant select, insert, update on table private.data_retention_policies to service_role;
grant select on table private.data_retention_runs to service_role;
grant usage, select on sequence private.data_retention_runs_id_seq to service_role;
grant execute on function private.preview_data_retention() to service_role;
grant execute on function private.apply_data_retention(integer) to service_role;

comment on table private.data_retention_policies is
  'Server-only retention configuration. Audit datasets stay disabled until a legal policy is approved.';
comment on function private.preview_data_retention() is
  'Reports retention candidates without changing data.';
comment on function private.apply_data_retention(integer) is
  'Deletes eligible rows in bounded batches. Server-only and not scheduled by this migration.';
