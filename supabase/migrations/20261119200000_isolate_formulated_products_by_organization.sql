-- Segurança: produtos formulados e histórico de preços passam a ser isolados por
-- empresa, como as batidas. Antes, a política "produtos_formulados_all" (USING true)
-- deixava qualquer usuário logado ler, alterar e apagar produtos de qualquer empresa,
-- anulando a regra de exclusão só para administradores; o histórico era lido por todos.

-- 1. Coluna de empresa nos produtos formulados, preenchida a partir da batida de
--    origem, de quem criou o produto ou, se houver uma única empresa, dela.
alter table public.produtos_formulados
  add column if not exists organization_id uuid references public.organizations(id);

update public.produtos_formulados p
set organization_id = f.organization_id
from public.saved_formulas f
where p.organization_id is null and p.saved_formula_id = f.id;

update public.produtos_formulados p
set organization_id = u.organization_id
from public.app_users u
where p.organization_id is null and p.criado_por = u.id::text;

update public.produtos_formulados
set organization_id = (select id from public.organizations limit 1)
where organization_id is null and (select count(*) from public.organizations) = 1;

alter table public.produtos_formulados alter column organization_id set not null;

create index if not exists idx_produtos_formulados_organization_id
  on public.produtos_formulados (organization_id);

-- 2. Histórico: empresa obrigatória (já preenchida), herdando do produto se faltar.
update public.historico_precos_formulados h
set organization_id = p.organization_id
from public.produtos_formulados p
where h.organization_id is null and h.produto_formulado_id = p.id;

alter table public.historico_precos_formulados alter column organization_id set not null;

-- 3. Empresa preenchida automaticamente no cadastro e imutável depois.
drop trigger if exists enforce_produtos_formulados_organization on public.produtos_formulados;
create trigger enforce_produtos_formulados_organization
  before insert or update on public.produtos_formulados
  for each row execute function private.enforce_row_organization();

drop trigger if exists enforce_historico_precos_organization on public.historico_precos_formulados;
create trigger enforce_historico_precos_organization
  before insert or update on public.historico_precos_formulados
  for each row execute function private.enforce_row_organization();

-- 4. Políticas: substitui todas as anteriores dessas duas tabelas.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('produtos_formulados', 'historico_precos_formulados')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

alter table public.produtos_formulados enable row level security;
alter table public.historico_precos_formulados enable row level security;

create policy produtos_formulados_select_organization on public.produtos_formulados
  for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));

-- Salvar batida cria/atualiza o produto (função save_formula_with_product),
-- então usuários da empresa continuam podendo inserir e atualizar.
create policy produtos_formulados_insert_organization on public.produtos_formulados
  for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id()));

create policy produtos_formulados_update_organization on public.produtos_formulados
  for update to authenticated
  using (organization_id = (select public.get_current_organization_id()))
  with check (organization_id = (select public.get_current_organization_id()));

-- Apagar de verdade: só administradores da própria empresa (o app arquiva).
create policy produtos_formulados_delete_admin on public.produtos_formulados
  for delete to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (select public.is_admin_or_master())
  );

create policy historico_precos_select_organization on public.historico_precos_formulados
  for select to authenticated
  using (organization_id = (select public.get_current_organization_id()));

create policy historico_precos_insert_organization on public.historico_precos_formulados
  for insert to authenticated
  with check (organization_id = (select public.get_current_organization_id()));
