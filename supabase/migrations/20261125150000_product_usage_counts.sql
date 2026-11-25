-- Quantas vezes cada matéria-prima aparece em listas de preço, batidas salvas e
-- precificações, para a tela de Produtos mostrar "Em uso" e explicar por que a
-- exclusão vira desativação.

create or replace function public.uso_produtos()
returns table (produto_id uuid, usos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.get_current_organization_id();
begin
  if (select auth.uid()) is null or org_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select m.id, private.material_usage_count(m.id, org_id)
  from (
    select mm.id from public.macro_materials mm where mm.organization_id = org_id
    union all
    select mi.id from public.micro_materials mi where mi.organization_id = org_id
  ) m;
end;
$$;

revoke all on function public.uso_produtos() from public, anon;
grant execute on function public.uso_produtos() to authenticated;
