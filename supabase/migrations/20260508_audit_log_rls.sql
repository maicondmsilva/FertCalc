-- =============================================================================
-- FertCalc Pro — Fase 3: Garantir RLS da tabela audit_log
-- Migration: 20260508_audit_log_rls.sql
-- Data: 2026-05-08
-- =============================================================================
-- Idempotente: recria as policies caso tenham sido removidas ou nunca aplicadas.

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated USING (true);
