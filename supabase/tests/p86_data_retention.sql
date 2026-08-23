begin;

do $$
begin
  if to_regclass('private.data_retention_policies') is null then
    raise exception 'data retention policies table is missing';
  end if;

  if (select count(*) from private.data_retention_policies) <> 4 then
    raise exception 'unexpected retention policy count';
  end if;

  if exists (
    select 1
    from private.data_retention_policies
    where dataset in ('audit_logs', 'audit_log') and enabled
  ) then
    raise exception 'audit retention must remain disabled by default';
  end if;

  if not exists (
    select 1
    from private.data_retention_policies
    where dataset = 'notifications'
      and enabled
      and read_rows_only
      and retention_days = 180
  ) then
    raise exception 'notification retention policy is unsafe or incomplete';
  end if;

  if has_function_privilege('anon', 'private.apply_data_retention(integer)', 'execute')
    or has_function_privilege('authenticated', 'private.apply_data_retention(integer)', 'execute') then
    raise exception 'client roles must not execute retention';
  end if;
end;
$$;

select * from private.preview_data_retention();

rollback;
