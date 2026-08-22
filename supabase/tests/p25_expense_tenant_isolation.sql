begin;
insert into public.organizations (id,name,slug) values ('f0000000-0000-4000-8000-000000000025','P25 Other Organization','p25-other');
insert into public.app_users (id,organization_id,email,name,password,role,permissions,managed_user_ids,filiais_permitidas,ativo) values
('b0000000-0000-4000-8000-000000000051',(select id from public.organizations where slug='fertcalc'),'p25-a@example.test','P25 A','','master','{}'::jsonb,'{}'::text[],'{}'::uuid[],true),
('b0000000-0000-4000-8000-000000000052','f0000000-0000-4000-8000-000000000025','p25-b@example.test','P25 B','','master','{}'::jsonb,'{}'::text[],'{}'::uuid[],true);
insert into public.expense_categories (id,organization_id,name) values ('c0000000-0000-4000-8000-000000000051','f0000000-0000-4000-8000-000000000025','P25 Category B');
insert into public.credit_card_expenses (id,organization_id,description,amount,date,category_id,user_id,user_name,period_month,period_year)
values ('c1000000-0000-4000-8000-000000000051','f0000000-0000-4000-8000-000000000025','P25 Expense B',100,current_date,'c0000000-0000-4000-8000-000000000051','b0000000-0000-4000-8000-000000000052','P25 B',8,2026);
insert into public.expense_audit (organization_id,expense_id,action,user_id,user_name)
values ('f0000000-0000-4000-8000-000000000025','c1000000-0000-4000-8000-000000000051','criado','b0000000-0000-4000-8000-000000000052','P25 B');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000051","role":"authenticated"}',true);
do $$ declare visible integer; inherited uuid; begin
  select (select count(*) from public.expense_categories where organization_id='f0000000-0000-4000-8000-000000000025')
       +(select count(*) from public.credit_card_expenses where organization_id='f0000000-0000-4000-8000-000000000025')
       +(select count(*) from public.expense_audit where organization_id='f0000000-0000-4000-8000-000000000025') into visible;
  if visible<>0 then raise exception 'expense data leaked across organizations'; end if;
  insert into public.credit_cards (name,user_id) values ('P25 Card A','b0000000-0000-4000-8000-000000000051') returning organization_id into inherited;
  if inherited<>(select id from public.organizations where slug='fertcalc') then raise exception 'tenant was not inherited'; end if;
  begin
    insert into public.credit_card_expenses (description,amount,date,category_id,user_id,user_name,period_month,period_year)
    values ('P25 Cross Category',100,current_date,'c0000000-0000-4000-8000-000000000051','b0000000-0000-4000-8000-000000000051','P25 A',8,2026);
    raise exception 'cross-organization category reference succeeded';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.expense_categories (organization_id,name) values ('f0000000-0000-4000-8000-000000000025','P25 Cross Category');
    raise exception 'cross-organization insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
