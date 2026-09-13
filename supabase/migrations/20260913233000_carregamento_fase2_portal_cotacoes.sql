-- Fase 2: operações mínimas e seguras usadas pelo portal da transportadora.

alter table public.cotacoes_frete drop constraint if exists cotacoes_frete_status_check;
alter table public.cotacoes_frete add constraint cotacoes_frete_status_check
  check (status in ('pendente', 'respondida', 'recusada', 'aprovada', 'reprovada', 'expirada'));

drop policy if exists cotacoes_frete_update_assigned_carrier on public.cotacoes_frete;
create policy cotacoes_frete_update_assigned_carrier
on public.cotacoes_frete for update to authenticated
using (
  transportadora_id = (select private.current_transportadora_id())
  and status = 'pendente'
  and coalesce(arquivada, false) = false
)
with check (
  transportadora_id = (select private.current_transportadora_id())
  and status in ('respondida', 'recusada')
  and respondido_por = (select auth.uid())
  and coalesce(arquivada, false) = false
);

create or replace function private.enforce_carrier_quote_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if private.app_user_hierarchy((select auth.uid())) >= 20 then return new; end if;
  if old.transportadora_id is distinct from private.current_transportadora_id()
    or new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
    or new.carregamento_id is distinct from old.carregamento_id
    or new.transportadora_id is distinct from old.transportadora_id
    or new.solicitado_por is distinct from old.solicitado_por
    or new.criado_em is distinct from old.criado_em
    or new.arquivada is distinct from old.arquivada
    or new.arquivada_em is distinct from old.arquivada_em
    or new.arquivada_por is distinct from old.arquivada_por then
    raise exception 'carrier cannot change internal quote fields' using errcode = '42501';
  end if;
  if old.status <> 'pendente' or new.status not in ('respondida', 'recusada') then
    raise exception 'invalid carrier quote transition' using errcode = '23514';
  end if;
  new.respondido_por := (select auth.uid());
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.get_portal_transportadora_cotacoes()
returns table (
  id uuid, carregamento_id uuid, numero_carregamento text, tipo_frete text,
  quantidade_total numeric, data_prevista_carregamento date,
  local_carregamento text, cidade_origem text, estado_origem text,
  valor_cotado numeric, prazo_dias integer, validade_cotacao date,
  status text, observacoes text, criado_em timestamptz, atualizado_em timestamptz
)
language sql stable security definer set search_path = '' as $$
  select q.id, q.carregamento_id, c.numero_carregamento::text, c.tipo_frete::text,
    c.quantidade_total, c.data_prevista_carregamento::date,
    l.nome::text, l.cidade::text, l.estado::text,
    q.valor_cotado, q.prazo_dias, q.validade_cotacao,
    q.status::text, q.observacoes, q.criado_em, q.atualizado_em
  from public.cotacoes_frete q
  join public.carregamentos c on c.id=q.carregamento_id and c.organization_id=q.organization_id
  left join public.locais_carregamento l on l.id=c.local_carregamento_id
  where (select auth.uid()) is not null
    and q.transportadora_id = (select private.current_transportadora_id())
    and not q.arquivada
  order by case when q.status='pendente' then 0 else 1 end, q.criado_em desc;
$$;

revoke all on function public.get_portal_transportadora_cotacoes() from public, anon;
grant execute on function public.get_portal_transportadora_cotacoes() to authenticated;

create or replace function public.responder_cotacao_transportadora(
  p_cotacao_id uuid, p_aceitar boolean, p_valor_cotado numeric default null,
  p_prazo_dias integer default null, p_validade_cotacao date default null,
  p_observacoes text default null
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.current_transportadora_id() is null then
    raise exception 'carrier identity not found' using errcode='42501';
  end if;
  if p_aceitar and (p_valor_cotado is null or p_valor_cotado <= 0) then
    raise exception 'quoted value must be positive' using errcode='23514';
  end if;
  if p_prazo_dias is not null and p_prazo_dias < 0 then
    raise exception 'delivery days cannot be negative' using errcode='23514';
  end if;

  update public.cotacoes_frete set
    valor_cotado = case when p_aceitar then p_valor_cotado else null end,
    prazo_dias = case when p_aceitar then p_prazo_dias else null end,
    validade_cotacao = case when p_aceitar then p_validade_cotacao else null end,
    observacoes = nullif(left(btrim(coalesce(p_observacoes,'')), 1000), ''),
    status = case when p_aceitar then 'respondida' else 'recusada' end,
    respondido_por = (select auth.uid()), atualizado_em = now()
  where id=p_cotacao_id and transportadora_id=private.current_transportadora_id()
    and status='pendente' and not arquivada;
  if not found then raise exception 'quote unavailable' using errcode='P0002'; end if;
end;
$$;

revoke all on function public.responder_cotacao_transportadora(uuid,boolean,numeric,integer,date,text) from public, anon;
grant execute on function public.responder_cotacao_transportadora(uuid,boolean,numeric,integer,date,text) to authenticated;

