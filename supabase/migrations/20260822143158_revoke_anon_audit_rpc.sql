-- Supabase grants new public functions to API roles automatically.
-- Remove the anonymous grant explicitly; only authenticated clients may write.
revoke all on function public.write_audit_logs_entry(text, text, text, jsonb) from anon;
revoke all on function public.write_audit_log_entry(text, text, text, jsonb, jsonb, text[], text) from anon;
