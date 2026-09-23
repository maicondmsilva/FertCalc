create index if not exists chat_messages_sender_rate_idx
  on public.chat_messages (sender_id, created_at desc);

create table private.chat_operation_metrics (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  operation text not null check (operation in ('message_send', 'message_recovery', 'realtime_connection')),
  status text not null check (status in ('success', 'error')),
  duration_ms integer check (duration_ms between 0 and 120000),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 4096),
  created_at timestamptz not null default now()
);
create index chat_operation_metrics_created_at_idx on private.chat_operation_metrics (created_at);

create table private.chat_retention_policies (
  dataset text primary key check (dataset in ('operation_metrics', 'messages')),
  retention_days integer not null check (retention_days between 30 and 3650),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.chat_retention_policies (dataset, retention_days, enabled) values
  ('operation_metrics', 90, true),
  ('messages', 365, false)
on conflict (dataset) do nothing;

create or replace function public.record_chat_operation_metric(
  p_operation text, p_status text, p_duration_ms integer default null,
  p_details jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not private.chat_user_enabled(caller_id) then
    raise exception 'Usuário sem acesso ao chat.' using errcode = '42501';
  end if;
  if p_operation not in ('message_send', 'message_recovery', 'realtime_connection')
     or p_status not in ('success', 'error')
     or (p_duration_ms is not null and p_duration_ms not between 0 and 120000)
     or pg_column_size(coalesce(p_details, '{}'::jsonb)) > 4096 then
    raise exception 'Métrica operacional inválida.' using errcode = '22023';
  end if;
  insert into private.chat_operation_metrics (
    organization_id, user_id, operation, status, duration_ms, details
  ) values (
    private.user_organization(caller_id), caller_id, p_operation, p_status,
    p_duration_ms, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.send_chat_message(
  p_conversation_id uuid, p_body text, p_client_message_id uuid
) returns public.chat_messages language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  conversation_organization uuid;
  normalized_body text := btrim(p_body);
  saved_message public.chat_messages;
begin
  if caller_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
  if p_client_message_id is null then raise exception 'Identificador da mensagem é obrigatório.' using errcode = '22023'; end if;
  if char_length(normalized_body) not between 1 and 4000 then raise exception 'A mensagem deve possuir entre 1 e 4000 caracteres.' using errcode = '22023'; end if;
  if not private.chat_is_participant(p_conversation_id, caller_id) then raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if (select count(*) from public.chat_messages recent
      where recent.sender_id = caller_id and recent.created_at >= now() - interval '1 minute') >= 30 then
    raise exception 'Limite de 30 mensagens por minuto atingido. Aguarde para continuar.' using errcode = 'P0001';
  end if;
  select organization_id into conversation_organization from public.chat_conversations where id = p_conversation_id;
  insert into public.chat_messages (conversation_id, organization_id, sender_id, client_message_id, body)
  values (p_conversation_id, conversation_organization, caller_id, p_client_message_id, normalized_body)
  on conflict (sender_id, client_message_id) do nothing returning * into saved_message;
  if saved_message.id is null then
    select * into saved_message from public.chat_messages where sender_id = caller_id and client_message_id = p_client_message_id;
    if saved_message.conversation_id <> p_conversation_id or saved_message.body <> normalized_body then
      raise exception 'Identificador já utilizado por outra mensagem.' using errcode = '23505';
    end if;
    return saved_message;
  end if;
  update public.chat_conversations set last_message_at = saved_message.created_at,
    updated_at = saved_message.created_at where id = p_conversation_id;
  return saved_message;
end;
$$;

revoke all on private.chat_operation_metrics, private.chat_retention_policies from public, anon, authenticated;
revoke all on function public.record_chat_operation_metric(text, text, integer, jsonb) from public, anon;
grant execute on function public.record_chat_operation_metric(text, text, integer, jsonb) to authenticated;
grant select on private.chat_operation_metrics, private.chat_retention_policies to service_role;
grant usage, select on sequence private.chat_operation_metrics_id_seq to service_role;

comment on table private.chat_retention_policies is
  'Política do chat: métricas por 90 dias; mensagens em 365 dias, desativada até aprovação formal.';
