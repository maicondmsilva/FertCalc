-- =============================================================================
-- FertCalc Pro — Row Level Security (RLS) — Todas as tabelas de negócio
-- Migration: 20260407000000_rls_all_tables.sql
-- Data: 2026-04-07
--
-- INSTRUÇÕES DE APLICAÇÃO:
--   1. Acesse o Supabase Dashboard > SQL Editor
--   2. Cole e execute este script completo
--   3. Verifique as políticas em Authentication > Policies
--
-- ROLES da aplicação (armazenados em app_users.role):
--   master  — acesso total irrestrito
--   admin   — acesso total dentro da organização
--   manager — acesso a dados próprios + subordinados
--   user    — acesso apenas a dados próprios
--
-- NOTA: A autenticação é feita via Supabase Auth. O user_id do Auth
--       corresponde ao campo id da tabela app_users.
-- =============================================================================

-- Helper function para obter o role do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM app_users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function para verificar se usuário é admin ou master
CREATE OR REPLACE FUNCTION is_admin_or_master()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'master') FROM app_users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function para verificar se usuário é manager, admin ou master
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT role IN ('manager', 'admin', 'master') FROM app_users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: retorna lista de IDs que o usuário gerencia
CREATE OR REPLACE FUNCTION get_managed_user_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(managed_user_ids, ARRAY[]::UUID[])
  FROM app_users
  WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =============================================================================
-- TABELA: app_users
-- =============================================================================
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Usuário pode ler seu próprio registro; admin/master leem todos
CREATE POLICY "app_users: leitura própria ou admin"
  ON app_users FOR SELECT
  USING (
    id = auth.uid()
    OR is_admin_or_master()
    OR is_manager_or_above()
  );

-- Apenas admin/master podem criar usuários
CREATE POLICY "app_users: inserção apenas admin/master"
  ON app_users FOR INSERT
  WITH CHECK (is_admin_or_master());

-- Usuário atualiza o próprio registro; admin/master atualizam qualquer um
CREATE POLICY "app_users: atualização própria ou admin"
  ON app_users FOR UPDATE
  USING (id = auth.uid() OR is_admin_or_master())
  WITH CHECK (id = auth.uid() OR is_admin_or_master());

-- Apenas admin/master podem deletar usuários
CREATE POLICY "app_users: exclusão apenas admin/master"
  ON app_users FOR DELETE
  USING (is_admin_or_master());

-- =============================================================================
-- TABELA: pricing_records
-- =============================================================================
ALTER TABLE pricing_records ENABLE ROW LEVEL SECURITY;

-- user_id do registro deve corresponder ao auth.uid(),
-- ou deve ser subordinado do manager, ou usuário é admin/master
CREATE POLICY "pricing_records: leitura por ownership ou hierarquia"
  ON pricing_records FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR (is_manager_or_above() AND user_id = ANY(get_managed_user_ids()))
  );

CREATE POLICY "pricing_records: inserção pelo próprio usuário"
  ON pricing_records FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_master());

CREATE POLICY "pricing_records: atualização por ownership ou admin"
  ON pricing_records FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR (is_manager_or_above() AND user_id = ANY(get_managed_user_ids()))
  );

CREATE POLICY "pricing_records: exclusão por ownership ou admin"
  ON pricing_records FOR DELETE
  USING (user_id = auth.uid() OR is_admin_or_master());

-- =============================================================================
-- TABELA: notifications
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuário lê as suas notificações ou as globais (user_id IS NULL)
CREATE POLICY "notifications: leitura própria ou global"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR is_admin_or_master());

CREATE POLICY "notifications: inserção autenticados"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications: atualização própria ou admin"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR is_admin_or_master());

CREATE POLICY "notifications: exclusão própria ou admin"
  ON notifications FOR DELETE
  USING (user_id = auth.uid() OR is_admin_or_master());

-- =============================================================================
-- TABELA: goals
-- =============================================================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: leitura por ownership ou hierarquia"
  ON goals FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR (is_manager_or_above() AND user_id = ANY(get_managed_user_ids()))
  );

CREATE POLICY "goals: inserção pelo próprio usuário ou admin"
  ON goals FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_master());

CREATE POLICY "goals: atualização por ownership ou admin/manager"
  ON goals FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_admin_or_master()
    OR (is_manager_or_above() AND user_id = ANY(get_managed_user_ids()))
  );

CREATE POLICY "goals: exclusão por ownership ou admin"
  ON goals FOR DELETE
  USING (user_id = auth.uid() OR is_admin_or_master());

-- =============================================================================
-- TABELAS DE CADASTRO (clients, agents, branches)
-- Acesso de leitura amplo para autenticados; escrita apenas para admin/master
-- =============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients: leitura para autenticados"
  ON clients FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "clients: escrita para admin/master"
  ON clients FOR INSERT WITH CHECK (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "clients: atualização para admin/master ou manager"
  ON clients FOR UPDATE USING (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "clients: exclusão para admin/master"
  ON clients FOR DELETE USING (is_admin_or_master());

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents: leitura para autenticados"
  ON agents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "agents: escrita para admin/master ou manager"
  ON agents FOR INSERT WITH CHECK (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "agents: atualização para admin/master ou manager"
  ON agents FOR UPDATE USING (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "agents: exclusão para admin/master"
  ON agents FOR DELETE USING (is_admin_or_master());

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches: leitura para autenticados"
  ON branches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "branches: escrita apenas admin/master"
  ON branches FOR INSERT WITH CHECK (is_admin_or_master());
CREATE POLICY "branches: atualização apenas admin/master"
  ON branches FOR UPDATE USING (is_admin_or_master());
CREATE POLICY "branches: exclusão apenas admin/master"
  ON branches FOR DELETE USING (is_admin_or_master());

-- =============================================================================
-- TABELAS DE MATERIAIS E PREÇOS
-- =============================================================================
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_lists: leitura para autenticados"
  ON price_lists FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "price_lists: escrita para admin/master ou manager"
  ON price_lists FOR INSERT WITH CHECK (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "price_lists: atualização para admin/master ou manager"
  ON price_lists FOR UPDATE USING (is_admin_or_master() OR is_manager_or_above());
CREATE POLICY "price_lists: exclusão para admin/master"
  ON price_lists FOR DELETE USING (is_admin_or_master());

ALTER TABLE macro_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "macro_materials: leitura para autenticados"
  ON macro_materials FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "macro_materials: escrita para admin/master"
  ON macro_materials FOR INSERT WITH CHECK (is_admin_or_master());
CREATE POLICY "macro_materials: atualização para admin/master"
  ON macro_materials FOR UPDATE USING (is_admin_or_master());
CREATE POLICY "macro_materials: exclusão para admin/master"
  ON macro_materials FOR DELETE USING (is_admin_or_master());

ALTER TABLE micro_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "micro_materials: leitura para autenticados"
  ON micro_materials FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "micro_materials: escrita para admin/master"
  ON micro_materials FOR INSERT WITH CHECK (is_admin_or_master());
CREATE POLICY "micro_materials: atualização para admin/master"
  ON micro_materials FOR UPDATE USING (is_admin_or_master());
CREATE POLICY "micro_materials: exclusão para admin/master"
  ON micro_materials FOR DELETE USING (is_admin_or_master());

-- =============================================================================
-- TABELA: saved_formulas
-- =============================================================================
ALTER TABLE saved_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_formulas: leitura própria ou admin"
  ON saved_formulas FOR SELECT
  USING (user_id = auth.uid() OR is_admin_or_master());
CREATE POLICY "saved_formulas: inserção pelo próprio usuário"
  ON saved_formulas FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_formulas: atualização pelo próprio usuário ou admin"
  ON saved_formulas FOR UPDATE
  USING (user_id = auth.uid() OR is_admin_or_master());
CREATE POLICY "saved_formulas: exclusão pelo próprio usuário ou admin"
  ON saved_formulas FOR DELETE
  USING (user_id = auth.uid() OR is_admin_or_master());

-- =============================================================================
-- TABELA: app_settings
-- =============================================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings: leitura para autenticados"
  ON app_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "app_settings: escrita apenas admin/master"
  ON app_settings FOR INSERT WITH CHECK (is_admin_or_master());
CREATE POLICY "app_settings: atualização apenas admin/master"
  ON app_settings FOR UPDATE USING (is_admin_or_master());
