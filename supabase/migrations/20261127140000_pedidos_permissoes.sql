-- Pedidos de Venda com permissões próprias:
--   pedidosVenda (ver o módulo), pedidosVenda_create, pedidosVenda_edit,
--   pedidosVenda_cancel (Canc/Substitui e cancelamento de saldo), pedidosVenda_delete.
-- Admin e master (hierarquia >= 80) sempre podem. Quem já usava Pedidos (tinha
-- "Precificações") recebe ver/criar/editar/cancelar para nada mudar hoje.
--
-- As funções que já existiam vão, sem mudança, para private.*_impl; as
-- públicas com o mesmo nome conferem a permissão e chamam a original.
-- (Ao alterar a regra de negócio dessas funções no futuro, altere a *_impl.)

create or replace function private.pedido_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.app_user_hierarchy((select auth.uid())) >= 80
      or private.current_user_has_permission(p_permissao);
$$;
revoke all on function private.pedido_permissao(text) from public, anon;
grant execute on function private.pedido_permissao(text) to authenticated;

create or replace function private.exigir_permissao_pedido(p_permissao text, p_acao text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pedido_permissao(p_permissao) then
    raise exception 'Seu usuário não tem permissão para %.', p_acao using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.exigir_permissao_pedido(text, text) from public, anon;

-- Quem já usava o módulo continua usando.
update public.app_users
   set permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object(
         'pedidosVenda', true, 'pedidosVenda_create', true,
         'pedidosVenda_edit', true, 'pedidosVenda_cancel', true)
 where coalesce(permissions ->> 'history', 'true') <> 'false'
   and role not in ('transportadora')
   and not (coalesce(permissions, '{}'::jsonb) ? 'pedidosVenda');

update public.access_profiles
   set permissions = permissions || jsonb_build_object(
         'pedidosVenda', true, 'pedidosVenda_create', true,
         'pedidosVenda_edit', true, 'pedidosVenda_cancel', true)
 where (permissions ->> 'history')::boolean is true
   and not (permissions ? 'pedidosVenda');

-- ── Funções originais → private.*_impl ───────────────────────────────────
alter function public.criar_pedido_venda(jsonb, jsonb) rename to criar_pedido_venda_impl;
alter function public.criar_pedido_venda_impl(jsonb, jsonb) set schema private;

alter function public.update_pedido_venda_protegido(uuid, timestamptz, text, jsonb, jsonb, boolean)
  rename to update_pedido_venda_protegido_impl;
alter function public.update_pedido_venda_protegido_impl(uuid, timestamptz, text, jsonb, jsonb, boolean)
  set schema private;

alter function public.atualizar_dados_comerciais_pedido(uuid, text, date, text, text)
  rename to atualizar_dados_comerciais_pedido_impl;
alter function public.atualizar_dados_comerciais_pedido_impl(uuid, text, date, text, text)
  set schema private;

alter function public.alterar_endereco_entrega_pedido(uuid, text, text, text, text, text)
  rename to alterar_endereco_entrega_pedido_impl;
alter function public.alterar_endereco_entrega_pedido_impl(uuid, text, text, text, text, text)
  set schema private;

alter function public.executar_pedido_canc_substitui(uuid, numeric, text, text, jsonb)
  rename to executar_pedido_canc_substitui_impl;
alter function public.executar_pedido_canc_substitui_impl(uuid, numeric, text, text, jsonb)
  set schema private;

alter function public.executar_pedido_cancelamento_definitivo(uuid, numeric, text)
  rename to executar_pedido_cancelamento_definitivo_impl;
alter function public.executar_pedido_cancelamento_definitivo_impl(uuid, numeric, text)
  set schema private;

revoke all on function private.criar_pedido_venda_impl(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.update_pedido_venda_protegido_impl(uuid, timestamptz, text, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function private.atualizar_dados_comerciais_pedido_impl(uuid, text, date, text, text) from public, anon, authenticated;
revoke all on function private.alterar_endereco_entrega_pedido_impl(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.executar_pedido_canc_substitui_impl(uuid, numeric, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.executar_pedido_cancelamento_definitivo_impl(uuid, numeric, text) from public, anon, authenticated;

-- ── Funções públicas: conferem a permissão e chamam a original ────────────
create function public.criar_pedido_venda(p_pedido jsonb, p_itens jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_create', 'criar pedidos de venda');
  return private.criar_pedido_venda_impl(p_pedido, p_itens);
end;
$$;

create function public.update_pedido_venda_protegido(
  p_pedido_id uuid, p_expected_updated_at timestamptz, p_reason text,
  p_header jsonb, p_items jsonb, p_force boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_edit', 'editar pedidos de venda');
  return private.update_pedido_venda_protegido_impl(
    p_pedido_id, p_expected_updated_at, p_reason, p_header, p_items, p_force);
end;
$$;

create function public.atualizar_dados_comerciais_pedido(
  p_pedido_id uuid, p_safra text, p_previsao_entrega date, p_local_entrega text, p_numero_contrato text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_edit', 'editar pedidos de venda');
  perform private.atualizar_dados_comerciais_pedido_impl(
    p_pedido_id, p_safra, p_previsao_entrega, p_local_entrega, p_numero_contrato);
end;
$$;

create function public.alterar_endereco_entrega_pedido(
  p_pedido_id uuid, p_endereco text, p_cidade text, p_estado text, p_maps_url text, p_motivo text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_edit', 'editar pedidos de venda');
  perform private.alterar_endereco_entrega_pedido_impl(
    p_pedido_id, p_endereco, p_cidade, p_estado, p_maps_url, p_motivo);
end;
$$;

create function public.executar_pedido_canc_substitui(
  p_pedido_origem_id uuid, p_quantidade numeric, p_produto_nome text, p_motivo text, p_filho jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_cancel', 'cancelar ou substituir pedidos');
  return private.executar_pedido_canc_substitui_impl(
    p_pedido_origem_id, p_quantidade, p_produto_nome, p_motivo, p_filho);
end;
$$;

create function public.executar_pedido_cancelamento_definitivo(
  p_pedido_id uuid, p_quantidade numeric, p_motivo text
)
returns numeric language plpgsql security definer set search_path = '' as $$
begin
  perform private.exigir_permissao_pedido('pedidosVenda_cancel', 'cancelar saldo de pedidos');
  return private.executar_pedido_cancelamento_definitivo_impl(p_pedido_id, p_quantidade, p_motivo);
end;
$$;

revoke all on function public.criar_pedido_venda(jsonb, jsonb) from public, anon;
revoke all on function public.update_pedido_venda_protegido(uuid, timestamptz, text, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.atualizar_dados_comerciais_pedido(uuid, text, date, text, text) from public, anon;
revoke all on function public.alterar_endereco_entrega_pedido(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.executar_pedido_canc_substitui(uuid, numeric, text, text, jsonb) from public, anon;
revoke all on function public.executar_pedido_cancelamento_definitivo(uuid, numeric, text) from public, anon;
grant execute on function public.criar_pedido_venda(jsonb, jsonb) to authenticated;
grant execute on function public.update_pedido_venda_protegido(uuid, timestamptz, text, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.atualizar_dados_comerciais_pedido(uuid, text, date, text, text) to authenticated;
grant execute on function public.alterar_endereco_entrega_pedido(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.executar_pedido_canc_substitui(uuid, numeric, text, text, jsonb) to authenticated;
grant execute on function public.executar_pedido_cancelamento_definitivo(uuid, numeric, text) to authenticated;

-- Excluir: admin/master ou a permissão própria.
drop policy if exists pedidos_venda_delete_organization on public.pedidos_venda;
create policy pedidos_venda_delete_organization on public.pedidos_venda for delete to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and private.pedido_permissao('pedidosVenda_delete')
  );
