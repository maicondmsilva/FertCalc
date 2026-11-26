-- Etapa 0 (segurança):
-- 1) Níveis de acesso fixos. As regras do banco usam a hierarquia de cada nível
--    (master 100, admin 80, gerente 60...). Um admin podia editar o nível
--    "admin" para 100 (ou criar um nível 100) e ganhar poder de master. A tela
--    "Níveis de Acesso" foi removida e o banco deixa de aceitar alterações.
-- 2) "Salvar precificação" conferido no banco, com a mesma regra da tela:
--    gerente ou acima sempre pode; os demais podem salvo se a permissão
--    calculator_savePricing estiver desligada explicitamente.

drop policy if exists access_levels_write_admin on public.access_levels;
revoke insert, update, delete on public.access_levels from anon, authenticated;

create or replace function private.current_user_permission_allows(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Liberado salvo se a permissão estiver gravada como false.
  select coalesce(
    (
      select coalesce((u.permissions ->> p_permission)::boolean, true)
      from public.app_users u
      where u.id = (select auth.uid()) and u.ativo is true
    ),
    false
  );
$$;
revoke all on function private.current_user_permission_allows(text) from public, anon;
grant execute on function private.current_user_permission_allows(text) to authenticated;

drop policy if exists pricing_insert on public.pricing_records;
create policy pricing_insert on public.pricing_records for insert to authenticated
  with check (
    organization_id = (select public.get_current_organization_id())
    and (
      user_id = ((select auth.uid()))::text
      or private.app_user_hierarchy((select auth.uid())) >= 80
    )
    and (
      private.app_user_hierarchy((select auth.uid())) >= 60
      or private.current_user_permission_allows('calculator_savePricing')
    )
  );
