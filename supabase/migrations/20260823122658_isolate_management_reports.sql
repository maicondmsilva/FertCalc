-- FertCalc Phase 7.1: protect management reports and isolate them by organization.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'management_categorias',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'management_configs',
    'management_dias_uteis'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists organization_id uuid references public.organizations(id)',
      table_name
    );
  end loop;
end
$$;

-- Branch-scoped records inherit their tenant from the related branch.
update public.management_lancamentos record
set organization_id = branch.organization_id
from public.branches branch
where record.organization_id is null and record.unidade_id = branch.id;

update public.management_metas record
set organization_id = branch.organization_id
from public.branches branch
where record.organization_id is null and record.unidade_id = branch.id;

update public.management_configs record
set organization_id = branch.organization_id
from public.branches branch
where record.organization_id is null and record.unidade_id = branch.id;

update public.management_dias_uteis record
set organization_id = branch.organization_id
from public.branches branch
where record.organization_id is null and record.unidade_id = branch.id;

-- Existing shared definitions belong to the original FertCalc tenant.
do $$
declare
  default_organization uuid;
  table_name text;
begin
  select id into default_organization from public.organizations where slug = 'fertcalc';
  if default_organization is null then
    raise exception 'FertCalc organization is required to migrate management reports';
  end if;

  foreach table_name in array array[
    'management_categorias',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'management_configs',
    'management_dias_uteis'
  ]
  loop
    execute format('update public.%I set organization_id = $1 where organization_id is null', table_name)
      using default_organization;
    execute format('alter table public.%I alter column organization_id set not null', table_name);
    execute format(
      'create index if not exists %I on public.%I (organization_id)',
      'idx_' || table_name || '_organization_id',
      table_name
    );
  end loop;
end
$$;

-- Keep every branch-scoped record attached to a branch from the same tenant.
alter table public.management_lancamentos
  add constraint management_lancamentos_branch_organization_fk
  foreign key (unidade_id, organization_id) references public.branches (id, organization_id);
alter table public.management_metas
  add constraint management_metas_branch_organization_fk
  foreign key (unidade_id, organization_id) references public.branches (id, organization_id);
alter table public.management_configs
  add constraint management_configs_branch_organization_fk
  foreign key (unidade_id, organization_id) references public.branches (id, organization_id);
alter table public.management_dias_uteis
  add constraint management_dias_uteis_branch_organization_fk
  foreign key (unidade_id, organization_id) references public.branches (id, organization_id);

create or replace function private.has_app_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users app_user
    where app_user.id = (select auth.uid())
      and app_user.ativo
      and app_user.organization_id = private.user_organization((select auth.uid()))
      and (
        private.app_user_hierarchy((select auth.uid())) >= 80
        or coalesce((app_user.permissions ->> permission_name)::boolean, false)
      )
  );
$$;

revoke all on function private.has_app_permission(text) from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'management_categorias',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'management_configs',
    'management_dias_uteis'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'enforce_' || table_name || '_organization', table_name);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.enforce_row_organization()',
      'enforce_' || table_name || '_organization',
      table_name
    );

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant all privileges on public.%I to service_role', table_name);
  end loop;
end
$$;

do $$
declare
  policy_record record;
  table_name text;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'management_categorias',
        'management_indicadores',
        'management_lancamentos',
        'management_metas',
        'management_configs',
        'management_dias_uteis'
      )
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;

  foreach table_name in array array[
    'management_categorias',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'management_configs',
    'management_dias_uteis'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.get_current_organization_id()) and private.has_app_permission(''managementReports''))',
      table_name || '_select_organization',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select public.get_current_organization_id()) and private.has_app_permission(''managementReports''))',
      table_name || '_insert_organization',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select public.get_current_organization_id()) and private.has_app_permission(''managementReports'')) with check (organization_id = (select public.get_current_organization_id()) and private.has_app_permission(''managementReports''))',
      table_name || '_update_organization',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select public.get_current_organization_id()) and private.has_app_permission(''managementReports''))',
      table_name || '_delete_organization',
      table_name
    );
  end loop;
end
$$;

comment on function private.has_app_permission(text) is
  'Checks an active authenticated user permission inside the current tenant.';

-- Historical tables are no longer consumed by the application. Keep them closed so
-- rebuilding the complete migration history cannot restore their former public access.
do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array['management_unidades', 'management_configuracoes_indicadores']
  loop
    if to_regclass('public.' || table_name) is not null then
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all privileges on public.%I from anon, authenticated', table_name);
      execute format('grant all privileges on public.%I to service_role', table_name);
    end if;
  end loop;
end
$$;
