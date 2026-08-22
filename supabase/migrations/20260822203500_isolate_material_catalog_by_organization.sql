-- FertCalc Phase 2.4: tenant isolation for brands and material catalogs.

alter table public.brands add column organization_id uuid references public.organizations(id);
alter table public.macro_materials add column organization_id uuid references public.organizations(id);
alter table public.micro_materials add column organization_id uuid references public.organizations(id);

update public.brands
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;
update public.macro_materials
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;
update public.micro_materials
set organization_id = (select id from public.organizations where slug = 'fertcalc')
where organization_id is null;

alter table public.brands alter column organization_id set not null;
alter table public.macro_materials alter column organization_id set not null;
alter table public.micro_materials alter column organization_id set not null;

create index idx_brands_organization_id on public.brands (organization_id);
create index idx_macro_materials_organization_id on public.macro_materials (organization_id);
create index idx_micro_materials_organization_id on public.micro_materials (organization_id);

alter table public.brands add constraint brands_id_organization_key unique (id, organization_id);
alter table public.macro_materials add constraint macro_materials_brand_same_organization_fk
  foreign key (brand_id, organization_id)
  references public.brands (id, organization_id);
create index idx_macro_materials_brand_organization
  on public.macro_materials (brand_id, organization_id);

create trigger enforce_brands_organization before insert or update on public.brands
for each row execute function private.enforce_row_organization();
create trigger enforce_macro_materials_organization before insert or update on public.macro_materials
for each row execute function private.enforce_row_organization();
create trigger enforce_micro_materials_organization before insert or update on public.micro_materials
for each row execute function private.enforce_row_organization();

do $$
declare policy_record record;
begin
  for policy_record in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('brands', 'macro_materials', 'micro_materials')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['brands', 'macro_materials', 'micro_materials'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = (select public.get_current_organization_id()))',
      table_name || '_select_organization', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 80)',
      table_name || '_insert_organization', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 80) with check (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 80)',
      table_name || '_update_organization', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id = (select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid())) >= 80)',
      table_name || '_delete_organization', table_name);
  end loop;
end
$$;
