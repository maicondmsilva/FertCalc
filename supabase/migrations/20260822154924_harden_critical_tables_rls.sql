-- FertCalc P0.5: replace open RLS policies on critical business tables.
create or replace function private.can_access_user_data(owner_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select owner_id=(select auth.uid())::text
   or private.app_user_hierarchy((select auth.uid()))>=80
   or owner_id=any(coalesce((select managed_user_ids from public.app_users where id=(select auth.uid())),'{}'::text[]));
$$;
revoke all on function private.can_access_user_data(text) from public,anon,authenticated;

do $$ declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in
 ('pricing_records','saved_formulas','goals','carregamentos','pedidos_venda','clients','agents','branches','price_lists','macro_materials','micro_materials','app_settings','credit_card_expenses','expense_audit','expense_categories','management_configs','alert_configs')
 loop execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename); end loop;
end $$;

do $$ declare t text; begin
 foreach t in array array['pricing_records','saved_formulas','goals','carregamentos','pedidos_venda','clients','agents','branches','price_lists','macro_materials','micro_materials','app_settings','credit_card_expenses','expense_audit','expense_categories','management_configs','alert_configs']
 loop execute format('alter table public.%I enable row level security',t); execute format('revoke all privileges on public.%I from anon,authenticated',t); execute format('grant select,insert,update,delete on public.%I to authenticated',t); execute format('grant all privileges on public.%I to service_role',t); end loop;
end $$;

-- Owned records.
create policy pricing_select on public.pricing_records for select to authenticated using (private.can_access_user_data(user_id) or transfer_to_user_id=(select auth.uid()));
create policy pricing_insert on public.pricing_records for insert to authenticated with check (user_id=(select auth.uid())::text or private.app_user_hierarchy((select auth.uid()))>=80);
create policy pricing_update on public.pricing_records for update to authenticated using (private.can_access_user_data(user_id) or transfer_to_user_id=(select auth.uid())) with check (private.can_access_user_data(user_id));
create policy pricing_delete on public.pricing_records for delete to authenticated using (private.app_user_hierarchy((select auth.uid()))>=80);

do $$ declare t text; begin foreach t in array array['saved_formulas','goals','credit_card_expenses'] loop
 execute format('create policy %I on public.%I for select to authenticated using (private.can_access_user_data(user_id::text))',t||'_select',t);
 execute format('create policy %I on public.%I for insert to authenticated with check (user_id::text=(select auth.uid())::text or private.app_user_hierarchy((select auth.uid()))>=80)',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using (private.can_access_user_data(user_id::text)) with check (private.can_access_user_data(user_id::text))',t||'_update',t);
 execute format('create policy %I on public.%I for delete to authenticated using (private.can_access_user_data(user_id::text))',t||'_delete',t);
 end loop; end $$;

-- Shared reference data: authenticated read; managers write; only admins delete.
do $$ declare t text; begin foreach t in array array['clients','agents','price_lists'] loop
 execute format('create policy %I on public.%I for select to authenticated using (true)',t||'_select',t);
 execute format('create policy %I on public.%I for insert to authenticated with check (private.app_user_hierarchy((select auth.uid()))>=60)',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using (private.app_user_hierarchy((select auth.uid()))>=60) with check (private.app_user_hierarchy((select auth.uid()))>=60)',t||'_update',t);
 execute format('create policy %I on public.%I for delete to authenticated using (private.app_user_hierarchy((select auth.uid()))>=80)',t||'_delete',t);
 end loop; end $$;

do $$ declare t text; begin foreach t in array array['branches','macro_materials','micro_materials','app_settings','expense_categories','management_configs','alert_configs'] loop
 execute format('create policy %I on public.%I for select to authenticated using (true)',t||'_select',t);
 execute format('create policy %I on public.%I for all to authenticated using (private.app_user_hierarchy((select auth.uid()))>=80) with check (private.app_user_hierarchy((select auth.uid()))>=80)',t||'_admin_write',t);
 end loop; end $$;

-- Operational tables require manager level; creators retain visibility.
create policy carregamentos_access on public.carregamentos for select to authenticated using (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy carregamentos_insert on public.carregamentos for insert to authenticated with check (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy carregamentos_write on public.carregamentos for update to authenticated using (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60) with check (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy carregamentos_delete on public.carregamentos for delete to authenticated using (private.app_user_hierarchy((select auth.uid()))>=80);
create policy pedidos_access on public.pedidos_venda for select to authenticated using (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy pedidos_insert on public.pedidos_venda for insert to authenticated with check (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy pedidos_write on public.pedidos_venda for update to authenticated using (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60) with check (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60);
create policy pedidos_delete on public.pedidos_venda for delete to authenticated using (private.app_user_hierarchy((select auth.uid()))>=80);
create policy expense_audit_select on public.expense_audit for select to authenticated using (user_id=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=80);
create policy expense_audit_insert on public.expense_audit for insert to authenticated with check (user_id=(select auth.uid()));
