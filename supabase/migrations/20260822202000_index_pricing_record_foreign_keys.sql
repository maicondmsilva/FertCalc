-- Cover legacy foreign keys used by pricing transfer and freight lookups.

create index idx_pricing_records_transfer_to_user_id
  on public.pricing_records (transfer_to_user_id);

create index idx_pricing_records_cotacao_frete_id
  on public.pricing_records (cotacao_frete_id);
