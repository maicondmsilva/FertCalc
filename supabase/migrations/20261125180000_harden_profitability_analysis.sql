-- Rentabilidade: a permissão e a autoria passam a ser garantidas pelo banco.
-- Antes, a tela escondia o botão para quem não tinha permissão, mas qualquer
-- usuário que pudesse editar a precificação conseguia gravar uma análise pela
-- API, e "analisado por" / "analisado em" vinham do navegador (podiam ser
-- forjados). Agora:
--   * só manager ou acima, ou quem tem a permissão calculator_profitabilityCheck;
--   * autor, data, precificação e índice são carimbados pelo servidor;
--   * a análise tem tamanho máximo e números obrigatórios válidos.
-- Continua security invoker: as políticas RLS de pricing_records valem.
create or replace function public.save_profitability_analysis(
  p_pricing_record_id uuid,
  p_calculation_index integer,
  p_analysis jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_name text;
  stamped jsonb;
begin
  if caller_id is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  if private.app_user_hierarchy(caller_id) < 60
     and not private.current_user_has_permission('calculator_profitabilityCheck') then
    raise exception 'Seu usuário não tem permissão para gravar análise de rentabilidade.'
      using errcode = '42501';
  end if;

  if p_calculation_index is null or p_calculation_index < 0 then
    raise exception 'Índice da fórmula inválido.' using errcode = '22023';
  end if;

  if p_analysis is null or jsonb_typeof(p_analysis) <> 'object' then
    raise exception 'Análise de rentabilidade inválida.' using errcode = '22023';
  end if;

  if pg_column_size(p_analysis) > 16384 then
    raise exception 'Análise de rentabilidade muito grande.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_analysis -> 'unitaryPrice') <> 'number'
     or jsonb_typeof(p_analysis -> 'profitability') <> 'number'
     or jsonb_typeof(p_analysis -> 'profitabilityPercent') <> 'number' then
    raise exception 'Análise de rentabilidade incompleta.' using errcode = '22023';
  end if;

  select u.name into caller_name from public.app_users u where u.id = caller_id;

  stamped := p_analysis || jsonb_build_object(
    'pricingRecordId', p_pricing_record_id,
    'calculationIndex', p_calculation_index,
    'analyzedByUserId', caller_id,
    'analyzedByName', coalesce(caller_name, ''),
    'analyzedAt', to_jsonb(now())
  );

  update public.pricing_records
  set calculations = jsonb_set(
        calculations,
        array[p_calculation_index::text, 'profitabilityAnalysis'],
        stamped,
        true
      ),
      updated_at = now()
  where id = p_pricing_record_id
    and jsonb_typeof(calculations) = 'array'
    and jsonb_array_length(calculations) > p_calculation_index;

  if not found then
    raise exception 'Precificação ou fórmula não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_profitability_analysis(uuid, integer, jsonb) from public;
revoke all on function public.save_profitability_analysis(uuid, integer, jsonb) from anon;
grant execute on function public.save_profitability_analysis(uuid, integer, jsonb) to authenticated;
