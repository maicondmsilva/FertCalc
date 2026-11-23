-- Pedidos de Venda e Carregamento: gravações só pelas funções protegidas.
--
-- Antes desta migração qualquer usuário da empresa (inclusive o perfil
-- transportadora) podia ler e alterar direto os itens de pedidos, o histórico
-- de cancelamentos, o histórico de carregamento e o cadastro de
-- transportadoras. Também era possível criar um pedido sem produtos (o saldo
-- ficava zerado e o pedido aparecia como concluído).

-- ─── Permissão nomeada do usuário logado ────────────────────────────────────
create or replace function private.current_user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (u.permissions ->> p_permission)::boolean
      from public.app_users u
      where u.id = (select auth.uid()) and u.ativo is true
    ),
    false
  );
$$;
revoke all on function private.current_user_has_permission(text) from public, anon;
grant execute on function private.current_user_has_permission(text) to authenticated;

-- ─── Criação do pedido com os produtos numa única transação ─────────────────
create or replace function public.criar_pedido_venda(p_pedido jsonb, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_pedido_id uuid;
  v_total numeric(15,3);
  v_numero text := nullif(btrim(p_pedido ->> 'numero_pedido'), '');
  v_emitente integer;
  v_cliente uuid := nullif(p_pedido ->> 'cliente_id', '')::uuid;
  v_precificacao uuid := nullif(p_pedido ->> 'precificacao_id', '')::uuid;
  v_filial uuid := nullif(p_pedido ->> 'filial_id', '')::uuid;
begin
  if v_user_id is null or v_org is null or not exists (
    select 1 from public.app_users where id = v_user_id and ativo and organization_id = v_org
  ) then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if private.app_user_hierarchy(v_user_id) < 20 then
    raise exception 'Seu perfil não pode criar pedidos de venda.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pedido) is distinct from 'object'
     or jsonb_typeof(p_itens) is distinct from 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um produto no pedido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) item
    where jsonb_typeof(item) is distinct from 'object'
       or nullif(btrim(item ->> 'produto_nome'), '') is null
       or nullif(item ->> 'quantidade_ton', '') is null
       or (item ->> 'quantidade_ton')::numeric::text in ('NaN', 'Infinity', '-Infinity')
       or round((item ->> 'quantidade_ton')::numeric, 3) <= 0
  ) then
    raise exception 'Todos os produtos precisam de nome e quantidade maior que zero.'
      using errcode = '22023';
  end if;

  begin
    v_emitente := coalesce(nullif(p_pedido ->> 'emitente', '')::integer, 1);
  exception when invalid_text_representation then
    raise exception 'Informe um emitente válido.' using errcode = '22023';
  end;
  if v_emitente < 1 then
    raise exception 'Informe um emitente válido.' using errcode = '22023';
  end if;

  if v_cliente is not null and not exists (
    select 1 from public.clients where id = v_cliente and organization_id = v_org
  ) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  if v_precificacao is not null and not exists (
    select 1 from public.pricing_records where id = v_precificacao and organization_id = v_org
  ) then
    raise exception 'Precificação não encontrada.' using errcode = '42501';
  end if;
  if v_filial is not null and not exists (
    select 1 from public.branches where id = v_filial and organization_id = v_org
  ) then
    raise exception 'Filial não encontrada.' using errcode = '42501';
  end if;

  select sum(round((item ->> 'quantidade_ton')::numeric, 3)) into v_total
  from jsonb_array_elements(p_itens) item;

  insert into public.pedidos_venda (
    organization_id, precificacao_id, numero_pedido, barra_pedido, emitente,
    data_pedido, data_vencimento, quantidade_real, quantidade_original,
    quantidade_desmembrada, quantidade_cancelada_definitiva,
    embalagem, valor_unitario_negociado, valor_total_negociado, tipo_frete,
    valor_frete, status, status_pedido, pdf_url, dados_extraidos, importado_por,
    produto_nome, cliente_id, preco_unitario, condicao_pagamento, observacoes,
    filial_id, formulacao_alterada
  ) values (
    v_org,
    v_precificacao,
    v_numero,
    coalesce(
      nullif(btrim(p_pedido ->> 'barra_pedido'), ''),
      case when v_numero is null then null else v_numero || '/' || v_emitente end
    ),
    v_emitente,
    nullif(p_pedido ->> 'data_pedido', '')::date,
    nullif(p_pedido ->> 'data_vencimento', '')::date,
    v_total,
    v_total,
    0,
    0,
    nullif(btrim(p_pedido ->> 'embalagem'), ''),
    nullif(p_pedido ->> 'valor_unitario_negociado', '')::numeric,
    nullif(p_pedido ->> 'valor_total_negociado', '')::numeric,
    nullif(btrim(p_pedido ->> 'tipo_frete'), ''),
    nullif(p_pedido ->> 'valor_frete', '')::numeric,
    'pendente',
    'ativo',
    nullif(p_pedido ->> 'pdf_url', ''),
    case when jsonb_typeof(p_pedido -> 'dados_extraidos') = 'object'
      then p_pedido -> 'dados_extraidos' else null end,
    v_user_id,
    (
      select string_agg(btrim(item ->> 'produto_nome'), ', ' order by position)
      from jsonb_array_elements(p_itens) with ordinality as elements(item, position)
    ),
    v_cliente,
    nullif(p_pedido ->> 'preco_unitario', '')::numeric,
    nullif(btrim(p_pedido ->> 'condicao_pagamento'), ''),
    nullif(btrim(p_pedido ->> 'observacoes'), ''),
    v_filial,
    coalesce(nullif(p_pedido ->> 'formulacao_alterada', '')::boolean, false)
  ) returning id into v_pedido_id;

  insert into public.pedidos_venda_itens (
    organization_id, pedido_venda_id, produto_nome, formulacao, quantidade_ton,
    saldo_disponivel, saldo_a_carregar, preco_unitario, embalagem, precificacao_id
  )
  select
    v_org,
    v_pedido_id,
    btrim(item ->> 'produto_nome'),
    nullif(btrim(item ->> 'formulacao'), ''),
    round((item ->> 'quantidade_ton')::numeric, 3),
    round((item ->> 'quantidade_ton')::numeric, 3),
    round((item ->> 'quantidade_ton')::numeric, 3),
    nullif(item ->> 'preco_unitario', '')::numeric,
    nullif(btrim(item ->> 'embalagem'), ''),
    coalesce(nullif(item ->> 'precificacao_id', '')::uuid, v_precificacao)
  from jsonb_array_elements(p_itens) item;

  perform private.recalcular_pedido_venda(v_pedido_id);
  return v_pedido_id;
exception
  when unique_violation then
    raise exception 'Pedido duplicado: já existe um pedido com esse número e emitente.'
      using errcode = '23505';
end;
$$;
revoke all on function public.criar_pedido_venda(jsonb, jsonb) from public, anon;
grant execute on function public.criar_pedido_venda(jsonb, jsonb) to authenticated;

drop policy if exists pedidos_venda_itens_select_organization on public.pedidos_venda_itens;
create policy pedidos_venda_itens_select_organization
on public.pedidos_venda_itens
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and (
    exists (
      select 1 from public.pedidos_venda pedido
      where pedido.id = pedidos_venda_itens.pedido_venda_id
    )
    or exists (
      select 1
      from public.carregamento_itens carga_item
      join public.carregamentos carga on carga.id = carga_item.carregamento_id
      where carga_item.pedido_venda_item_id = pedidos_venda_itens.id
    )
  )
);

-- ─── Cancelamentos: só leitura, gravados pelas funções de cancelamento ──────
revoke insert, update, delete, truncate, references, trigger
  on public.cancelamentos_pedido from authenticated;
drop policy if exists cancelamentos_pedido_insert_organization on public.cancelamentos_pedido;
drop policy if exists cancelamentos_pedido_update_organization on public.cancelamentos_pedido;
drop policy if exists cancelamentos_pedido_delete_organization on public.cancelamentos_pedido;
drop policy if exists cancelamentos_pedido_select_organization on public.cancelamentos_pedido;
create policy cancelamentos_pedido_select_organization
on public.cancelamentos_pedido
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = cancelamentos_pedido.pedido_origem_id
  )
);

-- ─── Histórico de carregamento: só leitura, gravado pelas funções ───────────
revoke insert, update, delete, truncate, references, trigger
  on public.historico_carregamento from authenticated;
drop policy if exists historico_carregamento_insert_organization on public.historico_carregamento;
drop policy if exists historico_carregamento_update_organization on public.historico_carregamento;
drop policy if exists historico_carregamento_delete_organization on public.historico_carregamento;
drop policy if exists historico_carregamento_select_organization on public.historico_carregamento;
create policy historico_carregamento_select_organization
on public.historico_carregamento
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.carregamentos carga
    where carga.id = historico_carregamento.carregamento_id
  )
);

-- ─── Produtos da carga: criados junto com a solicitação, sem edição direta ──
revoke update, delete, truncate, references, trigger
  on public.carregamento_itens from authenticated;
drop policy if exists carregamento_itens_update_organization on public.carregamento_itens;
drop policy if exists carregamento_itens_delete_organization on public.carregamento_itens;
drop policy if exists carregamento_itens_insert_organization on public.carregamento_itens;
drop policy if exists carregamento_itens_select_organization on public.carregamento_itens;
create policy carregamento_itens_select_organization
on public.carregamento_itens
for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.carregamentos carga
    where carga.id = carregamento_itens.carregamento_id
  )
);
-- criar_carregamento roda com as permissões do usuário: o produto só entra
-- numa solicitação dele que ainda não foi liberada.
create policy carregamento_itens_insert_own_request
on public.carregamento_itens
for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.carregamentos carga
    where carga.id = carregamento_itens.carregamento_id
      and carga.criado_por = (select auth.uid())
      and carga.status = 'aguardando_liberacao'
      and carga.quantidade_liberada = 0
  )
);

-- ─── Transportadoras: cadastro só por gestão ou logística ───────────────────
revoke truncate, references, trigger on public.transportadoras from authenticated;
drop policy if exists transportadoras_insert_organization on public.transportadoras;
drop policy if exists transportadoras_update_organization on public.transportadoras;
create policy transportadoras_insert_management
on public.transportadoras
for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and (
    private.app_user_hierarchy((select auth.uid())) >= 60
    or private.current_user_has_permission('carregamento_admin')
    or private.current_user_has_permission('carregamento_tratar_cotacao')
  )
);
create policy transportadoras_update_management
on public.transportadoras
for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and (
    private.app_user_hierarchy((select auth.uid())) >= 60
    or private.current_user_has_permission('carregamento_admin')
    or private.current_user_has_permission('carregamento_tratar_cotacao')
  )
)
with check (
  organization_id = (select public.get_current_organization_id())
  and (
    private.app_user_hierarchy((select auth.uid())) >= 60
    or private.current_user_has_permission('carregamento_admin')
    or private.current_user_has_permission('carregamento_tratar_cotacao')
  )
);

-- ─── Cotações solicitadas e alertas: fora do alcance do perfil transportadora
revoke truncate, references, trigger on public.cotacoes_solicitadas from authenticated;
revoke truncate, references, trigger on public.alertas_carregamento from authenticated;

drop policy if exists cotacoes_solicitadas_select_organization on public.cotacoes_solicitadas;
drop policy if exists cotacoes_solicitadas_insert_organization on public.cotacoes_solicitadas;
drop policy if exists cotacoes_solicitadas_update_organization on public.cotacoes_solicitadas;
create policy cotacoes_solicitadas_select_organization
on public.cotacoes_solicitadas for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);
create policy cotacoes_solicitadas_insert_organization
on public.cotacoes_solicitadas for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);
create policy cotacoes_solicitadas_update_organization
on public.cotacoes_solicitadas for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);

drop policy if exists alertas_carregamento_select_organization on public.alertas_carregamento;
drop policy if exists alertas_carregamento_insert_organization on public.alertas_carregamento;
drop policy if exists alertas_carregamento_update_organization on public.alertas_carregamento;
create policy alertas_carregamento_select_organization
on public.alertas_carregamento for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);
create policy alertas_carregamento_insert_organization
on public.alertas_carregamento for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);
create policy alertas_carregamento_update_organization
on public.alertas_carregamento for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
)
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 20
);

-- ─── Regras que comparavam a coluna com ela mesma ───────────────────────────
drop policy if exists pedido_venda_audit_select_organization on public.pedido_venda_audit;
create policy pedido_venda_audit_select_organization
on public.pedido_venda_audit for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_venda_audit.pedido_venda_id
      and pedido.organization_id = pedido_venda_audit.organization_id
  )
);

drop policy if exists pedido_saldo_alerta_select_own_visible on public.pedido_saldo_alerta_preferencias;
drop policy if exists pedido_saldo_alerta_insert_own_visible on public.pedido_saldo_alerta_preferencias;
drop policy if exists pedido_saldo_alerta_update_own_visible on public.pedido_saldo_alerta_preferencias;
create policy pedido_saldo_alerta_select_own_visible
on public.pedido_saldo_alerta_preferencias for select to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_saldo_alerta_preferencias.pedido_venda_id
      and pedido.organization_id = pedido_saldo_alerta_preferencias.organization_id
  )
);
create policy pedido_saldo_alerta_insert_own_visible
on public.pedido_saldo_alerta_preferencias for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_saldo_alerta_preferencias.pedido_venda_id
      and pedido.organization_id = pedido_saldo_alerta_preferencias.organization_id
  )
);
create policy pedido_saldo_alerta_update_own_visible
on public.pedido_saldo_alerta_preferencias for update to authenticated
using (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
)
with check (
  organization_id = (select public.get_current_organization_id())
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos_venda pedido
    where pedido.id = pedido_saldo_alerta_preferencias.pedido_venda_id
      and pedido.organization_id = pedido_saldo_alerta_preferencias.organization_id
  )
);

drop policy if exists transportadora_usuarios_insert_admin on public.transportadora_usuarios;
drop policy if exists transportadora_usuarios_update_admin on public.transportadora_usuarios;
create policy transportadora_usuarios_insert_admin
on public.transportadora_usuarios for insert to authenticated
with check (
  organization_id = (select public.get_current_organization_id())
  and private.app_user_hierarchy((select auth.uid())) >= 80
  and exists (
    select 1 from public.app_users au
    where au.id = transportadora_usuarios.user_id
      and au.organization_id = transportadora_usuarios.organization_id
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
    where au.id = transportadora_usuarios.user_id
      and au.organization_id = transportadora_usuarios.organization_id
      and au.role = 'transportadora'
  )
);

notify pgrst, 'reload schema';
