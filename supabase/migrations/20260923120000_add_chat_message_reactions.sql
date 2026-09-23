create table public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index chat_message_reactions_organization_idx
  on public.chat_message_reactions (organization_id, message_id);
create index chat_message_reactions_user_idx
  on public.chat_message_reactions (user_id, created_at desc);

alter table public.chat_message_reactions enable row level security;

create policy chat_message_reactions_select_participant
on public.chat_message_reactions
for select
to authenticated
using (
  organization_id = private.user_organization((select auth.uid()))
  and exists (
    select 1
    from public.chat_messages message
    where message.id = chat_message_reactions.message_id
      and private.chat_is_participant(message.conversation_id, (select auth.uid()))
  )
);

create or replace function public.list_chat_message_reactions(p_conversation_id uuid)
returns table (
  message_id uuid,
  emoji text,
  reaction_count bigint,
  reacted_by_me boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.chat_is_participant(p_conversation_id, (select auth.uid())) then
    raise exception 'Conversa não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  return query
  select
    reaction.message_id,
    reaction.emoji,
    count(*)::bigint,
    bool_or(reaction.user_id = (select auth.uid()))
  from public.chat_message_reactions reaction
  join public.chat_messages message on message.id = reaction.message_id
  where message.conversation_id = p_conversation_id
    and message.deleted_at is null
  group by reaction.message_id, reaction.emoji
  order by reaction.message_id, min(reaction.created_at), reaction.emoji;
end;
$$;

create or replace function public.toggle_chat_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_emoji text := btrim(p_emoji);
  target_message public.chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if normalized_emoji is null or char_length(normalized_emoji) not between 1 and 16 then
    raise exception 'Reação inválida.' using errcode = '22023';
  end if;

  select message.*
  into target_message
  from public.chat_messages message
  where message.id = p_message_id;

  if target_message.id is null
     or target_message.deleted_at is not null
     or not private.chat_is_participant(target_message.conversation_id, caller_id) then
    raise exception 'Mensagem não encontrada ou acesso negado.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_message_id::text || ':' || caller_id::text || ':' || normalized_emoji, 0)
  );

  delete from public.chat_message_reactions reaction
  where reaction.message_id = p_message_id
    and reaction.user_id = caller_id
    and reaction.emoji = normalized_emoji;
  if found then
    return false;
  end if;

  insert into public.chat_message_reactions (
    message_id, organization_id, user_id, emoji
  ) values (
    target_message.id, target_message.organization_id, caller_id, normalized_emoji
  );
  return true;
end;
$$;

revoke all on public.chat_message_reactions from public, anon, authenticated;
grant select on public.chat_message_reactions to authenticated;
grant select on public.chat_message_reactions to service_role;

revoke all on function public.list_chat_message_reactions(uuid) from public, anon;
revoke all on function public.toggle_chat_message_reaction(uuid, text) from public, anon;
grant execute on function public.list_chat_message_reactions(uuid) to authenticated;
grant execute on function public.toggle_chat_message_reaction(uuid, text) to authenticated;

alter publication supabase_realtime add table public.chat_message_reactions;

comment on table public.chat_message_reactions is
  'Reações de participantes às mensagens do chat interno.';
