-- FertCalc P0.7: close residual anonymous access to privileged functions.

alter function public.fn_proximo_numero_cotacao() set search_path = '';

revoke all on function public.fn_proximo_numero_cotacao() from public, anon;
grant execute on function public.fn_proximo_numero_cotacao() to authenticated;

-- Event-trigger handlers are invoked by PostgreSQL, never through the Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
