-- ============================================================
-- RLS POLICIES - MANAGEMENT REPORTS
-- Execute este arquivo separadamente no SQL Editor do Supabase
-- caso as tabelas já existam mas estejam sem políticas RLS.
-- ============================================================

ALTER TABLE management_unidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_unidades" ON management_unidades;
CREATE POLICY "allow_all_management_unidades" ON management_unidades FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_categorias" ON management_categorias;
CREATE POLICY "allow_all_management_categorias" ON management_categorias FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_indicadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_indicadores" ON management_indicadores;
CREATE POLICY "allow_all_management_indicadores" ON management_indicadores FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_lancamentos" ON management_lancamentos;
CREATE POLICY "allow_all_management_lancamentos" ON management_lancamentos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_metas" ON management_metas;
CREATE POLICY "allow_all_management_metas" ON management_metas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_configuracoes_indicadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_configs" ON management_configuracoes_indicadores;
CREATE POLICY "allow_all_management_configs" ON management_configuracoes_indicadores FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE management_dias_uteis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_management_dias_uteis" ON management_dias_uteis;
CREATE POLICY "allow_all_management_dias_uteis" ON management_dias_uteis FOR ALL USING (true) WITH CHECK (true);
