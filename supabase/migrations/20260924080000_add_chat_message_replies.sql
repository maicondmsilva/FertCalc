-- Respostas contextuais preservam um resumo seguro da mensagem citada.

alter table public.chat_messages
  add column if not exists reply_to_message_id uuid
    references public.chat_messages(id) on delete set null,
  add column if not exists reply_preview_body text,
  add column if not exists reply_preview_sender_name text;

alter table public.chat_messages
  add constraint chat_messages_reply_preview_body_length
    check (reply_preview_body is null or char_length(reply_preview_body) between 1 and 240),
  add constraint chat_messages_reply_preview_sender_length
    check (reply_preview_sender_name is null or char_length(reply_preview_sender_name) between 1 and 120);

create index if not exists chat_messages_reply_to_idx
  on public.chat_messages (reply_to_message_id)
  where reply_to_message_id is not null;

create or replace function private.chat_apply_reply(
  p_message_id uuid,
  p_reply_to_message_id uuid,
  p_conversation_id uuid,
  p_organization_id uuid
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  reply_message public.chat_messages;
  reply_sender_name text;
  updated_message public.chat_messages;
begin
  if caller_id is null
     or not private.chat_is_participant(p_conversation_id, caller_id) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  select message.*
  into reply_message
  from public.chat_messages message
  join public.chat_participants caller_participant
    on caller_participant.conversation_id = message.conversation_id
   and caller_participant.user_id = caller_id
  where message.id = p_reply_to_message_id
    and message.conversation_id = p_conversation_id
    and message.organization_id = p_organization_id
    and message.deleted_at is null
    and (
      caller_participant.cleared_at is null
      or message.created_at > caller_participant.cleared_at
    );

  if reply_message.id is null then
    raise exception 'Mensagem citada não encontrada nesta conversa.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(sender.nickname), ''), sender.name)
  into reply_sender_name
  from public.app_users sender
  where sender.id = reply_message.sender_id
    and sender.organization_id = p_organization_id;

  if reply_sender_name is null then
    raise exception 'Remetente da mensagem citada não encontrado.' using errcode = '22023';
  end if;

  update public.chat_messages message
  set reply_to_message_id = reply_message.id,
      reply_preview_body = left(reply_message.body, 240),
      reply_preview_sender_name = left(reply_sender_name, 120)
  where message.id = p_message_id
    and message.conversation_id = p_conversation_id
    and message.organization_id = p_organization_id
    and message.sender_id = caller_id
  returning message.* into updated_message;

  if updated_message.id is null then
    raise exception 'A mensagem de resposta não pertence ao usuário atual.' using errcode = '42501';
  end if;

  return updated_message;
end;
$$;

create or replace function public.send_chat_reply(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid,
  p_reply_to_message_id uuid
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_message public.chat_messages;
begin
  saved_message := public.send_chat_message(
    p_conversation_id,
    p_body,
    p_client_message_id
  );

  return private.chat_apply_reply(
    saved_message.id,
    p_reply_to_message_id,
    saved_message.conversation_id,
    saved_message.organization_id
  );
end;
$$;

create or replace function public.send_chat_reply_with_attachments(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid,
  p_attachments jsonb,
  p_reply_to_message_id uuid
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_message public.chat_messages;
begin
  saved_message := public.send_chat_message_with_attachments(
    p_conversation_id,
    p_body,
    p_client_message_id,
    p_attachments
  );

  return private.chat_apply_reply(
    saved_message.id,
    p_reply_to_message_id,
    saved_message.conversation_id,
    saved_message.organization_id
  );
end;
$$;

revoke all on function private.chat_apply_reply(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.send_chat_reply(uuid, text, uuid, uuid)
  from public, anon;
revoke all on function public.send_chat_reply_with_attachments(uuid, text, uuid, jsonb, uuid)
  from public, anon;
grant execute on function public.send_chat_reply(uuid, text, uuid, uuid)
  to authenticated;
grant execute on function public.send_chat_reply_with_attachments(uuid, text, uuid, jsonb, uuid)
  to authenticated;

comment on function public.send_chat_reply(uuid, text, uuid, uuid) is
  'Envia mensagem vinculada a uma mensagem não excluída da mesma conversa.';
comment on function public.send_chat_reply_with_attachments(uuid, text, uuid, jsonb, uuid) is
  'Envia resposta com anexos validados para uma mensagem da mesma conversa.';
