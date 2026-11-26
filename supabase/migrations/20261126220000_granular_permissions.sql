-- Etapa 3B: permissões próprias de criar/editar/excluir onde faltavam.
-- Quem já fazia a ação continua fazendo (as permissões são preenchidas a partir
-- do comportamento atual); daqui para frente, é a permissão que manda.
-- Admin e master (hierarquia >= 80) sempre podem.

-- ── Metas ────────────────────────────────────────────────────────────────
-- Antes: gerente gerenciava pelo nível, e o próprio vendedor conseguia editar
-- ou excluir a sua meta já aprovada direto no banco.
--  • Vendedor: propõe a própria meta (Pendente) e exclui enquanto pendente.
--  • goals_create: cria metas para os usuários que gerencia.
--  • goals_edit: aprova/reprova/altera metas dos outros (nunca a própria).
--  • goals_delete: exclui metas dos usuários que gerencia.
update public.app_users
   set permissions = coalesce(permissions, '{}'::jsonb)
       || '{"goals_create": true, "goals_edit": true, "goals_delete": true}'::jsonb
 where role = 'manager'
   and not (coalesce(permissions, '{}'::jsonb) ? 'goals_create');

drop policy if exists goals_insert on public.goals;
drop policy if exists goals_update on public.goals;
drop policy if exists goals_delete on public.goals;

create policy goals_insert on public.goals for insert to authenticated
  with check (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or (user_id = (select auth.uid())::text and status = 'Pendente')
      or (private.current_user_has_permission('goals_create')
          and private.can_access_user_data(user_id))
    )
  );

create policy goals_update on public.goals for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or (private.current_user_has_permission('goals_edit')
          and private.can_access_user_data(user_id)
          and user_id <> (select auth.uid())::text)
    )
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or (private.current_user_has_permission('goals_edit')
          and private.can_access_user_data(user_id)
          and user_id <> (select auth.uid())::text)
    )
  );

create policy goals_delete on public.goals for delete to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or (user_id = (select auth.uid())::text and status = 'Pendente')
      or (private.current_user_has_permission('goals_delete')
          and private.can_access_user_data(user_id))
    )
  );

-- ── Transportadoras ──────────────────────────────────────────────────────
-- Antes: gerente, "Administrar o módulo" ou "Tratar cotações". Passa a ser
-- transportadoras_create / transportadoras_edit (editar inclui desativar).
update public.app_users
   set permissions = coalesce(permissions, '{}'::jsonb)
       || '{"transportadoras_create": true, "transportadoras_edit": true}'::jsonb
 where (role = 'manager'
        or (permissions ->> 'carregamento_admin')::boolean is true
        or (permissions ->> 'carregamento_tratar_cotacao')::boolean is true)
   and not (coalesce(permissions, '{}'::jsonb) ? 'transportadoras_create');

update public.access_profiles
   set permissions = permissions
       || '{"transportadoras_create": true, "transportadoras_edit": true}'::jsonb
 where ((permissions ->> 'carregamento_admin')::boolean is true
        or (permissions ->> 'carregamento_tratar_cotacao')::boolean is true)
   and not (permissions ? 'transportadoras_create');

drop policy if exists transportadoras_insert_management on public.transportadoras;
drop policy if exists transportadoras_update_management on public.transportadoras;

create policy transportadoras_insert_management on public.transportadoras for insert to authenticated
  with check (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or private.current_user_has_permission('transportadoras_create')
    )
  );

create policy transportadoras_update_management on public.transportadoras for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or private.current_user_has_permission('transportadoras_edit')
    )
  )
  with check (
    organization_id = (select public.get_current_organization_id())
    and (
      private.app_user_hierarchy((select auth.uid())) >= 80
      or private.current_user_has_permission('transportadoras_edit')
    )
  );

-- ── Precificações: excluir ───────────────────────────────────────────────
-- Antes, quem podia "Alterar status" podia excluir. Agora há history_delete;
-- sem ela definida, vale a regra antiga (Alterar status, liberado por padrão).
create or replace function private.guard_pricing_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level integer;
  actor_permissions jsonb;
begin
  if actor_id is null then
    return new;
  end if;

  if new.status = 'Excluída' and old.status is distinct from 'Excluída' then
    actor_level := private.app_user_hierarchy(actor_id);

    if actor_level < 80 then
      select coalesce(u.permissions, '{}'::jsonb) into actor_permissions
        from public.app_users u where u.id = actor_id;
      if not coalesce(
        (actor_permissions ->> 'history_delete')::boolean,
        (actor_permissions ->> 'history_changeStatus')::boolean,
        true
      ) then
        raise exception 'Seu usuário não tem permissão para excluir precificações.'
          using errcode = '42501';
      end if;
    end if;

    if old.approval_status = 'Aprovada' then
      if actor_level < 60 then
        raise exception 'Precificação aprovada só pode ser excluída pela aprovação de exclusão.'
          using errcode = '42501';
      end if;
      if old.user_id = actor_id::text and actor_level < 80 then
        raise exception 'A exclusão da própria precificação aprovada precisa ser aprovada por outra pessoa.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;
