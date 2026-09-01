create index idx_credit_card_expenses_deleted_by
  on public.credit_card_expenses(deleted_by)
  where deleted_by is not null;
