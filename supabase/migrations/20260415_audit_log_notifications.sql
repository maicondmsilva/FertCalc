-- =============================================================================
-- FertCalc Pro — Fase 9: Audit Log de Carregamentos
-- Migration: 20260415_audit_log_notifications.sql
-- Data: 2026-04-15
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela: audit_log (específica para carregamentos e cotações)
-- Nota: A tabela audit_logs (para precificações) já existe.
-- Esta tabela armazena dados_anteriores/dados_novos para operações de
-- edição e exclusão no módulo de carregamento.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela            TEXT        NOT NULL,             -- 'carregamentos' | 'cotacoes_solicitadas'
  registro_id       TEXT        NOT NULL,
  acao              TEXT        NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores  JSONB,
  dados_novos       JSONB,
  campos_alterados  TEXT[],
  motivo            TEXT,
  usuario_id        UUID        REFERENCES auth.users(id),
  usuario_nome      TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tabela_registro ON audit_log(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario         ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_criado_em       ON audit_log(criado_em DESC);

-- RLS: autenticados podem inserir e ler (histórico visível a todos os usuários do módulo)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log: autenticados inserem"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "audit_log: autenticados leem"
  ON audit_log FOR SELECT TO authenticated
  USING (true);

-- Audit log é imutável — sem UPDATE ou DELETE
