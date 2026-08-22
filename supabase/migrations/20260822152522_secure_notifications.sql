-- FertCalc P0.3: reconcile the notification schema and centralize trusted delivery.

alter table public.notifications
  add column if not exists group_type text,
  add column if not exists action_url text,
  add column if not exists is_read boolean not null default false,
  add column if not exists metadata jsonb,
  add column if not exists sender_id uuid,
  add column if not exists sender_name text;

update public.notifications
set is_read = coalesce(read, false)
where is_read is distinct from coalesce(read, false);

create index if not exists idx_notifications_recipient_created_at
  on public.notifications (user_id, created_at desc);

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
  if caller_id is null or target_user_id is null then
    return false;
  end if;

  if caller_id = target_user_id then
    return true;
  end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  target_hierarchy := private.app_user_hierarchy(target_user_id);

  -- Managers and administrators may deliver business notifications.
  if caller_hierarchy >= 50 then
    return true;
  end if;

  -- A user may communicate only inside their explicit management chain.
  if exists (
    select 1
    from public.app_users au
    where (au.id = caller_id and target_user_id::text = any(coalesce(au.managed_user_ids, '{}'::text[])))
       or (au.id = target_user_id and caller_id::text = any(coalesce(au.managed_user_ids, '{}'::text[])))
  ) then
    return true;
  end if;

  -- Operational users may alert an active responsible manager, but not peers.
  if target_hierarchy >= 50
    and upper(coalesce(notification_group, '')) in ('PRICING', 'CARREGAMENTO', 'SYSTEM') then
    return true;
  end if;

  -- Peer delivery is allowed only for a transfer recorded on the pricing entity.
  if upper(coalesce(notification_group, '')) = 'TRANSFER'
    or lower(coalesce(notification_type, '')) = 'pricing_transfer' then
    return exists (
      select 1
      from public.pricing_records pr
      where pr.id::text = entity_id
        and (
          (pr.user_id::text = caller_id::text and pr.transfer_to_user_id::text = target_user_id::text)
          or (
            pr.user_id::text = caller_id::text
            and exists (
              select 1
              from jsonb_array_elements(coalesce(pr.history, '[]'::jsonb)) history_entry
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

create or replace function public.send_notification(
  p_user_id uuid,
  p_type text,
  p_group_type text,
  p_title text,
  p_message text,
  p_action_url text default null,
  p_data_id text default null,
  p_metadata jsonb default null
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  created_notification public.notifications;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(au.nickname), ''), au.name)
    into caller_name
  from public.app_users au
  where au.id = caller_id and coalesce(au.ativo, true);

  if caller_name is null then
    raise exception 'active application user required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.app_users au
    where au.id = p_user_id and coalesce(au.ativo, true)
  ) then
    raise exception 'active recipient required' using errcode = '22023';
  end if;

  if nullif(btrim(p_type), '') is null
    or nullif(btrim(p_title), '') is null
    or nullif(btrim(p_message), '') is null then
    raise exception 'type, title and message are required' using errcode = '22023';
  end if;

  if length(p_title) > 255 or length(p_message) > 4000
    or length(coalesce(p_action_url, '')) > 500 then
    raise exception 'notification payload is too large' using errcode = '22023';
  end if;

  if not private.can_send_notification(p_user_id, p_group_type, p_type, p_data_id) then
    raise exception 'not authorized to notify this recipient' using errcode = '42501';
  end if;

  insert into public.notifications (
    user_id, title, message, date, read, type, data_id, group_type,
    action_url, is_read, metadata, sender_id, sender_name
  ) values (
    p_user_id::text, btrim(p_title), btrim(p_message), now()::text, false,
    btrim(p_type), p_data_id, coalesce(nullif(btrim(p_group_type), ''), 'SYSTEM'),
    nullif(btrim(p_action_url), ''), false, p_metadata, caller_id, caller_name
  )
  returning * into created_notification;

  return created_notification;
end;
$$;

create or replace function private.sync_notification_read_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.read is distinct from old.read then
    new.is_read := new.read;
  elsif new.is_read is distinct from old.is_read then
    new.read := new.is_read;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_notification_read_state on public.notifications;
create trigger sync_notification_read_state
before update of read, is_read on public.notifications
for each row execute function private.sync_notification_read_state();

revoke all on function private.can_send_notification(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.sync_notification_read_state() from public, anon, authenticated;
revoke all on function public.send_notification(uuid, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.send_notification(uuid, text, text, text, text, text, text, jsonb) to authenticated;

alter table public.notifications enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
  loop
    execute format('drop policy if exists %I on public.notifications', policy_record.policyname);
  end loop;
end;
$$;

create policy "notifications_select_own"
on public.notifications for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid())::text);

create policy "notifications_update_own"
on public.notifications for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid())::text)
with check (user_id = (select auth.uid())::text);

create policy "notifications_delete_own"
on public.notifications for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid())::text);

revoke all privileges on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (read, is_read) on table public.notifications to authenticated;
grant all privileges on table public.notifications to service_role;

comment on function public.send_notification(uuid, text, text, text, text, text, text, jsonb) is
  'Creates a trusted notification after validating the authenticated sender and recipient relationship.';
