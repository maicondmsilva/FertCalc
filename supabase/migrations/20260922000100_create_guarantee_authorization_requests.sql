create table public.guarantee_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requester_id uuid not null references public.app_users(id),
  requester_name text not null,
  client_id text,
  client_name text,
  composition_hash text not null,
  pricing_snapshot jsonb not null,
  divergences jsonb not null,
  request_reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'consumed')),
  reviewed_by uuid references public.app_users(id),
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guarantee_authorization_request_reason_not_blank
    check (length(btrim(request_reason)) > 0),
  constraint guarantee_authorization_request_divergences_array
    check (jsonb_typeof(divergences) = 'array' and jsonb_array_length(divergences) > 0),
  constraint guarantee_authorization_request_snapshot_object
    check (jsonb_typeof(pricing_snapshot) = 'object')
);

create unique index guarantee_authorization_requests_pending_unique
  on public.guarantee_authorization_requests (requester_id, composition_hash)
  where status = 'pending';
create index guarantee_authorization_requests_requester_created_idx
  on public.guarantee_authorization_requests (requester_id, created_at desc);
create index guarantee_authorization_requests_org_status_created_idx
  on public.guarantee_authorization_requests (organization_id, status, created_at desc);
create index guarantee_authorization_requests_reviewer_idx
  on public.guarantee_authorization_requests (reviewed_by)
  where reviewed_by is not null;

alter table public.guarantee_authorization_requests enable row level security;

create policy guarantee_authorization_requests_select
on public.guarantee_authorization_requests
for select
to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and (
    requester_id = (select auth.uid())
    or (select private.app_user_hierarchy((select auth.uid()))) >= 80
    or requester_id::text = any(
      coalesce(
        (select app_user.managed_user_ids from public.app_users app_user where app_user.id = (select auth.uid())),
        '{}'::text[]
      )
    )
    or coalesce(
      (
        select (app_user.permissions ->> 'calculator_overrideGuaranteeDivergence')::boolean
        from public.app_users app_user
        where app_user.id = (select auth.uid())
      ),
      false
    )
  )
);

create policy guarantee_authorization_requests_insert
on public.guarantee_authorization_requests
for insert
to authenticated
with check (
  requester_id = (select auth.uid())
  and organization_id = (select public.get_current_organization_id())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

revoke all privileges on table public.guarantee_authorization_requests from public, anon, authenticated;
grant select, insert on table public.guarantee_authorization_requests to authenticated;
grant all privileges on table public.guarantee_authorization_requests to service_role;

create or replace function public.decide_guarantee_authorization_request(
  p_request_id uuid,
  p_decision text,
  p_reason text
)
returns public.guarantee_authorization_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_record public.app_users%rowtype;
  request_record public.guarantee_authorization_requests%rowtype;
  can_review boolean := false;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'review reason is required' using errcode = '22023';
  end if;

  select * into caller_record
  from public.app_users
  where id = caller_id and coalesce(ativo, true);
  if not found then
    raise exception 'active application user required' using errcode = '42501';
  end if;

  select * into request_record
  from public.guarantee_authorization_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'authorization request not found' using errcode = 'P0002';
  end if;
  if request_record.status <> 'pending' then
    raise exception 'authorization request is no longer pending' using errcode = '23514';
  end if;
  if request_record.organization_id <> caller_record.organization_id then
    raise exception 'authorization request belongs to another organization' using errcode = '42501';
  end if;

  can_review := private.app_user_hierarchy(caller_id) >= 80
    or request_record.requester_id::text = any(coalesce(caller_record.managed_user_ids, '{}'::text[]))
    or coalesce((caller_record.permissions ->> 'calculator_overrideGuaranteeDivergence')::boolean, false);
  if not can_review then
    raise exception 'user cannot review this authorization request' using errcode = '42501';
  end if;

  update public.guarantee_authorization_requests
  set status = p_decision,
      reviewed_by = caller_id,
      reviewed_by_name = coalesce(nullif(btrim(caller_record.nickname), ''), caller_record.name),
      reviewed_at = now(),
      review_reason = btrim(p_reason),
      updated_at = now()
  where id = p_request_id
  returning * into request_record;

  perform public.write_audit_logs_entry(
    'pricing.guarantee_authorization_request_' || p_decision,
    'guarantee_authorization_request',
    request_record.id::text,
    jsonb_build_object(
      'requester_id', request_record.requester_id,
      'client_name', request_record.client_name,
      'composition_hash', request_record.composition_hash,
      'reason', request_record.review_reason
    )
  );

  return request_record;
end;
$$;

revoke all on function public.decide_guarantee_authorization_request(uuid, text, text) from public, anon;
grant execute on function public.decide_guarantee_authorization_request(uuid, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guarantee_authorization_requests'
  ) then
    alter publication supabase_realtime add table public.guarantee_authorization_requests;
  end if;
end;
$$;

comment on table public.guarantee_authorization_requests is
  'Requests supervisor approval for an exact divergent-guarantee calculation snapshot.';
