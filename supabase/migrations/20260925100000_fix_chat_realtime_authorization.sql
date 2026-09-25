-- Keep private chat Presence and typing channels restricted to the authenticated
-- user's active organization without exposing the generic organization resolver.

create or replace function private.chat_realtime_topic_allowed(
  p_topic text,
  p_user_id uuid,
  p_topic_prefix text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    and p_topic_prefix in ('chat-presence:', 'chat-typing:')
    and private.chat_user_enabled(p_user_id)
    and private.user_organization(p_user_id) is not null
    and p_topic = p_topic_prefix || private.user_organization(p_user_id)::text;
$$;

revoke all on function private.chat_realtime_topic_allowed(text, uuid, text)
from public, anon, authenticated;
grant execute on function private.chat_realtime_topic_allowed(text, uuid, text)
to authenticated;

drop policy if exists chat_presence_select_same_organization on realtime.messages;
create policy chat_presence_select_same_organization
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and private.chat_realtime_topic_allowed(
    (select realtime.topic()),
    (select auth.uid()),
    'chat-presence:'
  )
);

drop policy if exists chat_presence_insert_same_organization on realtime.messages;
create policy chat_presence_insert_same_organization
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.chat_realtime_topic_allowed(
    (select realtime.topic()),
    (select auth.uid()),
    'chat-presence:'
  )
);

drop policy if exists chat_typing_select_same_organization on realtime.messages;
create policy chat_typing_select_same_organization
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.chat_realtime_topic_allowed(
    (select realtime.topic()),
    (select auth.uid()),
    'chat-typing:'
  )
);

drop policy if exists chat_typing_insert_same_organization on realtime.messages;
create policy chat_typing_insert_same_organization
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and private.chat_realtime_topic_allowed(
    (select realtime.topic()),
    (select auth.uid()),
    'chat-typing:'
  )
);

comment on function private.chat_realtime_topic_allowed(text, uuid, text) is
  'Authorizes organization-scoped private Presence and typing topics without exposing tenant lookup helpers.';

