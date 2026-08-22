-- Remove redundant legacy indexes while retaining their identical counterparts.

drop index if exists public.idx_expenses_period;
drop index if exists public.idx_expenses_status;
drop index if exists public.idx_expenses_user;
drop index if exists public.idx_expense_audit_expense;
