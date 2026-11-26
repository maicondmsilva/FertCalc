-- Etapa 4: precificação por região.
--  • pricing_records.region_id: a região em que a precificação foi salva.
--  • Ao salvar: a região precisa ser uma das regiões do usuário (admin/master:
--    qualquer região ativa). Obrigatória assim que a empresa tiver regiões.
--  • A região não muda por edição: só pela transferência, que registra no
--    histórico quem, de onde, para onde e o motivo.
--  • Quem vê: o dono e a hierarquia (como antes), o gerente nas regiões dele e
--    quem tem "Ver precificações de todas as regiões".

alter table public.pricing_records
  add column if not exists region_id uuid references public.regions (id);
create index if not exists pricing_records_region_idx on public.pricing_records (region_id);

-- Regiões do usuário logado.
create or replace function private.current_user_region_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ur.region_id), '{}')
    from public.user_regions ur
   where ur.user_id = (select auth.uid());
$$;
revoke all on function private.current_user_region_ids() from public, anon;
grant execute on function private.current_user_region_ids() to authenticated;

-- Regras da região ao salvar e ao editar.
create or replace function private.guard_pricing_region()
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
  actor_level := private.app_user_hierarchy(actor_id);

  if tg_op = 'UPDATE' then
    if new.region_id is distinct from old.region_id
       and coalesce(current_setting('app.region_transfer', true), '') <> 'on' then
      raise exception 'A região da precificação só muda pela transferência de região.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- INSERT
  if new.region_id is null then
    if exists (
      select 1 from public.regions r
       where r.organization_id = new.organization_id and r.ativo
    ) then
      raise exception 'Escolha a região da precificação.' using errcode = '23502';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.regions r
     where r.id = new.region_id and r.organization_id = new.organization_id and r.ativo
  ) then
    raise exception 'Região inativa ou de outra empresa.' using errcode = '42501';
  end if;

  if actor_level < 80 and not (new.region_id = any (private.current_user_region_ids())) then
    raise exception 'Você só pode salvar precificações nas suas regiões.' using errcode = '42501';
  end if;

  return new;
end;
$$;
drop trigger if exists guard_pricing_region on public.pricing_records;
create trigger guard_pricing_region before insert or update on public.pricing_records
  for each row execute function private.guard_pricing_region();

-- Visibilidade: o que já existia + gerente pelas regiões + "todas as regiões".
drop policy if exists pricing_select on public.pricing_records;
create policy pricing_select on public.pricing_records for select to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (
      private.can_access_user_data(user_id)
      or transfer_to_user_id = (select auth.uid())
      or (region_id is not null
          and private.app_user_hierarchy((select auth.uid())) >= 60
          and region_id = any (private.current_user_region_ids()))
      or private.current_user_has_permission('pricing_viewAllRegions')
    )
  );

-- Editar: o que já existia + gerente nas suas regiões (ver todas não dá edição).
drop policy if exists pricing_update on public.pricing_records;
create policy pricing_update on public.pricing_records for update to authenticated
  using (
    organization_id = (select public.get_current_organization_id())
    and (
      private.can_access_user_data(user_id)
      or transfer_to_user_id = (select auth.uid())
      or (region_id is not null
          and private.app_user_hierarchy((select auth.uid())) >= 60
          and region_id = any (private.current_user_region_ids()))
    )
  );

-- Transferir para outra região (permissão própria; admin/master sempre).
create or replace function public.transferir_precificacao_regiao(
  p_pricing_id uuid,
  p_region_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
  actor_level integer;
  rec public.pricing_records%rowtype;
  from_name text;
  to_name text;
  motivo text := btrim(coalesce(p_motivo, ''));
begin
  if actor_id is null then
    raise exception 'Entre no sistema para transferir.' using errcode = '42501';
  end if;
  actor_level := private.app_user_hierarchy(actor_id);
  if actor_level < 80 and not private.current_user_has_permission('history_transferRegion') then
    raise exception 'Seu usuário não tem permissão para transferir precificações entre regiões.'
      using errcode = '42501';
  end if;
  if length(motivo) < 5 then
    raise exception 'Informe o motivo da transferência.' using errcode = '22023';
  end if;

  select * into rec from public.pricing_records where id = p_pricing_id
    and organization_id = public.get_current_organization_id();
  if not found then
    raise exception 'Precificação não encontrada.' using errcode = 'P0002';
  end if;
  -- Só transfere o que o usuário consegue ver.
  if actor_level < 80 and not (
    private.can_access_user_data(rec.user_id)
    or (rec.region_id is not null and rec.region_id = any (private.current_user_region_ids()))
    or private.current_user_has_permission('pricing_viewAllRegions')
  ) then
    raise exception 'Precificação fora do seu acesso.' using errcode = '42501';
  end if;
  if rec.status = 'Excluída' then
    raise exception 'Precificação excluída não pode ser transferida.' using errcode = '22023';
  end if;
  if rec.region_id is not distinct from p_region_id then
    raise exception 'A precificação já está nesta região.' using errcode = '22023';
  end if;

  select r.name into to_name from public.regions r
   where r.id = p_region_id and r.organization_id = rec.organization_id and r.ativo;
  if to_name is null then
    raise exception 'Região de destino inativa ou de outra empresa.' using errcode = '42501';
  end if;
  select r.name into from_name from public.regions r where r.id = rec.region_id;
  select u.name into actor_name from public.app_users u where u.id = actor_id;

  perform set_config('app.region_transfer', 'on', true);
  update public.pricing_records
     set region_id = p_region_id,
         updated_at = now(),
         history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'userId', actor_id::text,
           'userName', coalesce(actor_name, 'Usuário'),
           'action', format('Região transferida: %s → %s. Motivo: %s',
                            coalesce(from_name, 'sem região'), to_name, motivo)
         ))
   where id = p_pricing_id;
  perform set_config('app.region_transfer', '', true);
end;
$$;
revoke all on function public.transferir_precificacao_regiao(uuid, uuid, text) from public, anon;
grant execute on function public.transferir_precificacao_regiao(uuid, uuid, text) to authenticated;

-- Conta precificações de todas as visibilidades (o gerente de regiões pode não vê-las).
create or replace function private.region_has_pricings(p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pricing_records p where p.region_id = p_region_id);
$$;
revoke all on function private.region_has_pricings(uuid) from public, anon;
grant execute on function private.region_has_pricings(uuid) to authenticated;

-- Região com precificações também conta como "em uso" (desativa em vez de apagar).
create or replace function public.excluir_ou_desativar_regiao(p_region_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  in_use boolean;
begin
  if not private.can_manage_regions() then
    raise exception 'Sem permissão para gerenciar regiões.' using errcode = '42501';
  end if;
  select exists (select 1 from public.user_regions ur where ur.region_id = p_region_id)
      or private.region_has_pricings(p_region_id)
    into in_use;
  if in_use then
    update public.regions set ativo = false where id = p_region_id;
    if not found then
      raise exception 'Região não encontrada.' using errcode = 'P0002';
    end if;
    return 'desativada';
  end if;
  delete from public.regions where id = p_region_id;
  if not found then
    raise exception 'Região não encontrada.' using errcode = 'P0002';
  end if;
  return 'excluida';
end;
$$;
