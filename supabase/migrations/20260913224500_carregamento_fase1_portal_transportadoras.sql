-- Fase 1 do portal das transportadoras: identidade, vínculo e isolamento das cotações.

insert into public.access_levels (code, name, description, is_system, hierarchy_level, default_permissions)
values ('transportadora', 'Transportadora', 'Acesso restrito ao portal de cotações de frete.', true, 10, '{}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  hierarchy_level = excluded.hierarchy_level,
  default_permissions = excluded.default_permissions,
  updated_at = now();

create table public.transportadora_usuarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  transportadora_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint transportadora_usuarios_transportadora_org_fk
    foreign key (transportadora_id, organization_id)
    references public.transportadoras(id, organization_id) on delete cascade,
  constraint transportadora_usuarios_user_key unique (user_id),
  constraint transportadora_usuarios_transportadora_user_key unique (transportadora_id, user_id)
);

create index idx_transportadora_usuarios_transportadora
  on public.transportadora_usuarios (transportadora_id, organization_id)
  where ativo;

alter table public.transportadora_usuarios enable row level security;
revoke all on table public.transportadora_usuarios from anon, authenticated;
grant select, insert, update, delete on table public.transportadora_usuarios to authenticated;
grant all on table public.transportadora_usuarios to service_role;

create or replace function private.current_transportadora_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tu.transportadora_id
  from public.transportadora_usuarios tu
  join public.app_users au
    on au.id = tu.user_id
   and au.organization_id = tu.organization_id
   and au.ativo
   and au.role = 'transportadora'
  join public.transportadoras t
    on t.id = tu.transportadora_id
   and t.organization_id = tu.organization_id
   and t.ativo
  where tu.user_id = (select auth.uid())
    and tu.ativo;
$$;

revoke all on function private.current_transportadora_id() from public, anon;
grant execute on function private.current_transportadora_id() to authenticated;

create policy transportadora_usuarios_select
on public.transportadora_usuarios for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    organization_id = (select public.get_current_organization_id())
    and private.app_user_hierarchy((select auth.uid())) >= 80
  )
);

create policy transportadora_usuarios_insert_admin
on public.transportadora_usuarios for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
  and exists (
    select 1 from public.app_users au
    where au.id = user_id
      and au.organization_id = organization_id
      and au.role = 'transportadora'
  )
);

create policy transportadora_usuarios_update_admin
on public.transportadora_usuarios for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
  and exists (
    select 1 from public.app_users au
    where au.id = user_id
      and au.organization_id = organization_id
      and au.role = 'transportadora'
  )
);

create policy transportadora_usuarios_delete_admin
on public.transportadora_usuarios for delete to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
);

-- Usuários internos mantêm o fluxo atual. A transportadora só enxerga a própria empresa.
drop policy if exists transportadoras_select_organization on public.transportadoras;
create policy transportadoras_select_internal_or_linked
on public.transportadoras for select to authenticated
using (
  (
    organization_id = (select public.get_current_organization_id())
    and private.app_user_hierarchy((select auth.uid())) >= 20
  )
  or id = (select private.current_transportadora_id())
);

-- Substitui as políticas amplas: somente equipe interna cria/administra; transportadora responde a sua proposta.
drop policy if exists cotacoes_frete_select_organization on public.cotacoes_frete;
drop policy if exists cotacoes_frete_insert_organization on public.cotacoes_frete;
drop policy if exists cotacoes_frete_update_organization on public.cotacoes_frete;

create policy cotacoes_frete_select_internal_or_assigned
on public.cotacoes_frete for select to authenticated
using (
  (
    organization_id = (select public.get_current_organization_id())
    and private.app_user_hierarchy((select auth.uid())) >= 20
  )
  or transportadora_id = (select private.current_transportadora_id())
);

create policy cotacoes_frete_insert_internal
on public.cotacoes_frete for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);

create policy cotacoes_frete_update_internal
on public.cotacoes_frete for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);

create policy cotacoes_frete_update_assigned_carrier
on public.cotacoes_frete for update to authenticated
using (
  transportadora_id = (select private.current_transportadora_id())
  and status = 'solicitada'
  and coalesce(arquivada, false) = false
)
with check (
  transportadora_id = (select private.current_transportadora_id())
  and status in ('respondida', 'recusada')
  and respondido_por = (select auth.uid())
  and coalesce(arquivada, false) = false
);

create or replace function private.enforce_carrier_quote_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.app_user_hierarchy((select auth.uid())) >= 20 then
    return new;
  end if;

  if old.transportadora_id is distinct from private.current_transportadora_id()
    or new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.carregamento_id is distinct from old.carregamento_id
    or new.transportadora_id is distinct from old.transportadora_id
    or new.solicitado_por is distinct from old.solicitado_por
    or new.criado_em is distinct from old.criado_em
    or new.arquivada is distinct from old.arquivada
    or new.arquivada_em is distinct from old.arquivada_em
    or new.arquivada_por is distinct from old.arquivada_por then
    raise exception 'carrier cannot change internal quote fields' using errcode = '42501';
  end if;

  if old.status <> 'solicitada' or new.status not in ('respondida', 'recusada') then
    raise exception 'invalid carrier quote transition' using errcode = '23514';
  end if;

  new.respondido_por := (select auth.uid());
  new.atualizado_em := now();
  return new;
end;
$$;

revoke all on function private.enforce_carrier_quote_update() from public, anon, authenticated;

drop trigger if exists enforce_carrier_quote_update on public.cotacoes_frete;
create trigger enforce_carrier_quote_update
before update on public.cotacoes_frete
for each row execute function private.enforce_carrier_quote_update();

comment on table public.transportadora_usuarios is
  'Vincula uma identidade do Supabase Auth a uma única transportadora e organização.';
comment on function private.current_transportadora_id() is
  'Retorna a transportadora ativa vinculada ao usuário autenticado, somente para autorização RLS.';
