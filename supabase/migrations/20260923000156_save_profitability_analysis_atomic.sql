-- Atualiza somente a análise de rentabilidade de uma fórmula, sem a leitura e
-- regravação de todo o vetor no cliente. A função permanece sujeita às
-- políticas RLS de pricing_records.
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
begin
  if p_calculation_index < 0 then
    raise exception 'Índice da fórmula inválido.' using errcode = '22023';
  end if;

  if p_analysis is null or jsonb_typeof(p_analysis) <> 'object' then
    raise exception 'Análise de rentabilidade inválida.' using errcode = '22023';
  end if;

  update public.pricing_records
  set calculations = jsonb_set(
        calculations,
        array[p_calculation_index::text, 'profitabilityAnalysis'],
        p_analysis,
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
