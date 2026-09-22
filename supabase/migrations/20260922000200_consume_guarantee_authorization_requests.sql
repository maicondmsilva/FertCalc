alter table public.guarantee_authorization_requests
  add column consumed_at timestamptz,
  add column consumed_by_pricing_id uuid references public.pricing_records(id);

create unique index guarantee_authorization_requests_consumed_pricing_unique
  on public.guarantee_authorization_requests (consumed_by_pricing_id)
  where consumed_by_pricing_id is not null;

create or replace function public.consume_guarantee_authorization_request(
  p_request_id uuid,
  p_composition_hash text,
  p_pricing_id uuid
)
returns public.guarantee_authorization_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  request_record public.guarantee_authorization_requests%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into request_record
  from public.guarantee_authorization_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'authorization request not found' using errcode = 'P0002';
  end if;
  if request_record.requester_id <> caller_id then
    raise exception 'only the requester can consume this authorization' using errcode = '42501';
  end if;
  if request_record.status <> 'approved' then
    raise exception 'authorization request is not approved' using errcode = '23514';
  end if;
  if request_record.composition_hash <> p_composition_hash then
    raise exception 'composition changed after approval' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.pricing_records pricing
    where pricing.id = p_pricing_id
      and pricing.user_id = caller_id::text
      and pricing.organization_id = request_record.organization_id
  ) then
    raise exception 'saved pricing does not belong to the requester' using errcode = '42501';
  end if;

  update public.guarantee_authorization_requests
  set status = 'consumed',
      consumed_at = now(),
      consumed_by_pricing_id = p_pricing_id,
      updated_at = now()
  where id = p_request_id
  returning * into request_record;

  return request_record;
end;
$$;

revoke all on function public.consume_guarantee_authorization_request(uuid, text, uuid) from public, anon;
grant execute on function public.consume_guarantee_authorization_request(uuid, text, uuid) to authenticated;
