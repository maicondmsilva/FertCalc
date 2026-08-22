-- P0.7 security regression suite.
-- Run against a migrated database with psql/Supabase SQL. Every fixture is rolled back.

begin;

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions, managed_user_ids, filiais_permitidas, ativo
) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'p07-user@example.test', 'P07 User', '', 'user', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'p07-peer@example.test', 'P07 Peer', '', 'user', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'p07-manager@example.test', 'P07 Manager', '', 'manager', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('a0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'p07-admin@example.test', 'P07 Admin', '', 'admin', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true),
  ('a0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'p07-master@example.test', 'P07 Master', '', 'master', '{}'::jsonb, '{}'::text[], '{}'::uuid[], true);

do $$
begin
  if has_function_privilege('anon', 'public.fn_proximo_numero_cotacao()', 'execute') then
    raise exception 'anon can execute the privileged quotation-number function';
  end if;
  if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') then
    raise exception 'anon can execute the RLS event-trigger function';
  end if;
end
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if public.can_change_role('a0000000-0000-4000-8000-000000000001', 'admin') then
    raise exception 'USER was allowed to promote itself to ADMIN';
  end if;

  begin
    update public.app_users
    set role = 'admin'
    where id = 'a0000000-0000-4000-8000-000000000001';
    raise exception 'USER self-promotion update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
declare
  affected integer;
begin
  update public.app_users
  set name = 'unauthorized edit'
  where id = 'a0000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'USER edited another user';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  if public.can_manage_user('a0000000-0000-4000-8000-000000000002') then
    raise exception 'MANAGER was allowed to manage a user outside the team';
  end if;
  if public.can_assign_role('admin') then
    raise exception 'MANAGER was allowed to create an ADMIN';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if public.can_change_role('a0000000-0000-4000-8000-000000000005', 'admin') then
    raise exception 'ADMIN was allowed to alter a MASTER';
  end if;
end
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  begin
    insert into public.audit_logs (user_id, user_name, action, entity_type, entity_id)
    values (
      'a0000000-0000-4000-8000-000000000002',
      'forged user',
      'forged.action',
      'pricing_record',
      'forged-id'
    );
    raise exception 'USER forged a direct audit entry';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
begin
  begin
    insert into public.notifications (user_id, title, message, date, read, type)
    values (
      'a0000000-0000-4000-8000-000000000002',
      'forged notification',
      'forged notification',
      now()::text,
      false,
      'SYSTEM'
    );
    raise exception 'USER created a direct notification for another user';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.send_notification(
      'a0000000-0000-4000-8000-000000000002',
      'SYSTEM',
      'SYSTEM',
      'forged notification',
      'forged notification'
    );
    raise exception 'USER created a notification for an unrelated peer through the RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

rollback;
