-- Fase 2 de Pedidos de Venda: cancelamentos e substituicoes atomicos.

create or replace function public.executar_pedido_canc_substitui(
  p_pedido_origem_id uuid,
  p_quantidade numeric,
  p_produto_nome text,
  p_motivo text,
  p_filho jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_organization_id uuid := (select public.get_current_organization_id());
  pedido_origem public.pedidos_venda%rowtype;
  pedido_destino_id uuid;
  emitente_destino integer;
  numero_destino text;
  usuario_nome text;
begin
  if current_user_id is null or current_organization_id is null then
    raise exception 'Sessao expirada. Entre novamente.' using errcode = '42501';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if nullif(btrim(p_produto_nome), '') is null then
    raise exception 'Informe o produto do pedido destino.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe um motivo com pelo menos 3 caracteres.' using errcode = '22023';
  end if;

  select * into pedido_origem
  from public.pedidos_venda pedido
  where pedido.id = p_pedido_origem_id
    and pedido.organization_id = current_organization_id
    and (
      pedido.importado_por = current_user_id
      or private.app_user_hierarchy(current_user_id) >= 60
    )
  for update;

  if not found then
    raise exception 'Pedido nao encontrado ou sem permissao.' using errcode = '42501';
  end if;
  if pedido_origem.status in ('cancelado', 'concluido') then
    raise exception 'Pedidos cancelados ou concluidos nao podem ser substituidos.' using errcode = '22023';
  end if;
  if p_quantidade > pedido_origem.saldo_disponivel then
    raise exception 'Quantidade maior que o saldo disponivel de % t.', pedido_origem.saldo_disponivel
      using errcode = '22023';
  end if;

  begin
    emitente_destino := coalesce(nullif(p_filho ->> 'emitente', '')::integer, pedido_origem.emitente + 1);
  exception when invalid_text_representation then
    raise exception 'Informe um emitente valido.' using errcode = '22023';
  end;
  if emitente_destino < 1 then
    raise exception 'Informe um emitente valido.' using errcode = '22023';
  end if;
  numero_destino := coalesce(nullif(btrim(p_filho ->> 'numero_pedido'), ''), pedido_origem.numero_pedido);

  select app_user.name into usuario_nome
  from public.app_users app_user
  where app_user.id = current_user_id
    and app_user.organization_id = current_organization_id;

  insert into public.pedidos_venda (
    organization_id, precificacao_id, numero_pedido, barra_pedido, emitente,
    data_pedido, data_vencimento, quantidade_real, quantidade_original,
    valor_unitario_negociado, valor_total_negociado, embalagem, tipo_frete,
    valor_frete, status, status_pedido, importado_por, produto_nome,
    pedido_pai_id, cliente_id, preco_unitario, condicao_pagamento, filial_id,
    observacoes
  ) values (
    current_organization_id,
    nullif(p_filho ->> 'precificacao_id', '')::uuid,
    numero_destino,
    case when numero_destino is null then null else numero_destino || '/' || emitente_destino end,
    emitente_destino,
    nullif(p_filho ->> 'data_pedido', '')::date,
    nullif(p_filho ->> 'data_vencimento', '')::date,
    p_quantidade,
    p_quantidade,
    nullif(p_filho ->> 'preco_unitario', '')::numeric,
    case when nullif(p_filho ->> 'preco_unitario', '') is null then null
      else p_quantidade * (p_filho ->> 'preco_unitario')::numeric end,
    nullif(p_filho ->> 'embalagem', ''),
    nullif(p_filho ->> 'tipo_frete', ''),
    nullif(p_filho ->> 'valor_frete', '')::numeric,
    'pendente', 'ativo', current_user_id, btrim(p_produto_nome),
    pedido_origem.id,
    nullif(p_filho ->> 'cliente_id', '')::uuid,
    nullif(p_filho ->> 'preco_unitario', '')::numeric,
    nullif(p_filho ->> 'condicao_pagamento', ''),
    coalesce(nullif(p_filho ->> 'filial_id', '')::uuid, pedido_origem.filial_id),
    nullif(p_filho ->> 'observacoes', '')
  ) returning id into pedido_destino_id;

  insert into public.pedidos_venda_itens (
    organization_id, pedido_venda_id, produto_nome, formulacao,
    quantidade_ton, saldo_disponivel, saldo_a_carregar, preco_unitario,
    embalagem, precificacao_id
  ) values (
    current_organization_id, pedido_destino_id, btrim(p_produto_nome),
    nullif(p_filho ->> 'formulacao', ''), p_quantidade, p_quantidade,
    p_quantidade, nullif(p_filho ->> 'preco_unitario', '')::numeric,
    nullif(p_filho ->> 'embalagem', ''),
    nullif(p_filho ->> 'precificacao_id', '')::uuid
  );

  update public.pedidos_venda
  set quantidade_desmembrada = coalesce(quantidade_desmembrada, 0) + p_quantidade
  where id = pedido_origem.id;

  insert into public.cancelamentos_pedido (
    organization_id, pedido_origem_id, pedido_destino_id, tipo,
    quantidade, motivo, usuario_id, usuario_nome
  ) values (
    current_organization_id, pedido_origem.id, pedido_destino_id,
    'canc_substitui', p_quantidade, btrim(p_motivo),
    current_user_id::text, coalesce(usuario_nome, 'Usuario')
  );

  perform private.recalcular_pedido_venda(pedido_origem.id);
  perform private.recalcular_pedido_venda(pedido_destino_id);
  return pedido_destino_id;
exception
  when unique_violation then
    raise exception 'Ja existe um pedido com esse numero e emitente.' using errcode = '23505';
end;
$$;

create or replace function public.executar_pedido_cancelamento_definitivo(
  p_pedido_id uuid,
  p_quantidade numeric,
  p_motivo text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_organization_id uuid := (select public.get_current_organization_id());
  pedido public.pedidos_venda%rowtype;
  quantidade_cancelar numeric(15,3);
  usuario_nome text;
begin
  if current_user_id is null or current_organization_id is null then
    raise exception 'Sessao expirada. Entre novamente.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe um motivo com pelo menos 3 caracteres.' using errcode = '22023';
  end if;

  select * into pedido
  from public.pedidos_venda pedido_base
  where pedido_base.id = p_pedido_id
    and pedido_base.organization_id = current_organization_id
    and (
      pedido_base.importado_por = current_user_id
      or private.app_user_hierarchy(current_user_id) >= 60
    )
  for update;

  if not found then
    raise exception 'Pedido nao encontrado ou sem permissao.' using errcode = '42501';
  end if;
  if pedido.status in ('cancelado', 'concluido') then
    raise exception 'Este pedido ja esta cancelado ou concluido.' using errcode = '22023';
  end if;

  quantidade_cancelar := coalesce(p_quantidade, pedido.saldo_disponivel);
  if quantidade_cancelar <= 0 then
    raise exception 'O pedido nao possui saldo disponivel para cancelamento.' using errcode = '22023';
  end if;
  if quantidade_cancelar > pedido.saldo_disponivel then
    raise exception 'Quantidade maior que o saldo disponivel de % t.', pedido.saldo_disponivel
      using errcode = '22023';
  end if;

  select app_user.name into usuario_nome
  from public.app_users app_user
  where app_user.id = current_user_id
    and app_user.organization_id = current_organization_id;

  update public.pedidos_venda
  set quantidade_cancelada_definitiva =
    coalesce(quantidade_cancelada_definitiva, 0) + quantidade_cancelar
  where id = pedido.id;

  insert into public.cancelamentos_pedido (
    organization_id, pedido_origem_id, tipo, quantidade, motivo,
    usuario_id, usuario_nome
  ) values (
    current_organization_id, pedido.id, 'definitivo', quantidade_cancelar,
    btrim(p_motivo), current_user_id::text, coalesce(usuario_nome, 'Usuario')
  );

  perform private.recalcular_pedido_venda(pedido.id);
  return quantidade_cancelar;
end;
$$;

revoke all on function public.executar_pedido_canc_substitui(uuid,numeric,text,text,jsonb)
  from public, anon;
grant execute on function public.executar_pedido_canc_substitui(uuid,numeric,text,text,jsonb)
  to authenticated;
revoke all on function public.executar_pedido_cancelamento_definitivo(uuid,numeric,text)
  from public, anon;
grant execute on function public.executar_pedido_cancelamento_definitivo(uuid,numeric,text)
  to authenticated;

notify pgrst, 'reload schema';
