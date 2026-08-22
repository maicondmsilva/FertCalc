-- Phase 2.1 organization isolation regression suite. Fixtures are rolled back.

begin;

insert into public.organizations (id, name, slug)
values
  ('f0000000-0000-4000-8000-000000000002', 'P21 Other Organization', 'p21-other'),
  ('f0000000-0000-4000-8000-000000000003', 'P21 Inactive Organization', 'p21-inactive');

update public.organizations
set active = false
where id = 'f0000000-0000-4000-8000-000000000003';

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  (
    'b0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000001',
    'p21-admin-a@example.test', 'P21 Admin A', '', 'admin', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'f0000000-0000-4000-8000-000000000002',
    'p21-admin-b@example.test', 'P21 Admin B', '', 'admin', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'f0000000-0000-4000-8000-000000000002',
    'p21-user-b@example.test', 'P21 User B', '', 'user', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  ),
  (
    'b0000000-0000-4000-8000-000000000004',
    'f0000000-0000-4000-8000-000000000003',
    'p21-user-inactive@example.test', 'P21 Inactive User', '', 'user', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  visible integer;
  affected integer;
begin
  if public.get_current_organization_id() <> 'f0000000-0000-4000-8000-000000000001' then
    raise exception 'current organization context is incorrect';
  end if;

  select count(*) into visible
  from public.app_users
  where id in (
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003'
  );
  if visible <> 0 then
    raise exception 'users from another organization are visible';
  end if;

  select count(*) into visible
  from public.organizations
  where id = 'f0000000-0000-4000-8000-000000000002';
  if visible <> 0 then
    raise exception 'another organization is visible';
  end if;

  if public.can_manage_user('b0000000-0000-4000-8000-000000000003') then
    raise exception 'admin can manage a user from another organization';
  end if;

  update public.organizations
  set name = 'P21 Own Organization Updated'
  where id = 'f0000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'admin could not update its own organization name';
  end if;

  update public.organizations
  set name = 'P21 Cross Organization Update'
  where id = 'f0000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'admin updated another organization';
  end if;

  begin
    update public.app_users
    set organization_id = 'f0000000-0000-4000-8000-000000000002'
    where id = 'b0000000-0000-4000-8000-000000000001';
    raise exception 'user organization reassignment unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if public.get_current_organization_id() is not null then
    raise exception 'inactive organization produced an active tenant context';
  end if;
end
$$;

rollback;
