-- Fase 1 de Pedidos de Venda: separa reserva de carga efetiva e centraliza saldos/status.

alter table public.pedidos_venda
  add column if not exists quantidade_reservada numeric(15,3) not null default 0,
  add column if not exists saldo_a_carregar numeric(15,3) not null default 0;

alter table public.pedidos_venda_itens
  add column if not exists quantidade_reservada numeric(15,3) not null default 0,
  add column if not exists quantidade_carregada numeric(15,3) not null default 0,
  add column if not exists saldo_a_carregar numeric(15,3) not null default 0;

-- A coluna antiga descontava "quantidade_carregada", que historicamente continha
-- quantidade reservada. Ela vira uma coluna consolidada pela rotina canônica.
alter table public.pedidos_venda drop column saldo_disponivel;
alter table public.pedidos_venda
  add column saldo_disponivel numeric(15,3) not null default 0;

alter table public.pedidos_venda
  add constraint pedidos_venda_quantidade_reservada_nonnegative
    check (quantidade_reservada >= 0),
  add constraint pedidos_venda_quantidade_carregada_nonnegative
    check (coalesce(quantidade_carregada, 0) >= 0),
  add constraint pedidos_venda_saldo_a_carregar_nonnegative
    check (saldo_a_carregar >= 0);

alter table public.pedidos_venda_itens
  add constraint pedidos_venda_itens_quantidade_reservada_nonnegative
    check (quantidade_reservada >= 0),
  add constraint pedidos_venda_itens_quantidade_carregada_nonnegative
    check (quantidade_carregada >= 0),
  add constraint pedidos_venda_itens_saldo_a_carregar_nonnegative
    check (saldo_a_carregar >= 0);

create or replace function private.recalcular_pedido_venda(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_pedido numeric(15,3) := 0;
  total_reservado numeric(15,3) := 0;
  total_carregado numeric(15,3) := 0;
  total_desmembrado numeric(15,3) := 0;
  total_cancelado numeric(15,3) := 0;
  saldo_fisico numeric(15,3) := 0;
  status_atual text;
  status_negocial_atual text;
  novo_status text;
  possui_carregamento_aprovado boolean := false;
begin
  if p_pedido_id is null then
    return;
  end if;

  -- Distribui reserva e carga efetiva entre os itens na mesma proporção usada
  -- pela solicitação. Cancelamentos de solicitação reduzem a reserva.
  with itens_por_carregamento as (
    select
      ci.carregamento_id,
      sum(ci.quantidade_ton) as total_itens
    from public.carregamento_itens ci
    join public.carregamentos c on c.id = ci.carregamento_id
    where c.pedido_venda_id = p_pedido_id
    group by ci.carregamento_id
  ), execucoes_por_carregamento as (
    select
      execucao.carregamento_id,
      sum(coalesce(execucao.quantidade_carregada, 0)) as total_carregado
    from public.carregamento_execucoes execucao
    where execucao.status = 'concluido'
    group by execucao.carregamento_id
  ), carregamentos_metricas as (
    select
      carregamento.id,
      greatest(
        carregamento.quantidade_total - coalesce(carregamento.quantidade_cancelada, 0),
        0
      ) as total_reservado,
      least(
        greatest(
          carregamento.quantidade_total - coalesce(carregamento.quantidade_cancelada, 0),
          0
        ),
        case
          -- Registros históricos podem estar concluídos sem a quantidade ter
          -- sido copiada para o cabeçalho da solicitação.
          when carregamento.status = 'carregado' then coalesce(
            nullif(execucao.total_carregado, 0),
            nullif(carregamento.quantidade_carregada, 0),
            greatest(
              carregamento.quantidade_total - coalesce(carregamento.quantidade_cancelada, 0),
              0
            )
          )
          else greatest(
            coalesce(execucao.total_carregado, carregamento.quantidade_carregada, 0),
            0
          )
        end
      ) as total_carregado
    from public.carregamentos carregamento
    left join execucoes_por_carregamento execucao
      on execucao.carregamento_id = carregamento.id
    where carregamento.pedido_venda_id = p_pedido_id
      and carregamento.status <> 'cancelado'
  ), metricas as (
    select
      ci.pedido_venda_item_id,
      sum(
        case when ipc.total_itens > 0 then
          ci.quantidade_ton
            * carregamento.total_reservado
            / ipc.total_itens
        else 0 end
      ) as reservado,
      sum(
        case when ipc.total_itens > 0 then
          ci.quantidade_ton
            * carregamento.total_carregado
            / ipc.total_itens
        else 0 end
      ) as carregado
    from public.carregamento_itens ci
    join carregamentos_metricas carregamento on carregamento.id = ci.carregamento_id
    join itens_por_carregamento ipc on ipc.carregamento_id = ci.carregamento_id
    where carregamento.total_reservado >= 0
      and ci.pedido_venda_item_id is not null
    group by ci.pedido_venda_item_id
  )
  update public.pedidos_venda_itens item
  set quantidade_reservada = least(item.quantidade_ton, greatest(coalesce(metrica.reservado, 0), 0)),
      quantidade_carregada = least(item.quantidade_ton, greatest(coalesce(metrica.carregado, 0), 0)),
      saldo_disponivel = greatest(item.quantidade_ton - coalesce(metrica.reservado, 0), 0),
      saldo_a_carregar = greatest(item.quantidade_ton - coalesce(metrica.carregado, 0), 0)
  from (
    select
      item_base.id,
      coalesce(metricas.reservado, 0) as reservado,
      coalesce(metricas.carregado, 0) as carregado
    from public.pedidos_venda_itens item_base
    left join metricas on metricas.pedido_venda_item_id = item_base.id
    where item_base.pedido_venda_id = p_pedido_id
  ) metrica
  where item.id = metrica.id;

  select
    coalesce(sum(item.quantidade_ton), 0),
    coalesce(sum(item.quantidade_reservada), 0),
    coalesce(sum(item.quantidade_carregada), 0)
  into total_pedido, total_reservado, total_carregado
  from public.pedidos_venda_itens item
  where item.pedido_venda_id = p_pedido_id;

  select
    coalesce(pedido.quantidade_desmembrada, 0),
    coalesce(pedido.quantidade_cancelada_definitiva, 0),
    pedido.status,
    pedido.status_pedido
  into total_desmembrado, total_cancelado, status_atual, status_negocial_atual
  from public.pedidos_venda pedido
  where pedido.id = p_pedido_id
  for update;

  if not found then
    return;
  end if;

  saldo_fisico := greatest(total_pedido - total_carregado - total_desmembrado - total_cancelado, 0);

  select exists (
    select 1
    from public.carregamentos carregamento
    where carregamento.pedido_venda_id = p_pedido_id
      and carregamento.status in ('liberado_parcial', 'liberado_total', 'em_carregamento', 'carregado')
  ) into possui_carregamento_aprovado;

  if status_atual = 'cancelado' or status_negocial_atual = 'cancelado' then
    novo_status := 'cancelado';
  elsif saldo_fisico <= 0 then
    novo_status := 'concluido';
  elsif possui_carregamento_aprovado then
    novo_status := 'em_carregamento';
  else
    novo_status := 'pendente';
  end if;

  update public.pedidos_venda
  set quantidade_reservada = least(total_pedido, total_reservado),
      quantidade_carregada = least(total_pedido, total_carregado),
      saldo_disponivel = greatest(
        total_pedido - total_reservado - total_desmembrado - total_cancelado,
        0
      ),
      saldo_a_carregar = saldo_fisico,
      status = novo_status,
      status_pedido = case
        when novo_status = 'cancelado' then 'cancelado'
        when novo_status = 'concluido' then 'concluido'
        else 'ativo'
      end,
      atualizado_em = clock_timestamp()
  where id = p_pedido_id;
end;
$$;

revoke all on function private.recalcular_pedido_venda(uuid) from public, anon, authenticated;

create or replace function public.recalcular_pedido_venda(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_organization_id uuid := (select public.get_current_organization_id());
begin
  if current_user_id is null or current_organization_id is null then
    raise exception 'Sessao expirada. Entre novamente.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pedidos_venda pedido
    where pedido.id = p_pedido_id
      and pedido.organization_id = current_organization_id
      and (
        pedido.importado_por = current_user_id
        or private.app_user_hierarchy(current_user_id) >= 60
      )
  ) then
    raise exception 'Pedido nao encontrado ou sem permissao.' using errcode = '42501';
  end if;

  perform private.recalcular_pedido_venda(p_pedido_id);
end;
$$;

revoke all on function public.recalcular_pedido_venda(uuid) from public, anon;
grant execute on function public.recalcular_pedido_venda(uuid) to authenticated;

create or replace function public.atualizar_saldo_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalcular_pedido_venda(old.pedido_venda_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.pedido_venda_id is distinct from new.pedido_venda_id then
    perform private.recalcular_pedido_venda(old.pedido_venda_id);
  end if;
  perform private.recalcular_pedido_venda(new.pedido_venda_id);
  return new;
end;
$$;

create or replace function public.recalcular_pedido_por_item_carregamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_pedido_id uuid;
  new_pedido_id uuid;
begin
  if tg_op <> 'INSERT' then
    select pedido_venda_id into old_pedido_id
    from public.carregamentos where id = old.carregamento_id;
  end if;
  if tg_op <> 'DELETE' then
    select pedido_venda_id into new_pedido_id
    from public.carregamentos where id = new.carregamento_id;
  end if;

  perform private.recalcular_pedido_venda(old_pedido_id);
  if new_pedido_id is distinct from old_pedido_id then
    perform private.recalcular_pedido_venda(new_pedido_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.recalcular_pedido_por_item_venda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.recalcular_pedido_venda(old.pedido_venda_id);
  end if;
  if tg_op <> 'DELETE' and (
    tg_op = 'INSERT' or new.pedido_venda_id is distinct from old.pedido_venda_id
  ) then
    perform private.recalcular_pedido_venda(new.pedido_venda_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.recalcular_pedido_por_cabecalho()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recalcular_pedido_venda(new.id);
  return new;
end;
$$;

revoke all on function public.atualizar_saldo_pedido() from public, anon, authenticated;
revoke all on function public.recalcular_pedido_por_item_carregamento()
  from public, anon, authenticated;
revoke all on function public.recalcular_pedido_por_item_venda()
  from public, anon, authenticated;
revoke all on function public.recalcular_pedido_por_cabecalho()
  from public, anon, authenticated;

drop trigger if exists trg_ajustar_saldo_pedido_item on public.carregamento_itens;
drop trigger if exists trg_cancelar_saldo_solicitacao on public.carregamentos;
drop trigger if exists trg_recalcular_pedido_por_item_carregamento on public.carregamento_itens;
create trigger trg_recalcular_pedido_por_item_carregamento
after insert or delete or update of pedido_venda_item_id, quantidade_ton, carregamento_id
on public.carregamento_itens
for each row execute function public.recalcular_pedido_por_item_carregamento();

drop trigger if exists trg_recalcular_pedido_por_item_venda on public.pedidos_venda_itens;
create trigger trg_recalcular_pedido_por_item_venda
after insert or delete or update of pedido_venda_id, quantidade_ton
on public.pedidos_venda_itens
for each row execute function public.recalcular_pedido_por_item_venda();

drop trigger if exists trg_recalcular_pedido_por_cancelamento on public.pedidos_venda;
create trigger trg_recalcular_pedido_por_cancelamento
after update of quantidade_real, quantidade_desmembrada, quantidade_cancelada_definitiva
on public.pedidos_venda
for each row
when (
  old.quantidade_real is distinct from new.quantidade_real
  or old.quantidade_desmembrada is distinct from new.quantidade_desmembrada
  or old.quantidade_cancelada_definitiva is distinct from new.quantidade_cancelada_definitiva
)
execute function public.recalcular_pedido_por_cabecalho();

-- Reprocessa os registros atuais com a nova definição canônica.
do $$
declare
  pedido_id uuid;
begin
  for pedido_id in select id from public.pedidos_venda loop
    perform private.recalcular_pedido_venda(pedido_id);
  end loop;
end;
$$;

comment on column public.pedidos_venda.quantidade_reservada is
  'Quantidade vinculada a solicitacoes de carregamento nao canceladas.';
comment on column public.pedidos_venda.quantidade_carregada is
  'Quantidade fisicamente carregada, consolidada das execucoes.';
comment on column public.pedidos_venda.saldo_disponivel is
  'Saldo ainda disponivel para uma nova solicitacao de carregamento.';
comment on column public.pedidos_venda.saldo_a_carregar is
  'Saldo fisico do pedido que ainda nao foi efetivamente carregado.';

notify pgrst, 'reload schema';
