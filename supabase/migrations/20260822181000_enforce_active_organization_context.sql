-- Inactive organizations must not produce an authenticated tenant context.

create or replace function private.user_organization(user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select au.organization_id
  from public.app_users au
  join public.organizations organization on organization.id = au.organization_id
  where au.id = user_id
    and coalesce(au.ativo, true)
    and organization.active;
$$;

revoke all on function private.user_organization(uuid) from public, anon, authenticated;
