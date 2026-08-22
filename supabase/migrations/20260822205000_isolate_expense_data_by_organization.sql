-- FertCalc Phase 2.5: tenant isolation for expense management.

alter table public.credit_cards add column organization_id uuid references public.organizations(id);
alter table public.expense_categories add column organization_id uuid references public.organizations(id);
alter table public.credit_card_expenses add column organization_id uuid references public.organizations(id);
alter table public.expense_audit add column organization_id uuid references public.organizations(id);

update public.credit_cards c set organization_id = u.organization_id
from public.app_users u where c.organization_id is null and c.user_id = u.id;
update public.credit_card_expenses e set organization_id = u.organization_id
from public.app_users u where e.organization_id is null and e.user_id = u.id;
update public.expense_audit a set organization_id = e.organization_id
from public.credit_card_expenses e where a.organization_id is null and a.expense_id = e.id;

update public.credit_cards set organization_id = (select id from public.organizations where slug='fertcalc') where organization_id is null;
update public.expense_categories set organization_id = (select id from public.organizations where slug='fertcalc') where organization_id is null;
update public.credit_card_expenses set organization_id = (select id from public.organizations where slug='fertcalc') where organization_id is null;
update public.expense_audit set organization_id = (select id from public.organizations where slug='fertcalc') where organization_id is null;

alter table public.credit_cards alter column organization_id set not null;
alter table public.expense_categories alter column organization_id set not null;
alter table public.credit_card_expenses alter column organization_id set not null;
alter table public.expense_audit alter column organization_id set not null;

create index idx_credit_cards_organization_id on public.credit_cards (organization_id);
create index idx_expense_categories_organization_id on public.expense_categories (organization_id);
create index idx_credit_card_expenses_organization_id on public.credit_card_expenses (organization_id);
create index idx_expense_audit_organization_id on public.expense_audit (organization_id);

alter table public.expense_categories add constraint expense_categories_id_organization_key unique (id, organization_id);
alter table public.credit_card_expenses add constraint expenses_id_organization_key unique (id, organization_id);
alter table public.credit_card_expenses add constraint expenses_category_same_organization_fk
  foreign key (category_id, organization_id) references public.expense_categories (id, organization_id);
alter table public.expense_audit add constraint expense_audit_expense_same_organization_fk
  foreign key (expense_id, organization_id) references public.credit_card_expenses (id, organization_id);
create index idx_expenses_category_organization on public.credit_card_expenses (category_id, organization_id);
create index idx_expense_audit_expense_organization on public.expense_audit (expense_id, organization_id);

create trigger enforce_credit_cards_organization before insert or update on public.credit_cards
for each row execute function private.enforce_row_organization();
create trigger enforce_expense_categories_organization before insert or update on public.expense_categories
for each row execute function private.enforce_row_organization();
create trigger enforce_credit_card_expenses_organization before insert or update on public.credit_card_expenses
for each row execute function private.enforce_row_organization();
create trigger enforce_expense_audit_organization before insert or update on public.expense_audit
for each row execute function private.enforce_row_organization();

do $$ declare policy_record record; begin
  for policy_record in select tablename,policyname from pg_policies where schemaname='public'
    and tablename in ('credit_cards','expense_categories','credit_card_expenses','expense_audit')
  loop execute format('drop policy if exists %I on public.%I',policy_record.policyname,policy_record.tablename); end loop;
end $$;

create policy credit_cards_select on public.credit_cards for select to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));
create policy credit_cards_insert on public.credit_cards for insert to authenticated
with check (organization_id=(select public.get_current_organization_id()) and (user_id=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=80));
create policy credit_cards_update on public.credit_cards for update to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text))
with check (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));
create policy credit_cards_delete on public.credit_cards for delete to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));

create policy expense_categories_select on public.expense_categories for select to authenticated
using (organization_id=(select public.get_current_organization_id()));
create policy expense_categories_insert on public.expense_categories for insert to authenticated
with check (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80);
create policy expense_categories_update on public.expense_categories for update to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80)
with check (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80);
create policy expense_categories_delete on public.expense_categories for delete to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80);

create policy credit_card_expenses_select on public.credit_card_expenses for select to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));
create policy credit_card_expenses_insert on public.credit_card_expenses for insert to authenticated
with check (organization_id=(select public.get_current_organization_id()) and (user_id=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=80));
create policy credit_card_expenses_update on public.credit_card_expenses for update to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text))
with check (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));
create policy credit_card_expenses_delete on public.credit_card_expenses for delete to authenticated
using (organization_id=(select public.get_current_organization_id()) and private.can_access_user_data(user_id::text));

create policy expense_audit_select on public.expense_audit for select to authenticated
using (organization_id=(select public.get_current_organization_id()) and (user_id=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=80));
create policy expense_audit_insert on public.expense_audit for insert to authenticated
with check (organization_id=(select public.get_current_organization_id()) and user_id=(select auth.uid()));
