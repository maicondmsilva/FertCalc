-- Mantém a operação privilegiada fora do schema exposto e publica apenas um wrapper invoker.

alter function public.aprovar_cotacao_frete(uuid) set schema private;

revoke all on function private.aprovar_cotacao_frete(uuid) from public, anon;
grant execute on function private.aprovar_cotacao_frete(uuid) to authenticated;

create function public.aprovar_cotacao_frete(p_cotacao_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.aprovar_cotacao_frete(p_cotacao_id);
$$;

revoke all on function public.aprovar_cotacao_frete(uuid) from public, anon;
grant execute on function public.aprovar_cotacao_frete(uuid) to authenticated;

comment on function public.aprovar_cotacao_frete(uuid) is
  'API autenticada para aprovação atômica de uma proposta de frete.';

