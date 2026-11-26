-- Limite de tentativas no login por apelido (função login-with-identifier).
-- Antes, a função não contava tentativas: dava para testar senhas de um
-- usuário sem parar. Agora: 5 falhas do mesmo usuário ou 20 do mesmo IP em
-- 15 minutos bloqueiam novas tentativas até a janela passar; um login certo
-- zera as falhas do usuário. Só o servidor (service_role) usa estas funções;
-- usuário e IP ficam guardados como hash.

create table if not exists public.login_failures (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  ip_hash text not null,
  failed_at timestamptz not null default now()
);
create index if not exists login_failures_identifier_idx on public.login_failures (identifier_hash, failed_at);
create index if not exists login_failures_ip_idx on public.login_failures (ip_hash, failed_at);

alter table public.login_failures enable row level security;
revoke all on public.login_failures from public, anon, authenticated;

create or replace function public.login_is_rate_limited(p_identifier text, p_ip text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.login_failures f
      where f.identifier_hash = md5(lower(btrim(p_identifier)))
        and f.failed_at > now() - interval '15 minutes') >= 5
    or
    (select count(*) from public.login_failures f
      where f.ip_hash = md5(coalesce(p_ip, ''))
        and f.failed_at > now() - interval '15 minutes') >= 20;
$$;

create or replace function public.login_record_failure(p_identifier text, p_ip text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_failures where failed_at < now() - interval '1 day';
  insert into public.login_failures (identifier_hash, ip_hash)
  values (md5(lower(btrim(p_identifier))), md5(coalesce(p_ip, '')));
$$;

create or replace function public.login_clear_failures(p_identifier text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_failures where identifier_hash = md5(lower(btrim(p_identifier)));
$$;

revoke all on function public.login_is_rate_limited(text, text) from public, anon, authenticated;
revoke all on function public.login_record_failure(text, text) from public, anon, authenticated;
revoke all on function public.login_clear_failures(text) from public, anon, authenticated;
grant execute on function public.login_is_rate_limited(text, text) to service_role;
grant execute on function public.login_record_failure(text, text) to service_role;
grant execute on function public.login_clear_failures(text) to service_role;
