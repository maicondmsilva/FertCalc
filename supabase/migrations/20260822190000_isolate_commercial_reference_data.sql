-- FertCalc Phase 2.2: tenant isolation for commercial reference data.

alter table public.branches add column organization_id uuid references public.organizations(id);
alter table public.clients add column organization_id uuid references public.organizations(id);
alter table public.agents add column organization_id uuid references public.organizations(id);
alter table public.locais_carregamento add column organization_id uuid references public.organizations(id);
alter table public.price_lists add column organization_id uuid references public.organizations(id);

-- Repair a legacy trigger that targets a column not present on this table.
drop trigger if exists trg_locais_carregamento_updated_at on public.locais_carregamento;
alter function public.fn_set_atualizado_em() set search_path = '';
create trigger trg_locais_carregamento_updated_at
before update on public.locais_carregamento
for each row execute function public.fn_set_atualizado_em();

update public.branches set organization_id = 'f0000000-0000-4000-8000-000000000001' where organization_id is null;
update public.clients set organization_id = 'f0000000-0000-4000-8000-000000000001' where organization_id is null;
update public.agents set organization_id = 'f0000000-0000-4000-8000-000000000001' where organization_id is null;
update public.locais_carregamento set organization_id = 'f0000000-0000-4000-8000-000000000001' where organization_id is null;
update public.price_lists set organization_id = 'f0000000-0000-4000-8000-000000000001' where organization_id is null;

alter table public.branches alter column organization_id set not null;
alter table public.clients alter column organization_id set not null;
alter table public.agents alter column organization_id set not null;
alter table public.locais_carregamento alter column organization_id set not null;
alter table public.price_lists alter column organization_id set not null;

create index idx_branches_organization_id on public.branches (organization_id);
create index idx_clients_organization_id on public.clients (organization_id);
create index idx_agents_organization_id on public.agents (organization_id);
create index idx_locais_carregamento_organization_id on public.locais_carregamento (organization_id);
create index idx_price_lists_organization_id on public.price_lists (organization_id);

alter table public.branches add constraint branches_id_organization_key unique (id, organization_id);
alter table public.locais_carregamento add constraint locais_id_organization_key unique (id, organization_id);
alter table public.locais_carregamento add constraint locais_branch_same_organization_fk
  foreign key (filial_id, organization_id)
  references public.branches (id, organization_id);
alter table public.price_lists add constraint price_lists_branch_same_organization_fk
  foreign key (branch_id, organization_id)
  references public.branches (id, organization_id);
alter table public.price_lists add constraint price_lists_location_same_organization_fk
  foreign key (local_carregamento_id, organization_id)
  references public.locais_carregamento (id, organization_id);

create or replace function private.enforce_row_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if caller_id is null then
      if new.organization_id is null then
        raise exception 'organization_id is required for trusted inserts' using errcode = '23502';
      end if;
      return new;
    end if;

    caller_organization := private.user_organization(caller_id);
    if caller_organization is null then
      raise exception 'active organization required' using errcode = '42501';
    end if;
    if new.organization_id is null then
      new.organization_id := caller_organization;
    elsif new.organization_id <> caller_organization then
      raise exception 'cross-organization insert is not allowed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_row_organization() from public, anon, authenticated;

create trigger enforce_branches_organization before insert or update on public.branches
for each row execute function private.enforce_row_organization();
create trigger enforce_clients_organization before insert or update on public.clients
for each row execute function private.enforce_row_organization();
create trigger enforce_agents_organization before insert or update on public.agents
for each row execute function private.enforce_row_organization();
create trigger enforce_locations_organization before insert or update on public.locais_carregamento
for each row execute function private.enforce_row_organization();
create trigger enforce_price_lists_organization before insert or update on public.price_lists
for each row execute function private.enforce_row_organization();

do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('branches', 'clients', 'agents', 'locais_carregamento', 'price_lists')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

create policy branches_select_organization on public.branches for select to authenticated
using (organization_id = (select public.get_current_organization_id()));
create policy branches_insert_organization on public.branches for insert to authenticated
with check (organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80);
create policy branches_update_organization on public.branches for update to authenticated
using (organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80)
with check (organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80);
create policy branches_delete_organization on public.branches for delete to authenticated
using (organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'agents', 'locais_carregamento', 'price_lists']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.get_current_organization_id()))',
      table_name || '_select_organization', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 60)',
      table_name || '_insert_organization', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 60) with check (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 60)',
      table_name || '_update_organization', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 80)',
      table_name || '_delete_organization', table_name
    );
  end loop;
end
$$;

comment on function private.enforce_row_organization() is
  'Assigns the authenticated tenant on insert and prevents tenant reassignment.';
