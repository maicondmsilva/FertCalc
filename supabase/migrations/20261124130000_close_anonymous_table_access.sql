-- Fecha o acesso sem login a tabelas que tinham políticas abertas
-- (role public/anon com "true"): qualquer pessoa com a chave pública do site
-- conseguia ler, alterar e apagar dados de Gestão, categorias e regras.
-- O app sempre usa sessão autenticada, então as telas continuam funcionando.

do $$
declare
  t text;
  pol record;
  open_tables text[] := array[
    'comparison_history',
    'compatibility_categories',
    'fertigran_p_formulas',
    'finished_products',
    'incompatibility_rules',
    'management_categorias',
    'management_dias_uteis',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'unidades'
  ];
begin
  foreach t in array open_tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select_authenticated', t
    );
  end loop;
end
$$;

-- Escrita: categorias de compatibilidade e regras de incompatibilidade são
-- cadastros de configuração (gerente ou acima). Demais tabelas: usuário logado.
create policy compatibility_categories_write on public.compatibility_categories
  for all to authenticated
  using (private.app_user_hierarchy((select auth.uid())) >= 60)
  with check (private.app_user_hierarchy((select auth.uid())) >= 60);

create policy incompatibility_rules_write on public.incompatibility_rules
  for all to authenticated
  using (private.app_user_hierarchy((select auth.uid())) >= 60)
  with check (private.app_user_hierarchy((select auth.uid())) >= 60);

do $$
declare
  t text;
begin
  foreach t in array array[
    'comparison_history',
    'fertigran_p_formulas',
    'finished_products',
    'management_categorias',
    'management_dias_uteis',
    'management_indicadores',
    'management_lancamentos',
    'management_metas',
    'unidades'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      t || '_write_authenticated', t
    );
  end loop;
end
$$;
