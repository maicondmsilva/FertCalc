-- Batidas Salvas e Produtos Formulados passam a ser arquivados em vez de apagados.
-- Arquivar esconde das listas e da calculadora, mas preserva a composição da batida
-- e o histórico de preços do produto. Restaurar devolve os dois.

alter table public.saved_formulas
  add column if not exists arquivada_em timestamptz;

alter table public.produtos_formulados
  add column if not exists arquivado_em timestamptz;

comment on column public.saved_formulas.arquivada_em is
  'Quando preenchido, a batida está arquivada (fora das listas, recuperável).';
comment on column public.produtos_formulados.arquivado_em is
  'Quando preenchido, o produto formulado está arquivado (histórico preservado).';

-- Arquiva ou restaura a batida e o produto formulado ligado a ela, juntos.
create or replace function public.set_saved_formula_archived(
  p_formula_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_archived_at timestamptz := case when p_archived then now() else null end;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.saved_formulas
  set arquivada_em = v_archived_at,
      updated_at = now()
  where id = p_formula_id;

  if not found then
    raise exception 'saved formula not found or not authorized' using errcode = 'P0002';
  end if;

  update public.produtos_formulados
  set arquivado_em = v_archived_at
  where saved_formula_id = p_formula_id;
end;
$$;

-- Arquiva ou restaura o produto formulado e, se houver, a batida de origem.
create or replace function public.set_produto_formulado_archived(
  p_produto_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_archived_at timestamptz := case when p_archived then now() else null end;
  v_formula_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.produtos_formulados
  set arquivado_em = v_archived_at
  where id = p_produto_id
  returning saved_formula_id into v_formula_id;

  if not found then
    raise exception 'formulated product not found or not authorized' using errcode = 'P0002';
  end if;

  if v_formula_id is not null then
    update public.saved_formulas
    set arquivada_em = v_archived_at,
        updated_at = now()
    where id = v_formula_id;
  end if;
end;
$$;

revoke all on function public.set_saved_formula_archived(uuid, boolean) from public;
revoke all on function public.set_saved_formula_archived(uuid, boolean) from anon;
grant execute on function public.set_saved_formula_archived(uuid, boolean) to authenticated;

revoke all on function public.set_produto_formulado_archived(uuid, boolean) from public;
revoke all on function public.set_produto_formulado_archived(uuid, boolean) from anon;
grant execute on function public.set_produto_formulado_archived(uuid, boolean) to authenticated;
