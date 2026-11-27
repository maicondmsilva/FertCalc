-- Etapas 5–7: região também em Carregamento, Cotações de frete e Gastos com cartão.
-- A região é preenchida sozinha ao gravar (o usuário não precisa informar):
--   • carregamento: a do pedido; sem pedido, a principal de quem criou;
--   • cotação de frete: a do pedido ou da precificação; senão, a principal de quem solicitou;
--   • gasto com cartão: a principal do dono do gasto.
-- O acesso desses módulos não muda (filial / papel no módulo); a região serve
-- para filtrar e totalizar nos relatórios.

alter table public.carregamentos
  add column if not exists region_id uuid references public.regions (id);
alter table public.cotacoes_solicitadas
  add column if not exists region_id uuid references public.regions (id);
alter table public.credit_card_expenses
  add column if not exists region_id uuid references public.regions (id);

create index if not exists carregamentos_region_idx on public.carregamentos (region_id);
create index if not exists cotacoes_solicitadas_region_idx on public.cotacoes_solicitadas (region_id);
create index if not exists credit_card_expenses_region_idx on public.credit_card_expenses (region_id);

-- Região principal de um usuário (ou a única, se só tiver uma).
create or replace function private.regiao_principal_do_usuario(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ur.region_id from public.user_regions ur where ur.user_id = p_user_id and ur.principal limit 1),
    (select min(ur.region_id::text)::uuid from public.user_regions ur
      where ur.user_id = p_user_id
     having count(*) = 1)
  );
$$;
revoke all on function private.regiao_principal_do_usuario(uuid) from public, anon;

create or replace function private.preencher_regiao_carregamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.region_id is null then
    if new.pedido_venda_id is not null then
      select pv.region_id into new.region_id from public.pedidos_venda pv where pv.id = new.pedido_venda_id;
    end if;
    if new.region_id is null and new.pedido_precificacao_id is not null then
      select pr.region_id into new.region_id from public.pricing_records pr where pr.id = new.pedido_precificacao_id;
    end if;
    if new.region_id is null and new.criado_por is not null then
      new.region_id := private.regiao_principal_do_usuario(new.criado_por);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists preencher_regiao_carregamento on public.carregamentos;
create trigger preencher_regiao_carregamento before insert on public.carregamentos
  for each row execute function private.preencher_regiao_carregamento();

create or replace function private.preencher_regiao_cotacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.region_id is null then
    if new.pedido_venda_id is not null then
      select pv.region_id into new.region_id from public.pedidos_venda pv where pv.id = new.pedido_venda_id;
    end if;
    if new.region_id is null and new.precificacao_id is not null then
      select pr.region_id into new.region_id from public.pricing_records pr where pr.id = new.precificacao_id;
    end if;
    if new.region_id is null and new.solicitado_por is not null then
      new.region_id := private.regiao_principal_do_usuario(new.solicitado_por);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists preencher_regiao_cotacao on public.cotacoes_solicitadas;
create trigger preencher_regiao_cotacao before insert on public.cotacoes_solicitadas
  for each row execute function private.preencher_regiao_cotacao();

create or replace function private.preencher_regiao_gasto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.region_id is null and new.user_id is not null then
    new.region_id := private.regiao_principal_do_usuario(new.user_id::uuid);
  end if;
  return new;
end;
$$;
drop trigger if exists preencher_regiao_gasto on public.credit_card_expenses;
create trigger preencher_regiao_gasto before insert on public.credit_card_expenses
  for each row execute function private.preencher_regiao_gasto();

-- Registros que já existem: mesma regra.
update public.carregamentos c
   set region_id = coalesce(
     (select pv.region_id from public.pedidos_venda pv where pv.id = c.pedido_venda_id),
     (select pr.region_id from public.pricing_records pr where pr.id = c.pedido_precificacao_id),
     private.regiao_principal_do_usuario(c.criado_por))
 where c.region_id is null;

update public.cotacoes_solicitadas c
   set region_id = coalesce(
     (select pv.region_id from public.pedidos_venda pv where pv.id = c.pedido_venda_id),
     (select pr.region_id from public.pricing_records pr where pr.id = c.precificacao_id),
     private.regiao_principal_do_usuario(c.solicitado_por))
 where c.region_id is null;

update public.credit_card_expenses g
   set region_id = private.regiao_principal_do_usuario(g.user_id::uuid)
 where g.region_id is null and g.user_id is not null;
