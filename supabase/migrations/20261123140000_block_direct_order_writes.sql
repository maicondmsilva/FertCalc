-- Etapa B (aplicada depois que a tela passou a usar criar_pedido_venda):
-- ─── Pedidos e itens: sem gravação direta pela tela ─────────────────────────
-- A criação, a edição, os cancelamentos e o recálculo de saldo rodam em funções
-- security definer (current_user = dono das funções). Uma gravação vinda direto
-- da API chega como "authenticated" e é recusada. O privilégio de UPDATE e a
-- regra de UPDATE continuam existindo porque criar_carregamento (que roda com
-- as permissões do usuário) trava o pedido e os itens com SELECT ... FOR UPDATE.
create or replace function private.block_direct_client_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Use as ações da tela de Pedidos de Venda para alterar este registro.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.block_direct_client_write() from public, anon, authenticated;

drop trigger if exists block_direct_client_write on public.pedidos_venda;
create trigger block_direct_client_write
  before insert or update on public.pedidos_venda
  for each row execute function private.block_direct_client_write();

drop trigger if exists block_direct_client_write on public.pedidos_venda_itens;
create trigger block_direct_client_write
  before insert or update or delete on public.pedidos_venda_itens
  for each row execute function private.block_direct_client_write();

revoke insert, delete, truncate, references, trigger
  on public.pedidos_venda_itens from authenticated;
drop policy if exists pedidos_venda_itens_insert_organization on public.pedidos_venda_itens;
drop policy if exists pedidos_venda_itens_delete_organization on public.pedidos_venda_itens;
notify pgrst, 'reload schema';
