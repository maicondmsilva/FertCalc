-- Listas de preço: excluir só quando nunca foi usada; usada vira arquivada.
-- "Usada" = alguma precificação salva aponta para a lista (no cabeçalho ou em
-- qualquer fórmula) ou o histórico de preços de produtos formulados a cita.

alter table public.price_lists
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_por uuid references public.app_users(id) on delete set null;

create index if not exists price_lists_organization_arquivado_idx
  on public.price_lists (organization_id, arquivado_em);

create or replace function private.price_list_usage_count(p_list_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from public.pricing_records record
    where record.factors ->> 'priceListId' = p_list_id::text
       or exists (
         select 1
         from jsonb_array_elements(
           case when jsonb_typeof(record.calculations) = 'array'
             then record.calculations else '[]'::jsonb end
         ) calculation
         where calculation -> 'factors' ->> 'priceListId' = p_list_id::text
       )
  )::integer + (
    select count(*)
    from public.historico_precos_formulados historico
    where historico.price_list_id::text = p_list_id::text
  )::integer;
$$;
revoke all on function private.price_list_usage_count(uuid) from public, anon, authenticated;

-- Exclui a lista se nunca foi usada; se já foi usada, arquiva.
-- Retorna 'excluida' ou 'arquivada'.
create or replace function public.excluir_ou_arquivar_lista_preco(p_list_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_list public.price_lists%rowtype;
begin
  if v_user_id is null or v_org is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if private.app_user_hierarchy(v_user_id) < 60 then
    raise exception 'Somente gerente ou acima pode excluir ou arquivar listas de preço.'
      using errcode = '42501';
  end if;

  select * into v_list
  from public.price_lists
  where id = p_list_id and organization_id = v_org
  for update;
  if not found then
    raise exception 'Lista de preço não encontrada.' using errcode = 'P0002';
  end if;

  if private.price_list_usage_count(v_list.id) > 0 then
    update public.price_lists
    set arquivado_em = coalesce(arquivado_em, now()),
        arquivado_por = coalesce(arquivado_por, v_user_id),
        updated_at = now()
    where id = v_list.id;
    perform public.write_audit_log_entry(
      'price_lists', v_list.id::text, 'UPDATE', to_jsonb(v_list), null,
      array['arquivado_em'], 'Lista com precificações salvas: arquivada em vez de excluída.'
    );
    return 'arquivada';
  end if;

  delete from public.price_lists where id = v_list.id;
  perform public.write_audit_log_entry(
    'price_lists', v_list.id::text, 'DELETE', to_jsonb(v_list), null, null,
    'Lista sem nenhum lançamento: excluída.'
  );
  return 'excluida';
end;
$$;
revoke all on function public.excluir_ou_arquivar_lista_preco(uuid) from public, anon;
grant execute on function public.excluir_ou_arquivar_lista_preco(uuid) to authenticated;

create or replace function public.restaurar_lista_preco(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
begin
  if v_user_id is null or v_org is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if private.app_user_hierarchy(v_user_id) < 60 then
    raise exception 'Somente gerente ou acima pode restaurar listas de preço.'
      using errcode = '42501';
  end if;
  update public.price_lists
  set arquivado_em = null, arquivado_por = null, updated_at = now()
  where id = p_list_id and organization_id = v_org;
  if not found then
    raise exception 'Lista de preço não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.restaurar_lista_preco(uuid) from public, anon;
grant execute on function public.restaurar_lista_preco(uuid) to authenticated;

-- Exclusão só pela função acima (que confere se a lista foi usada).
drop policy if exists price_lists_delete_organization on public.price_lists;
revoke delete, truncate on public.price_lists from authenticated;

notify pgrst, 'reload schema';
