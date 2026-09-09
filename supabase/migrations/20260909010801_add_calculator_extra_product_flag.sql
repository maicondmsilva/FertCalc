alter table public.macro_materials
  add column if not exists available_in_calculator_without_price_list boolean not null default false;

alter table public.micro_materials
  add column if not exists available_in_calculator_without_price_list boolean not null default false;

comment on column public.macro_materials.available_in_calculator_without_price_list is
  'Allows authorized users to see this material in the calculator when it is absent from the selected price list.';

comment on column public.micro_materials.available_in_calculator_without_price_list is
  'Allows authorized users to see this material in the calculator when it is absent from the selected price list.';
