-- FertCalc 8.4: authenticated, immutable runtime error tracking.

create table public.runtime_error_events (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null unique,
  user_id uuid not null default auth.uid(),
  organization_id uuid not null default public.get_current_organization_id(),
  source text not null check (source in ('react-error-boundary', 'window-error', 'unhandled-rejection')),
  message text not null check (char_length(message) between 1 and 4000),
  stack text check (stack is null or char_length(stack) <= 20000),
  component_stack text check (component_stack is null or char_length(component_stack) <= 20000),
  path text check (path is null or char_length(path) <= 2000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  release text check (release is null or char_length(release) <= 200),
  created_at timestamptz not null default now(),
  constraint runtime_error_events_user_fk
    foreign key (user_id) references public.app_users(id) on delete restrict,
  constraint runtime_error_events_organization_fk
    foreign key (organization_id) references public.organizations(id) on delete restrict
);

create index runtime_error_events_created_at_idx
  on public.runtime_error_events (created_at desc);

create index runtime_error_events_user_created_at_idx
  on public.runtime_error_events (user_id, created_at desc);

create index runtime_error_events_organization_created_at_idx
  on public.runtime_error_events (organization_id, created_at desc);

alter table public.runtime_error_events enable row level security;

create policy "runtime_errors_insert_own"
on public.runtime_error_events
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and organization_id = (select public.get_current_organization_id())
);

create policy "runtime_errors_select_admin"
on public.runtime_error_events
for select
to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and (select private.app_user_hierarchy((select auth.uid()))) >= 80
);

revoke all privileges on table public.runtime_error_events from anon, authenticated;
grant insert (
  incident_id,
  source,
  message,
  stack,
  component_stack,
  path,
  user_agent,
  release
) on table public.runtime_error_events to authenticated;
grant select on table public.runtime_error_events to authenticated;
grant all privileges on table public.runtime_error_events to service_role;

comment on table public.runtime_error_events is
  'Immutable authenticated frontend incidents for operational diagnostics.';
comment on column public.runtime_error_events.user_id is
  'Derived from auth.uid(); clients cannot provide or change this field.';
comment on column public.runtime_error_events.organization_id is
  'Derived from the authenticated application user tenant.';
