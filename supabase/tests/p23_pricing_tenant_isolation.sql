begin;

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000023', 'P23 Other Organization', 'p23-other');
insert into public.app_users (id, organization_id, email, name, password, role, permissions, managed_user_ids, filiais_permitidas, ativo)
values
  ('b0000000-0000-4000-8000-000000000031', (select id from public.organizations where slug='fertcalc'), 'p23-a@example.test', 'P23 A', '', 'master', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('b0000000-0000-4000-8000-000000000032', 'f0000000-0000-4000-8000-000000000023', 'p23-b@example.test', 'P23 B', '', 'master', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true);
insert into public.pricing_records (organization_id, user_id, date) values ('f0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000032', '2026-08-22');
insert into public.saved_formulas (organization_id, user_id, user_name, name) values ('f0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000032', 'P23 B', 'P23 Formula');
insert into public.goals (organization_id, user_id, user_name, target_value, year) values ('f0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000032', 'P23 B', 100, 2026);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000031","role":"authenticated"}', true);

do $$
declare visible integer; inherited uuid;
begin
  select (select count(*) from public.pricing_records where organization_id='f0000000-0000-4000-8000-000000000023')
       + (select count(*) from public.saved_formulas where organization_id='f0000000-0000-4000-8000-000000000023')
       + (select count(*) from public.goals where organization_id='f0000000-0000-4000-8000-000000000023') into visible;
  if visible <> 0 then raise exception 'pricing data leaked across organizations'; end if;

  insert into public.pricing_records (user_id, date)
  values ('b0000000-0000-4000-8000-000000000031', '2026-08-22') returning organization_id into inherited;
  if inherited <> (select id from public.organizations where slug='fertcalc') then raise exception 'tenant was not inherited'; end if;

  begin
    insert into public.goals (organization_id, user_id, user_name, target_value, year)
    values ('f0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000031', 'P23 A', 100, 2026);
    raise exception 'cross-organization insert succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
