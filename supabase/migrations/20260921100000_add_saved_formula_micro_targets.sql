-- Persiste as garantias-alvo de micronutrientes junto da fórmula salva.

alter table public.saved_formulas
  add column if not exists target_micros jsonb not null default '{}'::jsonb;

alter table public.saved_formulas
  drop constraint if exists saved_formulas_target_micros_object_check,
  add constraint saved_formulas_target_micros_object_check
    check (jsonb_typeof(target_micros) = 'object');

comment on column public.saved_formulas.target_micros is
  'Mapa de micronutriente para garantia-alvo percentual usada pelo solver.';

notify pgrst, 'reload schema';
