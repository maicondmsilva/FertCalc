-- Preserve the formula filter/category together with each saved batch.
-- Existing rows remain null because their original selection cannot be
-- reconstructed with certainty; the application treats them as "all".
alter table public.saved_formulas
  add column if not exists category text,
  add column if not exists target_ca numeric(8, 4),
  add column if not exists target_s numeric(8, 4);

comment on column public.saved_formulas.category is
  'Calculator composition category/filter selected when the batch was saved.';

comment on column public.saved_formulas.target_ca is
  'Calcium target selected when the batch was saved.';

comment on column public.saved_formulas.target_s is
  'Sulfur target selected when the batch was saved.';
