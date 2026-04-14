-- ─────────────────────────────────────────────────────────────────────────────
--  Fix: carregamentos_select RLS policy does not allow rows with NULL filial_id
--  NULL IN (...) evaluates to NULL/false, so non-admin users cannot see
--  carregamentos that have no filial assigned.
--  This migration adds `filial_id IS NULL` as an additional allowed condition.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "carregamentos_select" ON public.carregamentos;
CREATE POLICY "carregamentos_select" ON public.carregamentos FOR SELECT TO authenticated USING (
  filial_id IS NULL
  OR filial_id IN (SELECT filial_id FROM public.usuarios_filiais_carregamento WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master','manager'))
);
