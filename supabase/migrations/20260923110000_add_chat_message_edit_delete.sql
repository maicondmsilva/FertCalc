create or replace function public.edit_chat_message(
  p_message_id uuid,
  p_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_body text := btrim(p_body);
  saved_message public.chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if normalized_body is null or char_length(normalized_body) not between 1 and 4000 then
    raise exception 'A mensagem deve possuir entre 1 e 4000 caracteres.' using errcode = '22023';
  end if;

  select message.*
  into saved_message
  from public.chat_messages message
  where message.id = p_message_id
  for update;

  if saved_message.id is null
     or saved_message.sender_id <> caller_id
     or not private.chat_is_participant(saved_message.conversation_id, caller_id) then
    raise exception 'Mensagem não encontrada ou acesso negado.' using errcode = '42501';
  end if;
  if saved_message.deleted_at is not null then
    raise exception 'Uma mensagem excluída não pode ser editada.' using errcode = '22023';
  end if;
  if saved_message.created_at < now() - interval '15 minutes' then
    raise exception 'O prazo de 15 minutos para editar esta mensagem terminou.' using errcode = '22023';
  end if;

  update public.chat_messages
  set body = normalized_body,
      edited_at = case when body is distinct from normalized_body then now() else edited_at end
  where id = p_message_id
  returning * into saved_message;

  return saved_message;
end;
$$;

create or replace function public.delete_chat_message(p_message_id uuid)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_message public.chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;

  select message.*
  into saved_message
  from public.chat_messages message
  where message.id = p_message_id
  for update;

  if saved_message.id is null
     or saved_message.sender_id <> caller_id
     or not private.chat_is_participant(saved_message.conversation_id, caller_id) then
    raise exception 'Mensagem não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  update public.chat_messages
  set body = '', deleted_at = coalesce(deleted_at, now())
  where id = p_message_id
  returning * into saved_message;

  return saved_message;
end;
$$;

create or replace function public.get_chat_messages(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns setof public.chat_messages
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'Limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'O cursor precisa conter data e identificador.' using errcode = '22023';
  end if;
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and (
      p_before_created_at is null
      or (message.created_at, message.id) < (p_before_created_at, p_before_id)
    )
  order by message.created_at desc, message.id desc
  limit p_limit;
end;
$$;

create or replace function public.get_chat_messages_after(
  p_conversation_id uuid,
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer default 100
)
returns setof public.chat_messages
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'Limite deve estar entre 1 e 100.' using errcode = '22023';
  end if;
  if p_after_created_at is null or p_after_id is null then
    raise exception 'O cursor de recuperação é obrigatório.' using errcode = '22023';
  end if;
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  return query
  select message.*
  from public.chat_messages message
  where message.conversation_id = p_conversation_id
    and (message.created_at, message.id) > (p_after_created_at, p_after_id)
  order by message.created_at, message.id
  limit p_limit;
end;
$$;

revoke all on function public.edit_chat_message(uuid, text) from public, anon;
revoke all on function public.delete_chat_message(uuid) from public, anon;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;

comment on function public.edit_chat_message(uuid, text) is
  'Edita mensagem própria em até 15 minutos, preservando autoria e conversa.';
comment on function public.delete_chat_message(uuid) is
  'Exclui logicamente mensagem própria e preserva sua posição na conversa.';
