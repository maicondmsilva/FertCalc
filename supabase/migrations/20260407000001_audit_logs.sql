-- =============================================================================
-- FertCalc Pro — Tabela de Auditoria
-- Migration: 20260407000001_audit_logs.sql
-- Data: 2026-04-07
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL,
  user_name   TEXT        NOT NULL,
  action      TEXT        NOT NULL,        -- Ex: 'pricing.approved', 'pricing.deleted'
  entity_type TEXT        NOT NULL,        -- Ex: 'pricing_record', 'goal', 'user'
  entity_id   TEXT        NOT NULL,
  metadata    JSONB,                       -- Dados relevantes no momento da ação
  created_at  TIMESTAMPTZ DEFAULT now()   NOT NULL
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx      ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx       ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx  ON audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx   ON audit_logs (created_at DESC);

-- RLS: INSERT para qualquer autenticado; SELECT apenas admin/master
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: inserção para autenticados"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_logs: leitura apenas admin/master"
  ON audit_logs FOR SELECT
  USING (is_admin_or_master());

-- Logs de auditoria são imutáveis — sem UPDATE ou DELETE
