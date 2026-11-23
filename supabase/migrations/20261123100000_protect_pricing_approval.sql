-- Aprovação de precificações protegida no banco (antes só a tela controlava):
-- 1. Só aprova/reprova quem tem nível de gerente ou acima, ou a permissão
--    "Aprovar / Reprovar" (approvals_canApprove).
-- 2. Ninguém aprova/reprova a própria precificação, exceto o master (topo).
-- 3. Alterar o conteúdo comercial de uma precificação aprovada (composição,
--    fatores, resumo) faz ela voltar para "Pendente". Gravar a análise de
--    rentabilidade não conta como alteração.
-- 4. Precificação nova sempre nasce "Pendente".

create or replace function private.pricing_commercial_content(
  p_calculations jsonb,
  p_factors jsonb,
  p_summary jsonb,
  p_macros jsonb,
  p_micros jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'calculations', coalesce(
      (
        select jsonb_agg(item - 'profitabilityAnalysis' order by position)
        from jsonb_array_elements(coalesce(p_calculations, '[]'::jsonb))
          with ordinality as elements(item, position)
      ),
      '[]'::jsonb
    ),
    'factors', p_factors,
    'summary', p_summary,
    'macros', p_macros,
    'micros', p_micros
  );
$$;

create or replace function private.can_approve_pricing(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.app_user_hierarchy(p_user_id) >= 60
    or coalesce(
      (
        select (u.permissions ->> 'approvals_canApprove')::boolean
        from public.app_users u
        where u.id = p_user_id and u.ativo is true
      ),
      false
    );
$$;

create or replace function private.protect_pricing_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  -- Operações confiáveis do servidor (sem usuário logado) não passam por aqui.
  if caller_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'Pendente';
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     and new.approval_status in ('Aprovada', 'Reprovada') then
    if not private.can_approve_pricing(caller_id) then
      raise exception 'Seu usuário não tem permissão para aprovar ou reprovar precificações.'
        using errcode = '42501';
    end if;
    if new.user_id = caller_id::text and private.app_user_hierarchy(caller_id) < 100 then
      raise exception 'Não é permitido aprovar ou reprovar a própria precificação.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.approval_status = 'Aprovada'
     and new.approval_status = 'Aprovada'
     and private.pricing_commercial_content(
       new.calculations, new.factors, new.summary, new.macros, new.micros
     ) is distinct from private.pricing_commercial_content(
       old.calculations, old.factors, old.summary, old.macros, old.micros
     ) then
    new.approval_status := 'Pendente';
  end if;

  return new;
end;
$$;

revoke all on function private.can_approve_pricing(uuid) from public;
revoke all on function private.pricing_commercial_content(jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function private.protect_pricing_approval() from public;

drop trigger if exists protect_pricing_approval on public.pricing_records;
create trigger protect_pricing_approval
  before insert or update on public.pricing_records
  for each row execute function private.protect_pricing_approval();
