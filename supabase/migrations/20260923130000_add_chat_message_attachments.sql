insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references public.app_users(id),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 150),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  created_at timestamptz not null default now()
);

create index chat_message_attachments_message_idx
  on public.chat_message_attachments (message_id, created_at);
create index chat_message_attachments_organization_idx
  on public.chat_message_attachments (organization_id, message_id);

alter table public.chat_message_attachments enable row level security;

create policy chat_attachments_select_participant
on public.chat_message_attachments for select to authenticated
using (
  organization_id = private.user_organization((select auth.uid()))
  and exists (
    select 1 from public.chat_messages message
    where message.id = chat_message_attachments.message_id
      and private.chat_is_participant(message.conversation_id, (select auth.uid()))
  )
);

create policy chat_attachment_objects_select_participant
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = private.user_organization((select auth.uid()))::text
  and private.chat_is_participant(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);

create policy chat_attachment_objects_insert_participant
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = private.user_organization((select auth.uid()))::text
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and private.chat_is_participant(((storage.foldername(name))[2])::uuid, (select auth.uid()))
);

create policy chat_attachment_objects_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = private.user_organization((select auth.uid()))::text
  and (storage.foldername(name))[3] = (select auth.uid())::text
);

create or replace function public.send_chat_message_with_attachments(
  p_conversation_id uuid,
  p_body text,
  p_client_message_id uuid,
  p_attachments jsonb
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_organization uuid;
  saved_message public.chat_messages;
  attachment jsonb;
  attachment_path text;
  attachment_name text;
  attachment_mime text;
  attachment_size bigint;
begin
  if caller_id is null then raise exception 'Sessão inválida.' using errcode = '28000'; end if;
  if not private.chat_is_participant(p_conversation_id, caller_id) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) not between 1 and 5 then
    raise exception 'Envie entre 1 e 5 anexos.' using errcode = '22023';
  end if;
  caller_organization := private.user_organization(caller_id);

  for attachment in select value from jsonb_array_elements(p_attachments) loop
    attachment_path := attachment->>'storage_path';
    attachment_name := btrim(attachment->>'file_name');
    attachment_mime := attachment->>'mime_type';
    attachment_size := (attachment->>'size_bytes')::bigint;
    if attachment_path not like caller_organization::text || '/' || p_conversation_id::text || '/' || caller_id::text || '/%'
       or char_length(attachment_name) not between 1 and 255
       or attachment_size not between 1 and 20971520
       or not exists (
         select 1 from storage.objects object
         where object.bucket_id = 'chat-attachments'
           and object.name = attachment_path
           and coalesce((object.metadata->>'size')::bigint, 0) = attachment_size
           and coalesce(object.metadata->>'mimetype', '') = attachment_mime
       ) then
      raise exception 'Anexo inválido ou upload incompleto.' using errcode = '22023';
    end if;
  end loop;

  saved_message := public.send_chat_message(
    p_conversation_id,
    coalesce(nullif(btrim(p_body), ''), '📎 Anexo'),
    p_client_message_id
  );

  for attachment in select value from jsonb_array_elements(p_attachments) loop
    insert into public.chat_message_attachments (
      message_id, organization_id, uploaded_by, storage_path, file_name, mime_type, size_bytes
    ) values (
      saved_message.id, caller_organization, caller_id,
      attachment->>'storage_path', btrim(attachment->>'file_name'),
      attachment->>'mime_type', (attachment->>'size_bytes')::bigint
    ) on conflict (storage_path) do nothing;
  end loop;
  return saved_message;
end;
$$;

create or replace function public.list_chat_message_attachments(p_conversation_id uuid)
returns setof public.chat_message_attachments
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;
  return query
  select attachment.* from public.chat_message_attachments attachment
  join public.chat_messages message on message.id = attachment.message_id
  where message.conversation_id = p_conversation_id and message.deleted_at is null
  order by attachment.created_at, attachment.id;
end;
$$;

revoke all on public.chat_message_attachments from public, anon, authenticated;
grant select on public.chat_message_attachments to authenticated;
grant select on public.chat_message_attachments to service_role;
revoke all on function public.send_chat_message_with_attachments(uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.list_chat_message_attachments(uuid) from public, anon;
grant execute on function public.send_chat_message_with_attachments(uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.list_chat_message_attachments(uuid) to authenticated;
alter publication supabase_realtime add table public.chat_message_attachments;
