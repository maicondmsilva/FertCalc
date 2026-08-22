-- FertCalc Phase 2.3: tenant isolation for pricing-owned data.

alter table public.pricing_records add column organization_id uuid references public.organizations(id);
alter table public.saved_formulas add column organization_id uuid references public.organizations(id);
alter table public.goals add column organization_id uuid references public.organizations(id);

update public.pricing_records p
set organization_id = u.organization_id
from public.app_users u
where p.organization_id is null and p.user_id = u.id::text;

update public.saved_formulas f
set organization_id = u.organization_id
from public.app_users u
where f.organization_id is null and f.user_id = u.id;

update public.goals g
set organization_id = u.organization_id
from public.app_users u
where g.organization_id is null and g.user_id = u.id::text;

update public.pricing_records
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;
update public.saved_formulas
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;
update public.goals
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;

alter table public.pricing_records alter column organization_id set not null;
alter table public.saved_formulas alter column organization_id set not null;
alter table public.goals alter column organization_id set not null;

create index idx_pricing_records_organization_id on public.pricing_records (organization_id);
create index idx_saved_formulas_organization_id on public.saved_formulas (organization_id);
create index idx_goals_organization_id on public.goals (organization_id);

create trigger enforce_pricing_records_organization before insert or update on public.pricing_records
for each row execute function private.enforce_row_organization();
create trigger enforce_saved_formulas_organization before insert or update on public.saved_formulas
for each row execute function private.enforce_row_organization();
create trigger enforce_goals_organization before insert or update on public.goals
for each row execute function private.enforce_row_organization();

drop policy if exists pricing_select on public.pricing_records;
drop policy if exists pricing_insert on public.pricing_records;
drop policy if exists pricing_update on public.pricing_records;
drop policy if exists pricing_delete on public.pricing_records;
drop policy if exists saved_formulas_select on public.saved_formulas;
drop policy if exists saved_formulas_insert on public.saved_formulas;
drop policy if exists saved_formulas_update on public.saved_formulas;
drop policy if exists saved_formulas_delete on public.saved_formulas;
drop policy if exists goals_select on public.goals;
drop policy if exists goals_insert on public.goals;
drop policy if exists goals_update on public.goals;
drop policy if exists goals_delete on public.goals;

create policy pricing_select on public.pricing_records for select to authenticated
using (organization_id = (select public.get_current_organization_id())
  and (private.can_access_user_data(user_id) or transfer_to_user_id = (select auth.uid())));
create policy pricing_insert on public.pricing_records for insert to authenticated
with check (organization_id = (select public.get_current_organization_id())
  and (user_id = (select auth.uid())::text or private.app_user_hierarchy((select auth.uid())) >= 80));
create policy pricing_update on public.pricing_records for update to authenticated
using (organization_id = (select public.get_current_organization_id())
  and (private.can_access_user_data(user_id) or transfer_to_user_id = (select auth.uid())))
with check (organization_id = (select public.get_current_organization_id())
  and private.can_access_user_data(user_id));
create policy pricing_delete on public.pricing_records for delete to authenticated
using (organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['saved_formulas', 'goals'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.get_current_organization_id()) and private.can_access_user_data(user_id::text))',
      table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select public.get_current_organization_id()) and (user_id::text = (select auth.uid())::text or private.app_user_hierarchy((select auth.uid())) >= 80))',
      table_name || '_insert', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select public.get_current_organization_id()) and private.can_access_user_data(user_id::text)) with check (organization_id = (select public.get_current_organization_id()) and private.can_access_user_data(user_id::text))',
      table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select public.get_current_organization_id()) and private.can_access_user_data(user_id::text))',
      table_name || '_delete', table_name);
  end loop;
end
$$;
