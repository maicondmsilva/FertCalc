-- Primeiro acesso: só sai da troca obrigatória quem realmente trocou a senha.
-- Antes, o próprio usuário podia mudar requer_alteracao_senha de true para
-- false direto pela API, sem trocar a senha, e entrar com a senha provisória
-- definida pelo administrador. Agora o banco guarda o hash da senha provisória
-- no momento em que a troca é exigida e só libera a saída quando o hash atual
-- for diferente.

create table if not exists private.first_access_password (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_hash text,
  captured_at timestamptz not null default now()
);
revoke all on private.first_access_password from public, anon, authenticated;

-- Guarda o hash quando a troca passa a ser exigida (criação ou nova senha provisória).
create or replace function private.capture_first_access_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requer_alteracao_senha is true then
    insert into private.first_access_password (user_id, password_hash, captured_at)
    select au.id, au.encrypted_password, now() from auth.users au where au.id = new.id
    on conflict (user_id) do update
      set password_hash = excluded.password_hash, captured_at = excluded.captured_at;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_first_access_password() from public, anon, authenticated;

drop trigger if exists capture_first_access_password on public.app_users;
create trigger capture_first_access_password
  after insert or update of requer_alteracao_senha on public.app_users
  for each row execute function private.capture_first_access_password();

-- Usuários que já estão com a troca pendente.
insert into private.first_access_password (user_id, password_hash)
select u.id, au.encrypted_password
from public.app_users u join auth.users au on au.id = u.id
where u.requer_alteracao_senha is true
on conflict (user_id) do nothing;

-- Mesma regra de antes, com a conferência da senha na saída do primeiro acesso.
create or replace function private.enforce_app_users_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_hierarchy integer;
  new_role_hierarchy integer;
  provisional_hash text;
  current_hash text;
begin
  -- Operacoes confiaveis do servidor (postgres/service_role) nao possuem auth.uid().
  if caller_id is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.id_numeric is distinct from old.id_numeric
    or new.created_at is distinct from old.created_at
    or new.password is distinct from old.password then
    raise exception 'immutable app_users fields cannot be changed'
      using errcode = '42501';
  end if;

  if caller_id = old.id and not private.can_manage_app_user(old.id) then
    if new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.permissions is distinct from old.permissions
      or new.managed_user_ids is distinct from old.managed_user_ids
      or new.ativo is distinct from old.ativo
      or new.filiais_permitidas is distinct from old.filiais_permitidas
      or new.carregamento_filial_ids is distinct from old.carregamento_filial_ids
      or new.access_profile_id is distinct from old.access_profile_id then
      raise exception 'users cannot change their own authorization fields'
        using errcode = '42501';
    end if;

    if new.requer_alteracao_senha is distinct from old.requer_alteracao_senha then
      if not (old.requer_alteracao_senha is true and new.requer_alteracao_senha is false) then
        raise exception 'invalid first-access flag transition'
          using errcode = '42501';
      end if;
      select f.password_hash into provisional_hash
        from private.first_access_password f where f.user_id = old.id;
      select au.encrypted_password into current_hash from auth.users au where au.id = old.id;
      if provisional_hash is not null and current_hash is not distinct from provisional_hash then
        raise exception 'Defina uma nova senha antes de concluir o primeiro acesso.'
          using errcode = '42501';
      end if;
      delete from private.first_access_password f where f.user_id = old.id;
    end if;

    return new;
  end if;

  if not private.can_manage_app_user(old.id) then
    raise exception 'insufficient hierarchy to update this user'
      using errcode = '42501';
  end if;

  caller_hierarchy := private.app_user_hierarchy(caller_id);
  select coalesce(
    (select al.hierarchy_level from public.access_levels al where al.code = new.role),
    0
  ) into new_role_hierarchy;

  if new_role_hierarchy > caller_hierarchy
    or (new_role_hierarchy = 100 and caller_hierarchy < 100) then
    raise exception 'cannot assign a role above the caller hierarchy'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
