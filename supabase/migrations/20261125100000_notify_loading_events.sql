-- Avisos do Carregamento gerados pelo banco: toda solicitação nova avisa a
-- logística da filial, e toda mudança de etapa avisa quem solicitou. Antes os
-- avisos dependiam da tela: "novo carregamento" e "liberado" nunca eram enviados.

create or replace function private.loading_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'aguardando_cotacao' then 'aguardando cotação'
    when 'cotacao_solicitada' then 'cotação solicitada'
    when 'cotacao_recebida' then 'cotação recebida'
    when 'aguardando_liberacao' then 'aguardando liberação'
    when 'liberado_parcial' then 'liberado parcialmente'
    when 'liberado_total' then 'liberado'
    when 'em_carregamento' then 'em carregamento'
    when 'carregado' then 'carregado'
    when 'cancelado' then 'cancelado'
    else p_status
  end;
$$;

create or replace function private.notify_loading_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
  numero text := coalesce(new.numero_carregamento, 'sem número');
  cliente text;
begin
  select coalesce(nullif(btrim(au.nickname), ''), au.name)
    into actor_name
  from public.app_users au
  where au.id = actor_id;
  actor_name := coalesce(actor_name, 'Sistema');

  select pv.cliente_nome_novo into cliente
  from public.pedidos_venda pv
  where pv.id = new.pedido_venda_id;

  if tg_op = 'INSERT' then
    -- Logística (liberar ou administrar carregamento) com acesso à filial.
    insert into public.notifications (
      user_id, title, message, date, read, is_read, type, data_id, group_type,
      action_url, metadata, sender_id, sender_name
    )
    select
      au.id::text,
      'Nova solicitação de carregamento',
      format('%s solicitou o carregamento %s%s (%s t).',
        actor_name, numero,
        case when cliente is not null then ' de ' || cliente else '' end,
        trim(to_char(new.quantidade_total, 'FM999G999G990D00'))),
      now()::text, false, false, 'NOVO_CARREGAMENTO', new.id::text, 'CARREGAMENTO',
      '/carregamento',
      jsonb_build_object('carregamentoId', new.id, 'numero', numero, 'status', new.status),
      actor_id, actor_name
    from public.app_users au
    where au.ativo
      and au.organization_id = new.organization_id
      and au.id is distinct from actor_id
      and (
        private.app_user_hierarchy(au.id) >= 80
        or coalesce((au.permissions ->> 'carregamento_liberar')::boolean, false)
        or coalesce((au.permissions ->> 'carregamento_admin')::boolean, false)
      )
      and (
        private.app_user_hierarchy(au.id) >= 80
        or coalesce((au.permissions ->> 'carregamento_all_filiais')::boolean, false)
        or new.filial_id = any(coalesce(au.carregamento_filial_ids, '{}'::uuid[]))
        or new.filial_id = any(coalesce(au.filiais_permitidas, '{}'::uuid[]))
      );
    return new;
  end if;

  -- Mudança de etapa: avisa quem solicitou (se não foi ele mesmo que mudou).
  if new.status is distinct from old.status
     and new.criado_por is not null
     and new.criado_por is distinct from actor_id then
    insert into public.notifications (
      user_id, title, message, date, read, is_read, type, data_id, group_type,
      action_url, metadata, sender_id, sender_name
    ) values (
      new.criado_por::text,
      case new.status
        when 'liberado_total' then 'Carregamento liberado'
        when 'liberado_parcial' then 'Carregamento liberado parcialmente'
        when 'carregado' then 'Carregamento concluído'
        when 'cancelado' then 'Carregamento cancelado'
        else 'Carregamento atualizado'
      end,
      format('O carregamento %s%s passou para "%s" (por %s).',
        numero,
        case when cliente is not null then ' de ' || cliente else '' end,
        private.loading_status_label(new.status), actor_name),
      now()::text, false, false,
      case when new.status in ('liberado_total', 'liberado_parcial')
        then 'CARREGAMENTO_APROVADO' else 'CARREGAMENTO_STATUS' end,
      new.id::text, 'CARREGAMENTO', '/carregamento',
      jsonb_build_object(
        'carregamentoId', new.id, 'numero', numero,
        'statusAnterior', old.status, 'status', new.status
      ),
      actor_id, actor_name
    );
  end if;

  return new;
end;
$$;

revoke all on function private.notify_loading_event() from public, anon, authenticated;
revoke all on function private.loading_status_label(text) from public, anon;

drop trigger if exists notify_loading_event on public.carregamentos;
create trigger notify_loading_event
  after insert or update of status on public.carregamentos
  for each row execute function private.notify_loading_event();
