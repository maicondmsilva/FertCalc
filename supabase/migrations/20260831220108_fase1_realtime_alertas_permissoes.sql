-- Fase 1: restaura alertas de saldo, entrega notificacoes em tempo real e
-- alinha o acesso operacional de carregamentos com as filiais autorizadas.

-- Postgres Changes somente entrega eventos de tabelas presentes na publicacao.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- Esta tabela estava no historico local de migrations, mas nao existia no
-- projeto remoto. Ela nasce isolada por organizacao e vinculada ao pedido da
-- mesma organizacao.
create table if not exists public.pedido_saldo_alerta_preferencias (
  pedido_venda_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  dias_limite integer not null default 30 check (dias_limite between 1 and 365),
  desativado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (pedido_venda_id, user_id)
);

alter table public.pedido_saldo_alerta_preferencias
  add column if not exists organization_id uuid
  references public.organizations(id);

update public.pedido_saldo_alerta_preferencias preference
set organization_id = pedido.organization_id
from public.pedidos_venda pedido
where preference.organization_id is null
  and pedido.id = preference.pedido_venda_id;

alter table public.pedido_saldo_alerta_preferencias
  alter column organization_id set default public.get_current_organization_id(),
  alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pedido_saldo_alerta_pedido_organization_fk'
      and conrelid = 'public.pedido_saldo_alerta_preferencias'::regclass
  ) then
    alter table public.pedido_saldo_alerta_preferencias
      add constraint pedido_saldo_alerta_pedido_organization_fk
      foreign key (pedido_venda_id, organization_id)
      references public.pedidos_venda(id, organization_id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_pedido_saldo_alerta_user
  on public.pedido_saldo_alerta_preferencias(user_id);
create index if not exists idx_pedido_saldo_alerta_organization
  on public.pedido_saldo_alerta_preferencias(organization_id);

drop trigger if exists enforce_pedido_saldo_alerta_organization
  on public.pedido_saldo_alerta_preferencias;
create trigger enforce_pedido_saldo_alerta_organization
before insert or update on public.pedido_saldo_alerta_preferencias
for each row execute function private.enforce_row_organization();

alter table public.pedido_saldo_alerta_preferencias enable row level security;
revoke all privileges on public.pedido_saldo_alerta_preferencias from anon, authenticated;
grant select, insert, update on public.pedido_saldo_alerta_preferencias to authenticated;
grant all privileges on public.pedido_saldo_alerta_preferencias to service_role;

drop policy if exists pedido_saldo_alerta_select_own_visible
  on public.pedido_saldo_alerta_preferencias;
drop policy if exists pedido_saldo_alerta_insert_own_visible
  on public.pedido_saldo_alerta_preferencias;
drop policy if exists pedido_saldo_alerta_update_own_visible
  on public.pedido_saldo_alerta_preferencias;

create policy pedido_saldo_alerta_select_own_visible
on public.pedido_saldo_alerta_preferencias
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
      and pedido.organization_id = organization_id
  )
);

create policy pedido_saldo_alerta_insert_own_visible
on public.pedido_saldo_alerta_preferencias
for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
      and pedido.organization_id = organization_id
  )
);

create policy pedido_saldo_alerta_update_own_visible
on public.pedido_saldo_alerta_preferencias
for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
)
with check (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
      and pedido.organization_id = organization_id
  )
);

alter table public.alert_configs
  add column if not exists recipient_user_ids uuid[] not null default '{}';

insert into public.alert_configs (tipo, descricao, roles, recipient_user_ids, ativo)
values (
  'saldo_pedido_antigo',
  'Pedido com saldo pendente para carregamento alem do prazo configurado',
  array['master', 'admin']::text[],
  '{}'::uuid[],
  true
)
on conflict (tipo) do update
set descricao = excluded.descricao;

-- Centraliza a regra utilizada pelas policies. A funcao fica no schema privado
-- e nao pode ser chamada diretamente pelos papeis da API.
create or replace function private.can_access_loading_branch(
  target_branch_id uuid,
  owner_user_id uuid,
  require_management boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users app_user
    where app_user.id = (select auth.uid())
      and app_user.ativo
      and app_user.organization_id = private.user_organization((select auth.uid()))
      and (
        owner_user_id = (select auth.uid())
        or private.app_user_hierarchy((select auth.uid())) >= 60
        or (
          case
            when require_management then
              coalesce((app_user.permissions ->> 'carregamento_tratar_cotacao')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_aprovar_cotacao')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_liberar')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_admin')::boolean, false)
            else
              coalesce((app_user.permissions ->> 'carregamento_solicitar_cotacao')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_tratar_cotacao')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_aprovar_cotacao')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_liberar')::boolean, false)
              or coalesce((app_user.permissions ->> 'carregamento_admin')::boolean, false)
          end
        )
        and (
          coalesce((app_user.permissions ->> 'carregamento_all_filiais')::boolean, false)
          or target_branch_id = any(coalesce(app_user.carregamento_filial_ids, '{}'::uuid[]))
          or target_branch_id = any(coalesce(app_user.filiais_permitidas, '{}'::uuid[]))
          or case
            when jsonb_typeof(app_user.permissions -> 'carregamento_filial_ids') = 'array'
              then target_branch_id::text in (
                select jsonb_array_elements_text(app_user.permissions -> 'carregamento_filial_ids')
              )
            else false
          end
        )
      )
  );
$$;

revoke all on function private.can_access_loading_branch(uuid, uuid, boolean)
  from public, anon, authenticated;

drop policy if exists carregamentos_select_organization on public.carregamentos;
drop policy if exists carregamentos_update_organization on public.carregamentos;

create policy carregamentos_select_organization
on public.carregamentos
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.can_access_loading_branch(filial_id, criado_por, false)
);

create policy carregamentos_update_organization
on public.carregamentos
for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.can_access_loading_branch(filial_id, criado_por, true)
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.can_access_loading_branch(filial_id, criado_por, true)
);

notify pgrst, 'reload schema';
