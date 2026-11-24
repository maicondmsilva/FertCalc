-- O registro de auditoria de listas de preço é gravado direto em audit_log:
-- write_audit_log_entry só aceita as tabelas de carregamento.
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
  v_user_name text;
begin
  if v_user_id is null or v_org is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if private.app_user_hierarchy(v_user_id) < 60 then
    raise exception 'Somente gerente ou acima pode excluir ou arquivar listas de preço.'
      using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(nickname), ''), name) into v_user_name
  from public.app_users where id = v_user_id;

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
    insert into public.audit_log (
      tabela, registro_id, acao, dados_anteriores, campos_alterados, motivo, usuario_id, usuario_nome
    ) values (
      'price_lists', v_list.id::text, 'UPDATE', to_jsonb(v_list), array['arquivado_em'],
      'Lista com precificações salvas: arquivada em vez de excluída.', v_user_id, v_user_name
    );
    return 'arquivada';
  end if;

  delete from public.price_lists where id = v_list.id;
  insert into public.audit_log (
    tabela, registro_id, acao, dados_anteriores, motivo, usuario_id, usuario_nome
  ) values (
    'price_lists', v_list.id::text, 'DELETE', to_jsonb(v_list),
    'Lista sem nenhum lançamento: excluída.', v_user_id, v_user_name
  );
  return 'excluida';
end;
$$;
revoke all on function public.excluir_ou_arquivar_lista_preco(uuid) from public, anon;
grant execute on function public.excluir_ou_arquivar_lista_preco(uuid) to authenticated;

notify pgrst, 'reload schema';
