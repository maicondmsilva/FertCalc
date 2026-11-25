-- Excluir nutriente do cadastro: só quando nenhum produto (macro ou micro) usa a
-- garantia; em uso, a exclusão é recusada com a quantidade de produtos (desativar
-- continua possível). A exclusão direta pela API deixa de ser permitida.

create or replace function public.excluir_nutriente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  org_id uuid := public.get_current_organization_id();
  alvo public.nutrientes;
  em_uso integer;
begin
  if actor_id is null or private.app_user_hierarchy(actor_id) < 80 then
    raise exception 'Somente admin ou master pode excluir nutrientes.' using errcode = '42501';
  end if;

  select * into alvo from public.nutrientes where id = p_id and organization_id = org_id;
  if alvo.id is null then
    raise exception 'Nutriente não encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into em_uso
  from (
    select m.organization_id, m.micro_guarantees from public.macro_materials m
    where m.organization_id = org_id
    union all
    select m.organization_id, m.micro_guarantees from public.micro_materials m
    where m.organization_id = org_id
  ) produto
  where exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(produto.micro_guarantees) = 'array'
        then produto.micro_guarantees else '[]'::jsonb end
    ) g
    where upper(btrim(g ->> 'name')) = upper(btrim(alvo.sigla))
       or upper(btrim(g ->> 'name')) = upper(btrim(alvo.nome))
       or upper(btrim(g ->> 'name')) = any (alvo.aliases)
  );

  if em_uso > 0 then
    raise exception 'O nutriente % está nas garantias de % produto(s). Remova a garantia desses produtos ou desative o nutriente.',
      alvo.sigla, em_uso
      using errcode = '23503';
  end if;

  delete from public.nutrientes where id = alvo.id;
end;
$$;

revoke all on function public.excluir_nutriente(uuid) from public, anon;
grant execute on function public.excluir_nutriente(uuid) to authenticated;

revoke delete on public.nutrientes from authenticated;
