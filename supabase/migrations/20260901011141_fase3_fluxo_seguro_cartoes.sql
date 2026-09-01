-- Fase 3: associação estável entre gasto/cartão e workflow auditável no banco.

alter table public.credit_cards
  add constraint credit_cards_id_organization_key unique (id, organization_id);

alter table public.credit_card_expenses
  add column card_id uuid,
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.app_users(id);

update public.credit_card_expenses expense
set card_id = card.id
from public.credit_cards card
where expense.card_id is null
  and expense.organization_id = card.organization_id
  and lower(btrim(expense.card_name)) = lower(btrim(card.name));

alter table public.credit_card_expenses
  add constraint expenses_card_same_organization_fk
  foreign key (card_id, organization_id)
  references public.credit_cards(id, organization_id);

create index idx_credit_card_expenses_card_organization
  on public.credit_card_expenses(card_id, organization_id);
create index idx_credit_card_expenses_open_period
  on public.credit_card_expenses(organization_id, period_year, period_month, status)
  where deleted_at is null;

alter table public.expense_audit
  add column dados_anteriores jsonb,
  add column dados_novos jsonb;

create or replace function private.current_expense_role(caller_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.app_user_hierarchy(caller_id) >= 80 then 'admin'
    when coalesce(app_user.permissions ->> 'creditCard', 'none')
      in ('viewer','launcher','checker','approver','admin')
      then app_user.permissions ->> 'creditCard'
    else 'none'
  end
  from public.app_users app_user
  where app_user.id = caller_id
    and app_user.ativo;
$$;

revoke all on function private.current_expense_role(uuid) from public, anon, authenticated;

create or replace function private.protect_expense_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text := coalesce(private.current_expense_role((select auth.uid())), 'none');
  caller_name text;
  action_name text;
  business_changed boolean;
begin
  if caller_id is null then
    raise exception 'Sessao expirada. Entre novamente.' using errcode = '42501';
  end if;

  select app_user.name into caller_name
  from public.app_users app_user
  where app_user.id = caller_id and app_user.ativo;

  if tg_op = 'INSERT' then
    if new.user_id <> caller_id and caller_role <> 'admin' then
      raise exception 'Nao e permitido lancar gasto para outro usuario.' using errcode = '42501';
    end if;
    if caller_role not in ('launcher','checker','approver','admin') then
      raise exception 'Usuario sem permissao para lancar gastos.' using errcode = '42501';
    end if;
    new.status := 'pendente';
    new.deleted_at := null;
    new.deleted_by := null;
    if new.card_id is not null then
      select card.name into new.card_name
      from public.credit_cards card
      where card.id = new.card_id
        and card.organization_id = new.organization_id
        and card.active
        and (card.user_id = new.user_id or caller_role = 'admin');
      if not found then
        raise exception 'Cartao invalido, inativo ou nao associado ao usuario.' using errcode = '23503';
      end if;
    end if;
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id then
    raise exception 'Organizacao e responsavel do gasto nao podem ser alterados.' using errcode = '42501';
  end if;

  business_changed := row(
    new.description, new.amount, new.date, new.category_id, new.card_id,
    new.installments, new.current_installment, new.receipt,
    new.period_month, new.period_year
  ) is distinct from row(
    old.description, old.amount, old.date, old.category_id, old.card_id,
    old.installments, old.current_installment, old.receipt,
    old.period_month, old.period_year
  ) or (
    new.observation is distinct from old.observation
    and not (new.status = 'rejeitado' and old.status in ('pendente','conferido'))
  );

  if business_changed then
    if old.status <> 'pendente' or old.deleted_at is not null then
      raise exception 'Somente gastos pendentes podem ter os dados editados.' using errcode = 'P0001';
    end if;
    if old.user_id <> caller_id and caller_role <> 'admin' then
      raise exception 'Somente o responsavel ou administrador pode editar o gasto.' using errcode = '42501';
    end if;
  end if;

  if new.card_id is distinct from old.card_id and new.card_id is not null then
    select card.name into new.card_name
    from public.credit_cards card
    where card.id = new.card_id
      and card.organization_id = new.organization_id
      and card.active
      and (card.user_id = new.user_id or caller_role = 'admin');
    if not found then
      raise exception 'Cartao invalido, inativo ou nao associado ao usuario.' using errcode = '23503';
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.deleted_at is not null then
      raise exception 'Gasto excluido nao pode mudar de status.' using errcode = 'P0001';
    end if;
    if new.status = 'conferido'
      and old.status = 'pendente'
      and caller_role in ('checker','approver','admin') then
      action_name := 'conferido';
    elsif new.status = 'aprovado'
      and old.status = 'conferido'
      and caller_role in ('approver','admin') then
      action_name := 'aprovado';
    elsif new.status = 'rejeitado'
      and old.status in ('pendente','conferido')
      and caller_role in ('checker','approver','admin') then
      if char_length(btrim(coalesce(new.observation, ''))) < 5 then
        raise exception 'Informe o motivo da rejeicao com pelo menos 5 caracteres.' using errcode = '22023';
      end if;
      action_name := 'rejeitado';
    else
      raise exception 'Transicao de status nao permitida para este usuario.' using errcode = '42501';
    end if;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null or old.deleted_at is not null or old.status <> 'pendente' then
      raise exception 'Somente gastos pendentes e ativos podem ser excluidos.' using errcode = 'P0001';
    end if;
    if old.user_id <> caller_id and caller_role <> 'admin' then
      raise exception 'Somente o responsavel ou administrador pode excluir o gasto.' using errcode = '42501';
    end if;
    new.deleted_by := caller_id;
    action_name := 'excluido';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.audit_expense_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  action_name text;
begin
  select app_user.name into caller_name from public.app_users app_user where app_user.id = caller_id;
  if tg_op = 'INSERT' then
    action_name := 'criado';
  elsif new.deleted_at is distinct from old.deleted_at then
    action_name := 'excluido';
  elsif new.status is distinct from old.status then
    action_name := new.status;
  else
    action_name := 'editado';
  end if;

  insert into public.expense_audit(
    expense_id, organization_id, action, user_id, user_name, observation,
    dados_anteriores, dados_novos
  ) values (
    new.id, new.organization_id, action_name, caller_id,
    coalesce(caller_name, 'Usuario'),
    case when action_name = 'rejeitado' then new.observation else null end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists protect_expense_workflow on public.credit_card_expenses;
create trigger protect_expense_workflow
before insert or update on public.credit_card_expenses
for each row execute function private.protect_expense_workflow();

drop trigger if exists audit_expense_change on public.credit_card_expenses;
create trigger audit_expense_change
after insert or update on public.credit_card_expenses
for each row execute function private.audit_expense_change();

do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'credit_card_expenses'
  loop
    execute format('drop policy if exists %I on public.credit_card_expenses', policy_record.policyname);
  end loop;
end $$;

create policy credit_card_expenses_select on public.credit_card_expenses
for select to authenticated using (
  organization_id = (select public.get_current_organization_id())
  and (
    user_id = (select auth.uid())
    or private.current_expense_role((select auth.uid())) in ('checker','approver','admin')
  )
);
create policy credit_card_expenses_insert on public.credit_card_expenses
for insert to authenticated with check (
  organization_id = (select public.get_current_organization_id())
  and (
    user_id = (select auth.uid())
    or private.current_expense_role((select auth.uid())) = 'admin'
  )
);
create policy credit_card_expenses_update on public.credit_card_expenses
for update to authenticated using (
  organization_id = (select public.get_current_organization_id())
  and (
    user_id = (select auth.uid())
    or private.current_expense_role((select auth.uid())) in ('checker','approver','admin')
  )
) with check (organization_id = (select public.get_current_organization_id()));

revoke delete on public.credit_card_expenses from authenticated;
revoke insert, update, delete on public.expense_audit from authenticated;

drop policy if exists credit_cards_select on public.credit_cards;
drop policy if exists credit_cards_insert on public.credit_cards;
drop policy if exists credit_cards_update on public.credit_cards;
drop policy if exists credit_cards_delete on public.credit_cards;
create policy credit_cards_select on public.credit_cards for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and (
    private.can_access_user_data(user_id::text)
    or private.current_expense_role((select auth.uid())) = 'admin'
  )
);
create policy credit_cards_insert on public.credit_cards for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);
create policy credit_cards_update on public.credit_cards for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
) with check (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);
create policy credit_cards_delete on public.credit_cards for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);

drop policy if exists expense_categories_insert on public.expense_categories;
drop policy if exists expense_categories_update on public.expense_categories;
drop policy if exists expense_categories_delete on public.expense_categories;
create policy expense_categories_insert on public.expense_categories for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);
create policy expense_categories_update on public.expense_categories for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
) with check (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);
create policy expense_categories_delete on public.expense_categories for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.current_expense_role((select auth.uid())) = 'admin'
);

drop policy if exists expense_audit_insert on public.expense_audit;
drop policy if exists expense_audit_select on public.expense_audit;
create policy expense_audit_select on public.expense_audit
for select to authenticated using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.credit_card_expenses expense
    where expense.id = expense_audit.expense_id
  )
);

do $$
declare table_name text;
begin
  foreach table_name in array array['credit_cards','credit_card_expenses','expense_audit']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
