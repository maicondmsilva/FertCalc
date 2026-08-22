begin;

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000024', 'P24 Other Organization', 'p24-other');
insert into public.app_users (id, organization_id, email, name, password, role, permissions, managed_user_ids, filiais_permitidas, ativo)
values ('b0000000-0000-4000-8000-000000000041', (select id from public.organizations where slug='fertcalc'), 'p24-a@example.test', 'P24 A', '', 'master', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true);
insert into public.brands (id, organization_id, name)
values ('c0000000-0000-4000-8000-000000000041', 'f0000000-0000-4000-8000-000000000024', 'P24 Brand B');
insert into public.macro_materials (id, organization_id, name, brand_id)
values ('c1000000-0000-4000-8000-000000000041', 'f0000000-0000-4000-8000-000000000024', 'P24 Macro B', 'c0000000-0000-4000-8000-000000000041');
insert into public.micro_materials (id, organization_id, name)
values ('c2000000-0000-4000-8000-000000000041', 'f0000000-0000-4000-8000-000000000024', 'P24 Micro B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000041","role":"authenticated"}', true);

do $$
declare visible integer; inherited uuid;
begin
  select (select count(*) from public.brands where organization_id='f0000000-0000-4000-8000-000000000024')
       + (select count(*) from public.macro_materials where organization_id='f0000000-0000-4000-8000-000000000024')
       + (select count(*) from public.micro_materials where organization_id='f0000000-0000-4000-8000-000000000024') into visible;
  if visible <> 0 then raise exception 'material catalog leaked across organizations'; end if;

  insert into public.brands (name) values ('P24 Brand Auto Tenant') returning organization_id into inherited;
  if inherited <> (select id from public.organizations where slug='fertcalc') then raise exception 'tenant was not inherited'; end if;

  begin
    insert into public.macro_materials (name, brand_id)
    values ('P24 Cross Brand Macro', 'c0000000-0000-4000-8000-000000000041');
    raise exception 'cross-organization brand reference succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.micro_materials (organization_id, name)
    values ('f0000000-0000-4000-8000-000000000024', 'P24 Cross Tenant Micro');
    raise exception 'cross-organization insert succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
