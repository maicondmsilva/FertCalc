-- Fase 2: salva a batida e o Produto Formulado na mesma transacao.

create or replace function public.save_formula_with_product(
  p_formula_id uuid,
  p_name text,
  p_target_formula text,
  p_category text,
  p_target_ca numeric,
  p_target_s numeric,
  p_target_micros jsonb,
  p_macros jsonb,
  p_micros jsonb
)
returns public.saved_formulas
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor public.app_users%rowtype;
  v_formula public.saved_formulas%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select *
  into v_actor
  from public.app_users
  where id = (select auth.uid())
    and ativo is true;

  if not found then
    raise exception 'active user profile not found' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'formula name is required' using errcode = '22023';
  end if;

  if p_formula_id is null then
    insert into public.saved_formulas (
      organization_id,
      user_id,
      user_name,
      name,
      date,
      target_formula,
      category,
      target_ca,
      target_s,
      target_micros,
      macros,
      micros
    ) values (
      v_actor.organization_id,
      v_actor.id,
      v_actor.name,
      btrim(p_name),
      now(),
      p_target_formula,
      coalesce(nullif(p_category, ''), 'all'),
      p_target_ca,
      p_target_s,
      coalesce(p_target_micros, '{}'::jsonb),
      coalesce(p_macros, '[]'::jsonb),
      coalesce(p_micros, '[]'::jsonb)
    )
    returning * into v_formula;
  else
    update public.saved_formulas
    set name = btrim(p_name),
        date = now(),
        target_formula = p_target_formula,
        category = coalesce(nullif(p_category, ''), 'all'),
        target_ca = p_target_ca,
        target_s = p_target_s,
        target_micros = coalesce(p_target_micros, '{}'::jsonb),
        macros = coalesce(p_macros, '[]'::jsonb),
        micros = coalesce(p_micros, '[]'::jsonb),
        updated_at = now()
    where id = p_formula_id
    returning * into v_formula;

    if not found then
      raise exception 'saved formula not found or not authorized' using errcode = 'P0002';
    end if;
  end if;

  insert into public.produtos_formulados (
    nome,
    formula_npk,
    saved_formula_id,
    criado_por
  ) values (
    v_formula.name,
    v_formula.target_formula,
    v_formula.id,
    v_actor.id::text
  )
  on conflict (saved_formula_id) do update
  set nome = excluded.nome,
      formula_npk = excluded.formula_npk;

  return v_formula;
end;
$$;

revoke all on function public.save_formula_with_product(uuid, text, text, text, numeric, numeric, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_formula_with_product(uuid, text, text, text, numeric, numeric, jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_formula_with_product(uuid, text, text, text, numeric, numeric, jsonb, jsonb, jsonb) to authenticated;

comment on function public.save_formula_with_product(uuid, text, text, text, numeric, numeric, jsonb, jsonb, jsonb) is
  'Creates or updates a saved formula and synchronizes its formulated product atomically.';
