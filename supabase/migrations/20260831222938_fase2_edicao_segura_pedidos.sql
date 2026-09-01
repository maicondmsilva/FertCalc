-- Fase 2: edicao transacional e auditada de pedidos de venda.

create table if not exists public.pedido_venda_audit (
  id uuid primary key default gen_random_uuid(),
  pedido_venda_id uuid not null,
  organization_id uuid not null default public.get_current_organization_id()
    references public.organizations(id),
  usuario_id uuid not null references auth.users(id),
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  dados_anteriores jsonb not null,
  dados_novos jsonb not null,
  campos_alterados text[] not null default '{}',
  criado_em timestamptz not null default now(),
  constraint pedido_venda_audit_pedido_organization_fk
    foreign key (pedido_venda_id, organization_id)
    references public.pedidos_venda(id, organization_id)
    on delete restrict
);

create index if not exists idx_pedido_venda_audit_pedido
  on public.pedido_venda_audit(pedido_venda_id, criado_em desc);
create index if not exists idx_pedido_venda_audit_organization
  on public.pedido_venda_audit(organization_id);

drop trigger if exists enforce_pedido_venda_audit_organization on public.pedido_venda_audit;
create trigger enforce_pedido_venda_audit_organization
before insert or update on public.pedido_venda_audit
for each row execute function private.enforce_row_organization();

alter table public.pedido_venda_audit enable row level security;
revoke all privileges on public.pedido_venda_audit from anon, authenticated;
grant select on public.pedido_venda_audit to authenticated;
grant all privileges on public.pedido_venda_audit to service_role;

drop policy if exists pedido_venda_audit_select_organization on public.pedido_venda_audit;
create policy pedido_venda_audit_select_organization
on public.pedido_venda_audit
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_id
      and pedido.organization_id = organization_id
  )
);

create or replace function public.update_pedido_venda_protegido(
  p_pedido_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_header jsonb,
  p_items jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_org_id uuid := (select public.get_current_organization_id());
  current_level integer := 0;
  old_order public.pedidos_venda%rowtype;
  new_order public.pedidos_venda%rowtype;
  old_snapshot jsonb;
  new_snapshot jsonb;
  old_items jsonb;
  new_items jsonb;
  item_payload jsonb;
  existing_item public.pedidos_venda_itens%rowtype;
  payload_item_ids uuid[] := '{}';
  item_id uuid;
  item_quantity numeric;
  reserved_quantity numeric;
  new_total numeric := 0;
  has_request boolean;
  has_progress boolean;
  is_closed boolean;
  changed_fields text[] := '{}';
  requested_number text;
  requested_issuer integer;
  requested_client uuid;
  requested_pricing uuid;
  requested_branch uuid;
begin
  if current_user_id is null or current_org_id is null then
    raise exception 'Sessao expirada. Entre novamente.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos 5 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_header, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Dados de edicao invalidos.' using errcode = '22023';
  end if;

  select coalesce(access_level.hierarchy_level, 0)
  into current_level
  from public.app_users app_user
  left join public.access_levels access_level on access_level.code = app_user.role
  where app_user.id = current_user_id
    and app_user.ativo
    and app_user.organization_id = current_org_id;

  select * into old_order
  from public.pedidos_venda
  where id = p_pedido_id and organization_id = current_org_id
  for update;
  if not found then
    raise exception 'Pedido nao encontrado ou sem permissao de edicao.' using errcode = 'P0002';
  end if;
  if old_order.importado_por is distinct from current_user_id and current_level < 60 then
    raise exception 'Pedido nao encontrado ou sem permissao de edicao.' using errcode = '42501';
  end if;
  if p_expected_updated_at is not null
    and old_order.atualizado_em is distinct from p_expected_updated_at then
    raise exception 'Este pedido foi alterado por outro usuario. Recarregue antes de salvar.'
      using errcode = '40001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.criado_em), '[]'::jsonb)
  into old_items
  from public.pedidos_venda_itens item
  where item.pedido_venda_id = p_pedido_id and item.organization_id = current_org_id;
  old_snapshot := jsonb_build_object('pedido', to_jsonb(old_order), 'itens', old_items);

  select exists (
    select 1 from public.carregamentos loading
    where loading.pedido_venda_id = p_pedido_id
      and loading.organization_id = current_org_id
      and loading.status <> 'cancelado'
  ), exists (
    select 1 from public.carregamentos loading
    where loading.pedido_venda_id = p_pedido_id
      and loading.organization_id = current_org_id
      and (
        loading.status in ('liberado_parcial','liberado_total','em_carregamento','carregado')
        or loading.quantidade_liberada > 0
        or loading.quantidade_carregada > 0
      )
  ) into has_request, has_progress;
  is_closed := old_order.status in ('concluido','cancelado');

  if p_force and current_level < 60 then
    raise exception 'Somente gerentes ou administradores podem usar a correcao excepcional.'
      using errcode = '42501';
  end if;
  if is_closed and current_level < 60 then
    raise exception 'Pedidos concluidos ou cancelados exigem correcao administrativa.'
      using errcode = '42501';
  end if;

  requested_number := nullif(btrim(p_header ->> 'numero_pedido'), '');
  requested_issuer := coalesce(nullif(p_header ->> 'emitente', '')::integer, old_order.emitente);
  requested_client := nullif(p_header ->> 'cliente_id', '')::uuid;
  requested_pricing := nullif(p_header ->> 'precificacao_id', '')::uuid;
  requested_branch := nullif(p_header ->> 'filial_id', '')::uuid;

  if requested_number is null or requested_issuer < 1 then
    raise exception 'Numero do pedido e emitente sao obrigatorios.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.pedidos_venda duplicate_order
    where duplicate_order.organization_id = current_org_id
      and duplicate_order.numero_pedido = requested_number
      and duplicate_order.emitente = requested_issuer
      and duplicate_order.id <> p_pedido_id
  ) then
    raise exception 'Ja existe outro pedido com este numero e emitente.' using errcode = '23505';
  end if;
  if requested_client is not null and not exists (
    select 1 from public.clients client
    where client.id = requested_client and client.organization_id = current_org_id
  ) then
    raise exception 'Cliente invalido para esta organizacao.' using errcode = '23503';
  end if;
  if requested_pricing is not null and not exists (
    select 1 from public.pricing_records pricing
    where pricing.id = requested_pricing and pricing.organization_id = current_org_id
  ) then
    raise exception 'Precificacao invalida para esta organizacao.' using errcode = '23503';
  end if;
  if requested_branch is not null and not exists (
    select 1 from public.branches branch
    where branch.id = requested_branch and branch.organization_id = current_org_id
  ) then
    raise exception 'Filial invalida para esta organizacao.' using errcode = '23503';
  end if;

  if (has_request or is_closed) and not p_force and (
    requested_number is distinct from old_order.numero_pedido
    or requested_issuer is distinct from old_order.emitente
    or requested_client is distinct from old_order.cliente_id
    or requested_pricing is distinct from old_order.precificacao_id
    or requested_branch is distinct from old_order.filial_id
  ) then
    raise exception 'Pedido com carregamento ou encerrado permite apenas ajustes comerciais.'
      using errcode = 'P0001';
  end if;

  if is_closed and (
    requested_number is distinct from old_order.numero_pedido
    or requested_issuer is distinct from old_order.emitente
    or requested_client is distinct from old_order.cliente_id
    or requested_pricing is distinct from old_order.precificacao_id
    or requested_branch is distinct from old_order.filial_id
    or nullif(p_header ->> 'data_pedido', '')::date is distinct from old_order.data_pedido
    or nullif(p_header ->> 'tipo_frete', '') is distinct from old_order.tipo_frete
    or nullif(p_header ->> 'valor_frete', '')::numeric is distinct from old_order.valor_frete
    or nullif(p_header ->> 'preco_unitario', '')::numeric is distinct from old_order.preco_unitario
    or nullif(btrim(p_header ->> 'condicao_pagamento'), '') is distinct from old_order.condicao_pagamento
  ) then
    raise exception 'Pedido encerrado permite alterar somente vencimento e observacoes.'
      using errcode = 'P0001';
  end if;

  for item_payload in select value from jsonb_array_elements(p_items)
  loop
    item_id := nullif(item_payload ->> 'id', '')::uuid;
    item_quantity := coalesce(nullif(item_payload ->> 'quantidade_ton', '')::numeric, 0);
    if nullif(btrim(item_payload ->> 'produto_nome'), '') is null or item_quantity <= 0 then
      raise exception 'Todos os itens precisam de produto e quantidade maior que zero.'
        using errcode = '22023';
    end if;

    reserved_quantity := 0;
    if item_id is not null then
      select * into existing_item
      from public.pedidos_venda_itens item
      where item.id = item_id
        and item.pedido_venda_id = p_pedido_id
        and item.organization_id = current_org_id;
      if not found then
        raise exception 'Um item informado nao pertence ao pedido.' using errcode = '23503';
      end if;
      payload_item_ids := array_append(payload_item_ids, item_id);

      if (has_request and not p_force) or is_closed then
        if btrim(item_payload ->> 'produto_nome') is distinct from existing_item.produto_nome
          or item_quantity is distinct from existing_item.quantidade_ton
          or nullif(item_payload ->> 'precificacao_id', '')::uuid
            is distinct from existing_item.precificacao_id then
          raise exception 'Produto, quantidade e precificacao ficam bloqueados apos a solicitacao de carregamento.'
            using errcode = 'P0001';
        end if;
      end if;

      if is_closed and (
        nullif(item_payload ->> 'preco_unitario', '')::numeric is distinct from existing_item.preco_unitario
        or nullif(btrim(item_payload ->> 'embalagem'), '') is distinct from existing_item.embalagem
      ) then
        raise exception 'Produtos de pedido encerrado nao podem ser alterados.' using errcode = 'P0001';
      end if;

      select coalesce(sum(loading_item.quantidade_ton), 0)
      into reserved_quantity
      from public.carregamento_itens loading_item
      join public.carregamentos loading on loading.id = loading_item.carregamento_id
        and loading.organization_id = loading_item.organization_id
      where loading_item.pedido_venda_item_id = item_id
        and loading_item.organization_id = current_org_id
        and loading.status <> 'cancelado';

      if item_quantity < reserved_quantity then
        raise exception 'A quantidade de um item nao pode ficar abaixo do total reservado ou carregado.'
          using errcode = 'P0001';
      end if;
      if reserved_quantity > 0 and (
        (item_payload ->> 'produto_nome') is distinct from existing_item.produto_nome
        or nullif(item_payload ->> 'precificacao_id', '')::uuid is distinct from existing_item.precificacao_id
      ) then
        raise exception 'Produto e precificacao de item ja reservado nao podem ser alterados.'
          using errcode = 'P0001';
      end if;

      update public.pedidos_venda_itens
      set produto_nome = btrim(item_payload ->> 'produto_nome'),
          quantidade_ton = item_quantity,
          saldo_disponivel = greatest(item_quantity - reserved_quantity, 0),
          preco_unitario = nullif(item_payload ->> 'preco_unitario', '')::numeric,
          embalagem = nullif(btrim(item_payload ->> 'embalagem'), ''),
          precificacao_id = nullif(item_payload ->> 'precificacao_id', '')::uuid
      where id = item_id and pedido_venda_id = p_pedido_id;
    else
      if has_request or is_closed then
        raise exception 'Nao e permitido adicionar itens nesta etapa do pedido.' using errcode = 'P0001';
      end if;
      insert into public.pedidos_venda_itens (
        pedido_venda_id, organization_id, produto_nome, quantidade_ton,
        saldo_disponivel, preco_unitario, embalagem, precificacao_id
      ) values (
        p_pedido_id, current_org_id, btrim(item_payload ->> 'produto_nome'), item_quantity,
        item_quantity, nullif(item_payload ->> 'preco_unitario', '')::numeric,
        nullif(btrim(item_payload ->> 'embalagem'), ''),
        nullif(item_payload ->> 'precificacao_id', '')::uuid
      ) returning id into item_id;
      payload_item_ids := array_append(payload_item_ids, item_id);
    end if;
    new_total := new_total + item_quantity;
  end loop;

  if cardinality(payload_item_ids) = 0 then
    raise exception 'O pedido precisa ter ao menos um item.' using errcode = '22023';
  end if;
  if (has_request or is_closed) and exists (
    select 1 from public.pedidos_venda_itens item
    where item.pedido_venda_id = p_pedido_id
      and item.organization_id = current_org_id
      and not (item.id = any(payload_item_ids))
  ) then
    raise exception 'Itens nao podem ser removidos apos a solicitacao de carregamento.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.pedidos_venda_itens item
    where item.pedido_venda_id = p_pedido_id
      and item.organization_id = current_org_id
      and not (item.id = any(payload_item_ids))
      and item.saldo_disponivel < item.quantidade_ton
  ) then
    raise exception 'Itens reservados ou carregados nao podem ser removidos.' using errcode = 'P0001';
  end if;
  delete from public.pedidos_venda_itens item
  where item.pedido_venda_id = p_pedido_id
    and item.organization_id = current_org_id
    and not (item.id = any(payload_item_ids));

  if new_total < coalesce(old_order.quantidade_desmembrada, 0)
      + coalesce(old_order.quantidade_cancelada_definitiva, 0)
      + coalesce(old_order.quantidade_carregada, 0) then
    raise exception 'O total do pedido nao pode ficar abaixo do saldo ja utilizado.' using errcode = 'P0001';
  end if;

  update public.pedidos_venda
  set numero_pedido = requested_number,
      emitente = requested_issuer,
      barra_pedido = requested_number || '/' || requested_issuer,
      data_pedido = nullif(p_header ->> 'data_pedido', '')::date,
      data_vencimento = nullif(p_header ->> 'data_vencimento', '')::date,
      cliente_id = requested_client,
      precificacao_id = requested_pricing,
      filial_id = requested_branch,
      tipo_frete = nullif(p_header ->> 'tipo_frete', ''),
      valor_frete = nullif(p_header ->> 'valor_frete', '')::numeric,
      preco_unitario = nullif(p_header ->> 'preco_unitario', '')::numeric,
      condicao_pagamento = nullif(btrim(p_header ->> 'condicao_pagamento'), ''),
      observacoes = nullif(btrim(p_header ->> 'observacoes'), ''),
      quantidade_real = new_total,
      quantidade_original = new_total,
      saldo_disponivel = greatest(
        new_total - coalesce(quantidade_desmembrada, 0)
          - coalesce(quantidade_cancelada_definitiva, 0)
          - coalesce(quantidade_carregada, 0),
        0
      ),
      atualizado_em = clock_timestamp()
  where id = p_pedido_id and organization_id = current_org_id
  returning * into new_order;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.criado_em), '[]'::jsonb)
  into new_items
  from public.pedidos_venda_itens item
  where item.pedido_venda_id = p_pedido_id and item.organization_id = current_org_id;
  new_snapshot := jsonb_build_object('pedido', to_jsonb(new_order), 'itens', new_items);

  select coalesce(array_agg(key order by key), '{}') into changed_fields
  from (
    select key from jsonb_each(old_snapshot -> 'pedido') old_field
    where (new_snapshot -> 'pedido' -> old_field.key) is distinct from old_field.value
    union
    select 'itens' where old_items is distinct from new_items
  ) changes;

  insert into public.pedido_venda_audit (
    pedido_venda_id, organization_id, usuario_id, motivo,
    dados_anteriores, dados_novos, campos_alterados
  ) values (
    p_pedido_id, current_org_id, current_user_id, btrim(p_reason),
    old_snapshot, new_snapshot, changed_fields
  );

  return jsonb_build_object(
    'pedido', to_jsonb(new_order),
    'itens', new_items,
    'campos_alterados', to_jsonb(changed_fields),
    'tinha_solicitacao', has_request,
    'tinha_progresso', has_progress
  );
end;
$$;

revoke all on function public.update_pedido_venda_protegido(uuid,timestamptz,text,jsonb,jsonb,boolean)
  from public, anon;
grant execute on function public.update_pedido_venda_protegido(uuid,timestamptz,text,jsonb,jsonb,boolean)
  to authenticated;

create or replace function public.get_pedido_venda_edit_context(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_org_id uuid := (select public.get_current_organization_id());
  current_level integer := (select private.app_user_hierarchy((select auth.uid())));
  target_order public.pedidos_venda%rowtype;
  has_request boolean;
  has_progress boolean;
begin
  select * into target_order from public.pedidos_venda
  where id = p_pedido_id and organization_id = current_org_id;
  if not found or (target_order.importado_por is distinct from current_user_id and current_level < 60) then
    raise exception 'Pedido nao encontrado ou sem permissao.' using errcode = '42501';
  end if;
  select exists (
    select 1 from public.carregamentos c
    where c.pedido_venda_id = p_pedido_id and c.organization_id = current_org_id and c.status <> 'cancelado'
  ), exists (
    select 1 from public.carregamentos c
    where c.pedido_venda_id = p_pedido_id and c.organization_id = current_org_id
      and (c.status in ('liberado_parcial','liberado_total','em_carregamento','carregado')
        or c.quantidade_liberada > 0 or c.quantidade_carregada > 0)
  ) into has_request, has_progress;
  return jsonb_build_object('hasRequest', has_request, 'hasProgress', has_progress);
end;
$$;

revoke all on function public.get_pedido_venda_edit_context(uuid) from public, anon;
grant execute on function public.get_pedido_venda_edit_context(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['pedidos_venda','pedidos_venda_itens','carregamentos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
