-- Match the legacy text[] type used by app_users.managed_user_ids.
create or replace function private.can_send_notification(
  target_user_id uuid,
  notification_group text,
  notification_type text,
  entity_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_hierarchy integer;
  target_hierarchy integer;
begin
  if caller_id is null or target_user_id is null then return false; end if;
  if caller_id = target_user_id then return true; end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  target_hierarchy := private.app_user_hierarchy(target_user_id);
  if caller_hierarchy >= 50 then return true; end if;

  if exists (
    select 1 from public.app_users au
    where (au.id = caller_id and target_user_id::text = any(coalesce(au.managed_user_ids, '{}'::text[])))
       or (au.id = target_user_id and caller_id::text = any(coalesce(au.managed_user_ids, '{}'::text[])))
  ) then return true; end if;

  if target_hierarchy >= 50
    and upper(coalesce(notification_group, '')) in ('PRICING', 'CARREGAMENTO', 'SYSTEM') then
    return true;
  end if;

  if upper(coalesce(notification_group, '')) = 'TRANSFER'
    or lower(coalesce(notification_type, '')) = 'pricing_transfer' then
    return exists (
      select 1 from public.pricing_records pr
      where pr.id::text = entity_id
        and (
          (pr.user_id::text = caller_id::text and pr.transfer_to_user_id::text = target_user_id::text)
          or (
            pr.user_id::text = caller_id::text
            and exists (
              select 1 from jsonb_array_elements(coalesce(pr.history, '[]'::jsonb)) history_entry
              where history_entry ->> 'userId' = target_user_id::text
                and history_entry ->> 'action' like 'Transferência iniciada%'
            )
          )
        )
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_send_notification(uuid, text, text, text)
  from public, anon, authenticated;
