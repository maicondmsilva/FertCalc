begin;
do $$ declare t text; missing_count int; begin
 foreach t in array array['transportadoras','pedidos_venda','pedidos_venda_itens','cancelamentos_pedido','cotacoes_solicitadas','carregamentos','carregamento_itens','carregamento_execucoes','cotacoes_frete','historico_carregamento','alertas_carregamento','audit_log'] loop
  select count(*) into missing_count from information_schema.columns where table_schema='public' and table_name=t and column_name='organization_id' and is_nullable='NO';
  if missing_count<>1 then raise exception 'organization_id missing or nullable on %',t; end if;
  execute format('select count(*) from public.%I where organization_id is null',t) into missing_count;
  if missing_count<>0 then raise exception 'null organization_id on %',t; end if;
  select count(*) into missing_count from pg_policies where schemaname='public' and tablename=t and (coalesce(qual,'') ilike '%organization_id%' or coalesce(with_check,'') ilike '%organization_id%');
  if missing_count=0 then raise exception 'tenant policy missing on %',t; end if;
 end loop;
end $$;
rollback;
