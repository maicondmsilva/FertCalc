-- Clientes e agentes (representantes):
-- 1) Políticas alinhadas às permissões da tela. Antes a tela liberava criar,
--    editar e excluir pela permissão (clients_create, ...) mas o banco exigia
--    gestor (criar/editar) ou admin (excluir): quem tinha a permissão via
--    "Erro ao salvar". Agora vale o nível OU a permissão concedida.
-- 2) Código sequencial gerado no banco, por organização, com trava: antes a
--    tela lia todos os códigos e somava 1, e dois cadastros ao mesmo tempo
--    ganhavam o mesmo código. Índice único impede repetição.

-- Políticas -----------------------------------------------------------------
drop policy if exists clients_insert_organization on public.clients;
drop policy if exists clients_update_organization on public.clients;
drop policy if exists clients_delete_organization on public.clients;
drop policy if exists agents_insert_organization on public.agents;
drop policy if exists agents_update_organization on public.agents;
drop policy if exists agents_delete_organization on public.agents;

create policy clients_insert_organization on public.clients for insert to authenticated
  with check (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('clients_create'))
  );
create policy clients_update_organization on public.clients for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('clients_edit'))
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('clients_edit'))
  );
create policy clients_delete_organization on public.clients for delete to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 80
         or private.current_user_has_permission('clients_delete'))
  );

create policy agents_insert_organization on public.agents for insert to authenticated
  with check (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('agents_create'))
  );
create policy agents_update_organization on public.agents for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('agents_edit'))
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 60
         or private.current_user_has_permission('agents_edit'))
  );
create policy agents_delete_organization on public.agents for delete to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (private.app_user_hierarchy((select auth.uid())) >= 80
         or private.current_user_has_permission('agents_delete'))
  );

-- Código sequencial ---------------------------------------------------------
create or replace function private.assign_registry_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_code bigint;
begin
  if new.code is not null and btrim(new.code) <> '' then
    new.code := btrim(new.code);
    return new;
  end if;
  -- Uma geração por vez, por tabela e organização.
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || coalesce(new.organization_id::text, '')));
  execute format(
    'select coalesce(max(code::bigint), 0) + 1 from public.%I
      where organization_id is not distinct from $1 and code ~ ''^\d{1,15}$''',
    tg_table_name
  ) into next_code using new.organization_id;
  new.code := next_code::text;
  return new;
end;
$$;

revoke all on function private.assign_registry_code() from public, anon, authenticated;

-- Nome começa com "set_" para rodar depois de enforce_*_organization (ordem alfabética),
-- que preenche organization_id.
drop trigger if exists set_client_code on public.clients;
create trigger set_client_code before insert on public.clients
  for each row execute function private.assign_registry_code();
drop trigger if exists set_agent_code on public.agents;
create trigger set_agent_code before insert on public.agents
  for each row execute function private.assign_registry_code();

-- O código não muda depois de criado.
create or replace function private.keep_registry_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := old.code;
  return new;
end;
$$;
revoke all on function private.keep_registry_code() from public, anon, authenticated;
drop trigger if exists keep_client_code on public.clients;
create trigger keep_client_code before update of code on public.clients
  for each row execute function private.keep_registry_code();
drop trigger if exists keep_agent_code on public.agents;
create trigger keep_agent_code before update of code on public.agents
  for each row execute function private.keep_registry_code();

create unique index if not exists clients_organization_code_key
  on public.clients (organization_id, code) where code is not null and code <> '';
create unique index if not exists agents_organization_code_key
  on public.agents (organization_id, code) where code is not null and code <> '';
