-- FertCalc Phase 2.6: tenant isolation for orders and loading workflows.

do $$ declare t text; begin
  foreach t in array array[
    'transportadoras','pedidos_venda','pedidos_venda_itens','cancelamentos_pedido',
    'cotacoes_solicitadas','carregamentos','carregamento_itens','carregamento_execucoes',
    'cotacoes_frete','historico_carregamento','alertas_carregamento','audit_log'
  ] loop
    execute format('alter table public.%I add column organization_id uuid references public.organizations(id)',t);
  end loop;
end $$;

-- Prefer the organization already attached to the user or a related business row.
update public.pedidos_venda p set organization_id=u.organization_id from public.app_users u
 where p.organization_id is null and p.importado_por=u.id;
update public.carregamentos c set organization_id=u.organization_id from public.app_users u
 where c.organization_id is null and c.criado_por=u.id;
update public.cotacoes_solicitadas c set organization_id=u.organization_id from public.app_users u
 where c.organization_id is null and c.solicitado_por=u.id;

update public.pedidos_venda p set organization_id=b.organization_id from public.branches b
 where p.organization_id is null and p.filial_id=b.id;
update public.cotacoes_solicitadas c set organization_id=b.organization_id from public.branches b
 where c.organization_id is null and c.filial_id=b.id;
update public.carregamentos c set organization_id=b.organization_id from public.branches b
 where c.organization_id is null and c.filial_id=b.id;

update public.pedidos_venda_itens i set organization_id=p.organization_id from public.pedidos_venda p where i.pedido_venda_id=p.id;
update public.cancelamentos_pedido c set organization_id=p.organization_id from public.pedidos_venda p where c.pedido_origem_id=p.id;
update public.carregamentos c set organization_id=p.organization_id from public.pedidos_venda p where c.pedido_venda_id=p.id;
update public.carregamento_itens i set organization_id=c.organization_id from public.carregamentos c where i.carregamento_id=c.id;
update public.carregamento_execucoes e set organization_id=c.organization_id from public.carregamentos c where e.carregamento_id=c.id;
update public.cotacoes_frete f set organization_id=c.organization_id from public.carregamentos c where f.carregamento_id=c.id;
update public.historico_carregamento h set organization_id=c.organization_id from public.carregamentos c where h.carregamento_id=c.id;
update public.alertas_carregamento a set organization_id=c.organization_id from public.carregamentos c where a.carregamento_id=c.id;
update public.audit_log a set organization_id=c.organization_id from public.carregamentos c
 where a.organization_id is null and a.tabela='carregamentos' and a.registro_id=c.id::text;
update public.audit_log a set organization_id=c.organization_id from public.cotacoes_solicitadas c
 where a.organization_id is null and a.tabela='cotacoes_solicitadas' and a.registro_id=c.id::text;

do $$ declare t text; default_org uuid; begin
  select id into default_org from public.organizations where slug='fertcalc';
  if default_org is null then raise exception 'Default organization fertcalc not found'; end if;
  foreach t in array array[
    'transportadoras','pedidos_venda','pedidos_venda_itens','cancelamentos_pedido',
    'cotacoes_solicitadas','carregamentos','carregamento_itens','carregamento_execucoes',
    'cotacoes_frete','historico_carregamento','alertas_carregamento','audit_log'
  ] loop
    execute format('update public.%I set organization_id=$1 where organization_id is null',t) using default_org;
    execute format('alter table public.%I alter column organization_id set not null',t);
    execute format('create index %I on public.%I (organization_id)', 'idx_'||t||'_organization_id',t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.enforce_row_organization()', 'enforce_'||t||'_organization',t);
  end loop;
end $$;

alter table public.transportadoras add constraint transportadoras_id_organization_key unique(id,organization_id);
alter table public.pedidos_venda add constraint pedidos_venda_id_organization_key unique(id,organization_id);
alter table public.pedidos_venda_itens add constraint pedidos_venda_itens_id_organization_key unique(id,organization_id);
alter table public.cotacoes_solicitadas add constraint cotacoes_solicitadas_id_organization_key unique(id,organization_id);
alter table public.carregamentos add constraint carregamentos_id_organization_key unique(id,organization_id);

alter table public.pedidos_venda_itens add constraint pedido_itens_pedido_same_organization_fk foreign key(pedido_venda_id,organization_id) references public.pedidos_venda(id,organization_id);
alter table public.cancelamentos_pedido add constraint cancelamento_origem_same_organization_fk foreign key(pedido_origem_id,organization_id) references public.pedidos_venda(id,organization_id);
alter table public.cancelamentos_pedido add constraint cancelamento_destino_same_organization_fk foreign key(pedido_destino_id,organization_id) references public.pedidos_venda(id,organization_id);
alter table public.carregamentos add constraint carregamento_pedido_same_organization_fk foreign key(pedido_venda_id,organization_id) references public.pedidos_venda(id,organization_id);
alter table public.carregamentos add constraint carregamento_cotacao_same_organization_fk foreign key(cotacao_id,organization_id) references public.cotacoes_solicitadas(id,organization_id);
alter table public.carregamentos add constraint carregamento_transportadora_same_organization_fk foreign key(transportadora_id,organization_id) references public.transportadoras(id,organization_id);
alter table public.carregamento_itens add constraint carregamento_itens_carregamento_same_org_fk foreign key(carregamento_id,organization_id) references public.carregamentos(id,organization_id);
alter table public.carregamento_itens add constraint carregamento_itens_pedido_item_same_org_fk foreign key(pedido_venda_item_id,organization_id) references public.pedidos_venda_itens(id,organization_id);
alter table public.carregamento_execucoes add constraint execucoes_carregamento_same_org_fk foreign key(carregamento_id,organization_id) references public.carregamentos(id,organization_id);
alter table public.cotacoes_frete add constraint cotacoes_carregamento_same_org_fk foreign key(carregamento_id,organization_id) references public.carregamentos(id,organization_id);
alter table public.cotacoes_frete add constraint cotacoes_transportadora_same_org_fk foreign key(transportadora_id,organization_id) references public.transportadoras(id,organization_id);
alter table public.historico_carregamento add constraint historico_carregamento_same_org_fk foreign key(carregamento_id,organization_id) references public.carregamentos(id,organization_id);
alter table public.alertas_carregamento add constraint alertas_carregamento_same_org_fk foreign key(carregamento_id,organization_id) references public.carregamentos(id,organization_id);

do $$ declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in (
  'transportadoras','pedidos_venda','pedidos_venda_itens','cancelamentos_pedido','cotacoes_solicitadas','carregamentos',
  'carregamento_itens','carregamento_execucoes','cotacoes_frete','historico_carregamento','alertas_carregamento','audit_log')
 loop execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename); end loop;
end $$;

-- Read access is tenant-wide; writes preserve the existing ownership/hierarchy rules.
do $$ declare t text; begin
 foreach t in array array['transportadoras','pedidos_venda_itens','cancelamentos_pedido','cotacoes_solicitadas','carregamento_itens','carregamento_execucoes','cotacoes_frete','historico_carregamento','alertas_carregamento'] loop
  execute format('create policy %I on public.%I for select to authenticated using (organization_id=(select public.get_current_organization_id()))',t||'_select_organization',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (organization_id=(select public.get_current_organization_id()))',t||'_insert_organization',t);
  execute format('create policy %I on public.%I for update to authenticated using (organization_id=(select public.get_current_organization_id())) with check (organization_id=(select public.get_current_organization_id()))',t||'_update_organization',t);
  execute format('create policy %I on public.%I for delete to authenticated using (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80)',t||'_delete_organization',t);
 end loop;
end $$;

create policy pedidos_venda_select_organization on public.pedidos_venda for select to authenticated using (organization_id=(select public.get_current_organization_id()) and (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy pedidos_venda_insert_organization on public.pedidos_venda for insert to authenticated with check (organization_id=(select public.get_current_organization_id()) and (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy pedidos_venda_update_organization on public.pedidos_venda for update to authenticated using (organization_id=(select public.get_current_organization_id()) and (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60)) with check (organization_id=(select public.get_current_organization_id()) and (importado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy pedidos_venda_delete_organization on public.pedidos_venda for delete to authenticated using (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80);

create policy carregamentos_select_organization on public.carregamentos for select to authenticated using (organization_id=(select public.get_current_organization_id()) and (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy carregamentos_insert_organization on public.carregamentos for insert to authenticated with check (organization_id=(select public.get_current_organization_id()) and (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy carregamentos_update_organization on public.carregamentos for update to authenticated using (organization_id=(select public.get_current_organization_id()) and (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60)) with check (organization_id=(select public.get_current_organization_id()) and (criado_por=(select auth.uid()) or private.app_user_hierarchy((select auth.uid()))>=60));
create policy carregamentos_delete_organization on public.carregamentos for delete to authenticated using (organization_id=(select public.get_current_organization_id()) and private.app_user_hierarchy((select auth.uid()))>=80);

create policy audit_log_select_organization on public.audit_log for select to authenticated using (organization_id=(select public.get_current_organization_id()));
create policy audit_log_insert_organization on public.audit_log for insert to authenticated with check (organization_id=(select public.get_current_organization_id()) and usuario_id=(select auth.uid()));
