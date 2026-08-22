-- FertCalc P0.4: one canonical hierarchy policy for database, UI and Edge Functions.

create or replace function private.role_hierarchy(role_code text)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select hierarchy_level from public.access_levels where code = role_code), 0);
$$;

create or replace function private.can_manage_user(caller_id uuid, target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select caller_id is not null
    and target_id is not null
    and caller_id <> target_id
    and private.app_user_hierarchy(caller_id) >= 80
    and (
      private.app_user_hierarchy(caller_id) > private.app_user_hierarchy(target_id)
      or (
        private.app_user_hierarchy(caller_id) = private.app_user_hierarchy(target_id)
        and private.app_user_hierarchy(caller_id) in (80, 100)
      )
    );
$$;

create or replace function private.can_change_role(
  caller_id uuid,
  target_id uuid,
  new_role text
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_user(caller_id, target_id)
    and private.role_hierarchy(new_role) > 0
    and private.role_hierarchy(new_role) <= private.app_user_hierarchy(caller_id)
    and (private.role_hierarchy(new_role) < 100 or private.app_user_hierarchy(caller_id) = 100);
$$;

create or replace function private.can_assign_role(caller_id uuid, new_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select caller_id is not null
    and private.app_user_hierarchy(caller_id) >= 80
    and private.role_hierarchy(new_role) > 0
    and private.role_hierarchy(new_role) <= private.app_user_hierarchy(caller_id)
    and (private.role_hierarchy(new_role) < 100 or private.app_user_hierarchy(caller_id) = 100);
$$;

create or replace function private.can_delete_user(caller_id uuid, target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_user(caller_id, target_id);
$$;

create or replace function private.can_manage_app_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_user((select auth.uid()), target_user_id);
$$;

create or replace function public.get_current_hierarchy()
returns integer language sql stable security definer set search_path = '' as $$
  select private.app_user_hierarchy((select auth.uid()));
$$;

create or replace function public.can_manage_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_user((select auth.uid()), target_user_id);
$$;

create or replace function public.can_change_role(target_user_id uuid, new_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_change_role((select auth.uid()), target_user_id, new_role);
$$;

create or replace function public.can_assign_role(new_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_assign_role((select auth.uid()), new_role);
$$;

create or replace function public.can_delete_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_delete_user((select auth.uid()), target_user_id);
$$;

-- Legacy RLS helpers now delegate to the same hierarchy source.
create or replace function public.get_user_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.app_users where id = (select auth.uid());
$$;

create or replace function public.is_admin_or_master()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.app_user_hierarchy((select auth.uid())) >= 80;
$$;

create or replace function public.is_manager_or_above()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.app_user_hierarchy((select auth.uid())) >= 60;
$$;

revoke all on function private.role_hierarchy(text) from public, anon, authenticated;
revoke all on function private.can_manage_user(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_change_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.can_assign_role(uuid, text) from public, anon, authenticated;
revoke all on function private.can_delete_user(uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_current_hierarchy() from public, anon;
revoke all on function public.can_manage_user(uuid) from public, anon;
revoke all on function public.can_change_role(uuid, text) from public, anon;
revoke all on function public.can_assign_role(text) from public, anon;
revoke all on function public.can_delete_user(uuid) from public, anon;
grant execute on function public.get_current_hierarchy() to authenticated;
grant execute on function public.can_manage_user(uuid) to authenticated;
grant execute on function public.can_change_role(uuid, text) to authenticated;
grant execute on function public.can_assign_role(text) to authenticated;
grant execute on function public.can_delete_user(uuid) to authenticated;

revoke all on function public.get_user_role() from public, anon;
revoke all on function public.is_admin_or_master() from public, anon;
revoke all on function public.is_manager_or_above() from public, anon;
grant execute on function public.get_user_role() to authenticated;
grant execute on function public.is_admin_or_master() to authenticated;
grant execute on function public.is_manager_or_above() to authenticated;

comment on function public.get_current_hierarchy() is 'Returns the authenticated user hierarchy level.';
comment on function public.can_manage_user(uuid) is 'Canonical user-management authorization decision.';
comment on function public.can_change_role(uuid, text) is 'Canonical role-change authorization decision.';
comment on function public.can_delete_user(uuid) is 'Canonical user-deletion authorization decision.';
