-- Produto (macro ou micro) usado em lista de preço, batida salva ou precificação
-- não é apagado: fica desativado (some das calculadoras e continua nos registros
-- antigos). Sem uso, é excluído. Antes a exclusão apagava sempre e deixava
-- listas e batidas apontando para um produto que não existe mais.

create or replace function private.material_usage_count(p_material_id uuid, p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.price_lists pl
      where pl.organization_id = p_organization_id
        and (coalesce(pl.macros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))
          or coalesce(pl.micros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))))
    + (select count(*) from public.saved_formulas sf
      where sf.organization_id = p_organization_id
        and (coalesce(sf.macros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))
          or coalesce(sf.micros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))))
    + (select count(*) from public.pricing_records pr
      where pr.organization_id = p_organization_id
        and (coalesce(pr.macros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))
          or coalesce(pr.micros, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_material_id::text))
          or strpos(coalesce(pr.calculations::text, ''), p_material_id::text) > 0))::integer;
$$;

revoke all on function private.material_usage_count(uuid, uuid) from public, anon, authenticated;

create or replace function public.excluir_ou_desativar_produto(p_tipo text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  org_id uuid := public.get_current_organization_id();
  tabela text;
  produto_org uuid;
begin
  if actor_id is null or private.app_user_hierarchy(actor_id) < 80 then
    raise exception 'Somente admin ou master pode excluir produtos.' using errcode = '42501';
  end if;

  if p_tipo = 'macro' then
    select organization_id into produto_org from public.macro_materials where id = p_id;
  elsif p_tipo = 'micro' then
    select organization_id into produto_org from public.micro_materials where id = p_id;
  else
    raise exception 'Tipo de produto inválido.' using errcode = '22023';
  end if;

  if produto_org is null or produto_org is distinct from org_id then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;

  if private.material_usage_count(p_id, org_id) > 0 then
    if p_tipo = 'macro' then
      update public.macro_materials set ativo = false, updated_at = now() where id = p_id;
    else
      update public.micro_materials set ativo = false, updated_at = now() where id = p_id;
    end if;
    return 'desativado';
  end if;

  if p_tipo = 'macro' then
    delete from public.macro_materials where id = p_id;
  else
    delete from public.micro_materials where id = p_id;
  end if;
  return 'excluido';
end;
$$;

revoke all on function public.excluir_ou_desativar_produto(text, uuid) from public, anon;
grant execute on function public.excluir_ou_desativar_produto(text, uuid) to authenticated;
