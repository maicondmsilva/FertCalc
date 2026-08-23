begin;

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000071', 'P71 Other Organization', 'p71-other');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
)
values
  (
    'b0000000-0000-4000-8000-000000000071',
    (select id from public.organizations where slug = 'fertcalc'),
    'p71-allowed@example.test', 'P71 Allowed', '', 'user',
    '{"managementReports":true}'::jsonb, '{}'::text[], '{}'::uuid[], true
  ),
  (
    'b0000000-0000-4000-8000-000000000072',
    (select id from public.organizations where slug = 'fertcalc'),
    'p71-denied@example.test', 'P71 Denied', '', 'user',
    '{}'::jsonb, '{}'::text[], '{}'::uuid[], true
  );

insert into public.management_categorias (id, organization_id, nome, ordem)
values (
  'c0000000-0000-4000-8000-000000000071',
  'f0000000-0000-4000-8000-000000000071',
  'P71 Hidden Category',
  1
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000071","role":"authenticated"}',
  true
);

do $$
declare
  visible integer;
  inherited uuid;
begin
  select count(*) into visible
  from public.management_categorias
  where organization_id = 'f0000000-0000-4000-8000-000000000071';
  if visible <> 0 then
    raise exception 'management report data leaked across organizations';
  end if;

  insert into public.management_categorias (id, nome, ordem)
  values ('c0000000-0000-4000-8000-000000000072', 'P71 Own Category', 2)
  returning organization_id into inherited;
  if inherited <> (select id from public.organizations where slug = 'fertcalc') then
    raise exception 'management report tenant was not inherited';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000072","role":"authenticated"}',
  true
);

do $$
declare
  visible integer;
begin
  select count(*) into visible from public.management_categorias;
  if visible <> 0 then
    raise exception 'user without managementReports permission read management data';
  end if;

  begin
    insert into public.management_categorias (id, nome, ordem)
    values ('c0000000-0000-4000-8000-000000000073', 'P71 Forbidden Category', 3);
    raise exception 'user without managementReports permission wrote management data';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

do $$
declare
  unsafe_policy_count integer;
  anonymous_privilege_count integer;
begin
  select count(*) into unsafe_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename like 'management_%'
    and roles @> array['public']::name[];
  if unsafe_policy_count <> 0 then
    raise exception 'public management report policies remain';
  end if;

  select count(*) into anonymous_privilege_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name like 'management_%'
    and grantee = 'anon';
  if anonymous_privilege_count <> 0 then
    raise exception 'anon still has management report privileges';
  end if;
end
$$;

rollback;
