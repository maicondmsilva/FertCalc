-- Segurança: catálogo, metas e exclusão de precificação.
--
-- 1. Embalagens: qualquer usuário logado criava, alterava e excluía. Agora
--    só admin ou acima altera (leitura continua para todos os logados).
-- 2. Categorias e regras de incompatibilidade: escrita alinhada aos produtos
--    (admin ou acima; antes gerente).
-- 3. Metas: o próprio usuário não aprova nem reprova a sua meta (só admin ou
--    acima pode decidir a própria). Meta aprovada que muda de valor, tipo ou
--    período volta para "Pendente".
-- 4. Precificação aprovada só vira "Excluída" pela aprovação de exclusão, feita
--    por gerente ou acima que não seja o dono (admin ou acima pode a própria).

-- 1. Embalagens
drop policy if exists embalagens_all on public.embalagens;
drop policy if exists embalagens_select_authenticated on public.embalagens;
drop policy if exists embalagens_write_admin on public.embalagens;
revoke all on public.embalagens from anon;

create policy embalagens_select_authenticated on public.embalagens
  for select to authenticated
  using (true);

create policy embalagens_write_admin on public.embalagens
  for all to authenticated
  using (private.app_user_hierarchy((select auth.uid())) >= 80)
  with check (private.app_user_hierarchy((select auth.uid())) >= 80);

-- 2. Categorias e regras de incompatibilidade
drop policy if exists compatibility_categories_write on public.compatibility_categories;
create policy compatibility_categories_write on public.compatibility_categories
  for all to authenticated
  using (private.app_user_hierarchy((select auth.uid())) >= 80)
  with check (private.app_user_hierarchy((select auth.uid())) >= 80);

drop policy if exists incompatibility_rules_write on public.incompatibility_rules;
create policy incompatibility_rules_write on public.incompatibility_rules
  for all to authenticated
  using (private.app_user_hierarchy((select auth.uid())) >= 80)
  with check (private.app_user_hierarchy((select auth.uid())) >= 80);

-- 3. Metas
create or replace function private.guard_goal_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level integer;
begin
  -- Gravações internas (sem usuário da API) não passam por esta regra.
  if actor_id is null then
    return new;
  end if;
  actor_level := private.app_user_hierarchy(actor_id);

  if tg_op = 'INSERT' then
    if actor_level < 80 then
      new.status := 'Pendente';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('Aprovada', 'Reprovada') then
    if actor_level < 60 then
      raise exception 'Seu usuário não tem permissão para aprovar ou reprovar metas.'
        using errcode = '42501';
    end if;
    if new.user_id = actor_id::text and actor_level < 80 then
      raise exception 'Não é permitido aprovar ou reprovar a própria meta.'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'Aprovada'
     and new.status = 'Aprovada'
     and actor_level < 80
     and (
       new.target_value is distinct from old.target_value
       or new.type is distinct from old.type
       or new.month is distinct from old.month
       or new.year is distinct from old.year
       or new.user_id is distinct from old.user_id
     ) then
    new.status := 'Pendente';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_goal_approval() from public, anon, authenticated;

drop trigger if exists guard_goal_approval on public.goals;
create trigger guard_goal_approval
  before insert or update on public.goals
  for each row execute function private.guard_goal_approval();

-- 4. Exclusão de precificação aprovada
create or replace function private.guard_pricing_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_level integer;
begin
  if actor_id is null then
    return new;
  end if;

  if new.status = 'Excluída'
     and old.status is distinct from 'Excluída'
     and old.approval_status = 'Aprovada' then
    actor_level := private.app_user_hierarchy(actor_id);
    if actor_level < 60 then
      raise exception 'Precificação aprovada só pode ser excluída pela aprovação de exclusão.'
        using errcode = '42501';
    end if;
    if old.user_id = actor_id::text and actor_level < 80 then
      raise exception 'A exclusão da própria precificação aprovada precisa ser aprovada por outra pessoa.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_pricing_deletion() from public, anon, authenticated;

drop trigger if exists guard_pricing_deletion on public.pricing_records;
create trigger guard_pricing_deletion
  before update of status on public.pricing_records
  for each row execute function private.guard_pricing_deletion();
