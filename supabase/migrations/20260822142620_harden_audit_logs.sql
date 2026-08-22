-- FertCalc P0.2: make audit entries immutable and derive their identity in the database.

create or replace function public.write_audit_logs_entry(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  new_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(au.nickname), ''), au.name)
    into caller_name
  from public.app_users au
  where au.id = caller_id
    and coalesce(au.ativo, true);

  if caller_name is null then
    raise exception 'active application user required' using errcode = '42501';
  end if;

  if nullif(btrim(p_action), '') is null
    or nullif(btrim(p_entity_type), '') is null
    or nullif(btrim(p_entity_id), '') is null then
    raise exception 'action, entity_type and entity_id are required'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
  values (
    caller_id,
    caller_name,
    btrim(p_action),
    btrim(p_entity_type),
    btrim(p_entity_id),
    p_metadata
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.write_audit_log_entry(
  p_tabela text,
  p_registro_id text,
  p_acao text,
  p_dados_anteriores jsonb default null,
  p_dados_novos jsonb default null,
  p_campos_alterados text[] default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  normalized_action text := upper(btrim(p_acao));
  new_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(au.nickname), ''), au.name)
    into caller_name
  from public.app_users au
  where au.id = caller_id
    and coalesce(au.ativo, true);

  if caller_name is null then
    raise exception 'active application user required' using errcode = '42501';
  end if;

  if p_tabela is null
    or p_tabela not in ('carregamentos', 'cotacoes_solicitadas') then
    raise exception 'unsupported audited table' using errcode = '22023';
  end if;

  if normalized_action is null
    or nullif(btrim(p_registro_id), '') is null
    or normalized_action not in ('INSERT', 'UPDATE', 'DELETE') then
    raise exception 'valid registro_id and acao are required' using errcode = '22023';
  end if;

  insert into public.audit_log (
    tabela,
    registro_id,
    acao,
    dados_anteriores,
    dados_novos,
    campos_alterados,
    motivo,
    usuario_id,
    usuario_nome
  )
  values (
    p_tabela,
    btrim(p_registro_id),
    normalized_action,
    p_dados_anteriores,
    p_dados_novos,
    p_campos_alterados,
    nullif(btrim(p_motivo), ''),
    caller_id,
    caller_name
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_logs_entry(text, text, text, jsonb) from public;
revoke all on function public.write_audit_log_entry(text, text, text, jsonb, jsonb, text[], text) from public;
revoke all on function public.write_audit_logs_entry(text, text, text, jsonb) from anon;
revoke all on function public.write_audit_log_entry(text, text, text, jsonb, jsonb, text[], text) from anon;
grant execute on function public.write_audit_logs_entry(text, text, text, jsonb) to authenticated;
grant execute on function public.write_audit_log_entry(text, text, text, jsonb, jsonb, text[], text) to authenticated;

alter table public.audit_logs enable row level security;
alter table public.audit_log enable row level security;

-- Replace every historical policy, including duplicate policies created manually.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('audit_logs', 'audit_log')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using ((select private.app_user_hierarchy((select auth.uid()))) >= 80);

create policy "audit_log_select_authenticated"
on public.audit_log
for select
to authenticated
using ((select auth.uid()) is not null);

revoke all privileges on table public.audit_logs from anon;
revoke all privileges on table public.audit_logs from authenticated;
revoke all privileges on table public.audit_log from anon;
revoke all privileges on table public.audit_log from authenticated;

grant select on table public.audit_logs to authenticated;
grant select on table public.audit_log to authenticated;
grant all privileges on table public.audit_logs to service_role;
grant all privileges on table public.audit_log to service_role;

comment on function public.write_audit_logs_entry(text, text, text, jsonb) is
  'Writes an immutable general audit event using the authenticated database identity.';
comment on function public.write_audit_log_entry(text, text, text, jsonb, jsonb, text[], text) is
  'Writes an immutable loading audit event using the authenticated database identity.';
