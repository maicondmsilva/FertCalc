-- Execute depois de uma restauração, com uma conexão administrativa.
-- A consulta não altera dados e não retorna conteúdo das tabelas.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'public.app_users',
    'public.pedidos_venda',
    'public.pedidos_venda_itens',
    'public.carregamentos',
    'public.pricing_records'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'Tabela crítica ausente após restauração: %', required_table;
    end if;
  end loop;
end;
$$;

select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.app_users) as app_users,
  (select count(*) from public.pedidos_venda) as orders,
  (select count(*) from public.carregamentos) as loadings,
  current_setting('server_version') as postgres_version;
