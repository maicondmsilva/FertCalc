-- Phase 2.2 commercial reference isolation. All fixtures are rolled back.

begin;

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000022', 'P22 Other Organization', 'p22-other');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values
  (
    'b0000000-0000-4000-8000-000000000021',
    'f0000000-0000-4000-8000-000000000001',
    'p22-manager-a@example.test', 'P22 Manager A', '', 'manager', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  ),
  (
    'b0000000-0000-4000-8000-000000000022',
    'f0000000-0000-4000-8000-000000000022',
    'p22-manager-b@example.test', 'P22 Manager B', '', 'manager', '{}'::jsonb,
    '{}'::text[], '{}'::uuid[], true
  );

insert into public.branches (id, organization_id, name)
values
  ('c0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000001', 'P22 Branch A'),
  ('c0000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000022', 'P22 Branch B');

insert into public.clients (id, organization_id, name)
values ('c1000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000022', 'P22 Client B');
insert into public.agents (id, organization_id, name)
values ('c2000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000022', 'P22 Agent B');
insert into public.locais_carregamento (id, organization_id, nome, filial_id)
values (
  'c3000000-0000-4000-8000-000000000022',
  'f0000000-0000-4000-8000-000000000022',
  'P22 Location B',
  'c0000000-0000-4000-8000-000000000022'
);
insert into public.price_lists (id, organization_id, name, date, branch_id, local_carregamento_id)
values (
  'c4000000-0000-4000-8000-000000000022',
  'f0000000-0000-4000-8000-000000000022',
  'P22 Price List B',
  '2026-08-22',
  'c0000000-0000-4000-8000-000000000022',
  'c3000000-0000-4000-8000-000000000022'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

do $$
declare
  visible integer;
  inserted_organization uuid;
begin
  select
    (select count(*) from public.branches where id = 'c0000000-0000-4000-8000-000000000022')
    + (select count(*) from public.clients where id = 'c1000000-0000-4000-8000-000000000022')
    + (select count(*) from public.agents where id = 'c2000000-0000-4000-8000-000000000022')
    + (select count(*) from public.locais_carregamento where id = 'c3000000-0000-4000-8000-000000000022')
    + (select count(*) from public.price_lists where id = 'c4000000-0000-4000-8000-000000000022')
  into visible;
  if visible <> 0 then
    raise exception 'commercial reference data leaked across organizations';
  end if;

  insert into public.clients (name)
  values ('P22 Client Auto Tenant')
  returning organization_id into inserted_organization;
  if inserted_organization <> 'f0000000-0000-4000-8000-000000000001' then
    raise exception 'insert did not inherit the authenticated organization';
  end if;

  begin
    insert into public.agents (organization_id, name)
    values ('f0000000-0000-4000-8000-000000000022', 'P22 Cross Tenant Agent');
    raise exception 'explicit cross-organization insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.clients
    set organization_id = 'f0000000-0000-4000-8000-000000000022'
    where name = 'P22 Client Auto Tenant';
    raise exception 'organization reassignment unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.price_lists (name, date, branch_id)
    values ('P22 Cross Branch Price List', '2026-08-22', 'c0000000-0000-4000-8000-000000000022');
    raise exception 'cross-organization branch reference unexpectedly succeeded';
  exception when foreign_key_violation then
    null;
  end;
end
$$;

rollback;
