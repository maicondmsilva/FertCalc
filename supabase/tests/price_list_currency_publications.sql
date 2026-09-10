-- Fase 1 - moeda, cambio e isolamento das publicacoes de listas.

begin;

insert into public.organizations (id, name, slug)
values ('f0000000-0000-4000-8000-000000000031', 'Price List Test Organization', 'price-list-test');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  'b0000000-0000-4000-8000-000000000031',
  'f0000000-0000-4000-8000-000000000001',
  'price-list-manager@example.test', 'Price List Manager', '', 'manager', '{}'::jsonb,
  '{}'::text[], '{}'::uuid[], true
);

insert into public.price_list_publications (
  id, organization_id, name, competence, revision, currency, exchange_rate, status
) values
  (
    'a0000000-0000-4000-8000-000000000031',
    'f0000000-0000-4000-8000-000000000001',
    'September List', '2026-09-01', 4, 'USD', 5.18, 'published'
  ),
  (
    'a0000000-0000-4000-8000-000000000032',
    'f0000000-0000-4000-8000-000000000031',
    'Other Organization List', '2026-09-01', 1, 'BRL', null, 'draft'
  );

do $$
begin
  begin
    insert into public.price_list_publications (
      organization_id, name, competence, revision, currency, exchange_rate
    ) values (
      'f0000000-0000-4000-8000-000000000001',
      'Invalid USD List', '2026-09-01', 1, 'USD', null
    );
    raise exception 'USD publication without exchange rate unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
end
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

do $$
declare
  visible_other_organization integer;
  inserted_organization uuid;
begin
  select count(*)
  into visible_other_organization
  from public.price_list_publications
  where id = 'a0000000-0000-4000-8000-000000000032';

  if visible_other_organization <> 0 then
    raise exception 'price list publication leaked across organizations';
  end if;

  insert into public.price_list_publications (
    name, competence, revision, currency, status
  ) values (
    'Automatic Tenant List', '2026-10-01', 1, 'BRL', 'draft'
  ) returning organization_id into inserted_organization;

  if inserted_organization <> 'f0000000-0000-4000-8000-000000000001' then
    raise exception 'publication did not inherit the authenticated organization';
  end if;
end
$$;

rollback;
