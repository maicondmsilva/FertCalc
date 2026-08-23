create table if not exists public.pedido_saldo_alerta_preferencias (
  pedido_venda_id uuid not null references public.pedidos_venda(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dias_limite integer not null default 30 check (dias_limite between 1 and 365),
  desativado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (pedido_venda_id, user_id)
);

alter table public.alert_configs
  add column if not exists recipient_user_ids uuid[] not null default '{}';

insert into public.alert_configs (tipo, descricao, roles, recipient_user_ids, ativo)
values (
  'saldo_pedido_antigo',
  'Pedido com saldo pendente para carregamento além do prazo configurado',
  array['master', 'admin']::text[],
  '{}'::uuid[],
  true
)
on conflict (tipo) do update
set descricao = excluded.descricao;

alter table public.pedido_saldo_alerta_preferencias enable row level security;

create policy "pedido_saldo_alerta_select_own_visible"
on public.pedido_saldo_alerta_preferencias
for select to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
  )
);

create policy "pedido_saldo_alerta_insert_own_visible"
on public.pedido_saldo_alerta_preferencias
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
  )
);

create policy "pedido_saldo_alerta_update_own_visible"
on public.pedido_saldo_alerta_preferencias
for update to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
  )
);

create index if not exists idx_pedido_saldo_alerta_user
  on public.pedido_saldo_alerta_preferencias(user_id);

notify pgrst, 'reload schema';
