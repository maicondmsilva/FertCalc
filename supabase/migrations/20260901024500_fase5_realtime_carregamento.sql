-- Fase 5: mantém todas as etapas do fluxo de carregamento sincronizadas em tempo real.
-- Não altera o schema interno `realtime`, que é gerenciado exclusivamente pelo Supabase.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'carregamento_itens',
    'carregamento_execucoes',
    'cotacoes_frete',
    'cotacoes_solicitadas'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;
