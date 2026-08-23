-- Fase 8.4: runtime incidents must be immutable and bound to the authenticated user.

begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions, managed_user_ids, filiais_permitidas, ativo
) values
  ('a4000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'p84-user@example.test', 'P84 User', '', 'user', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('a4000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'p84-admin@example.test', 'P84 Admin', '', 'admin', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.runtime_error_events (incident_id, source, message, path)
values ('FERT-P84-OWN', 'react-error-boundary', 'expected test incident', '/test');

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.runtime_error_events
  where incident_id = 'FERT-P84-OWN';

  if visible_count <> 0 then
    raise exception 'ordinary user can read runtime incidents';
  end if;

  begin
    insert into public.runtime_error_events (incident_id, user_id, source, message)
    values (
      'FERT-P84-FORGED',
      'a4000000-0000-4000-8000-000000000002',
      'react-error-boundary',
      'forged incident'
    );
    raise exception 'ordinary user forged runtime incident identity';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.runtime_error_events where incident_id = 'FERT-P84-OWN';
    raise exception 'ordinary user deleted an immutable runtime incident';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.runtime_error_events
  where incident_id = 'FERT-P84-OWN';

  if visible_count <> 1 then
    raise exception 'admin cannot read runtime incidents';
  end if;
end
$$;

rollback;
