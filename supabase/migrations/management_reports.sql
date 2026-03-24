-- Tabela: unidades (unidades de negócio)
CREATE TABLE IF NOT EXISTS management_unidades (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem_exibicao INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: categorias de indicadores
CREATE TABLE IF NOT EXISTS management_categorias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: indicadores
CREATE TABLE IF NOT EXISTS management_indicadores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade_medida TEXT NOT NULL,
  digitavel BOOLEAN DEFAULT TRUE,
  ordem INTEGER DEFAULT 0,
  formula TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: lançamentos diários
CREATE TABLE IF NOT EXISTS management_lancamentos (
  id TEXT PRIMARY KEY,
  data DATE NOT NULL,
  unidade_id TEXT NOT NULL,
  indicador_id TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  observacao TEXT,
  usuario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: metas mensais
CREATE TABLE IF NOT EXISTS management_metas (
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  indicador_id TEXT NOT NULL,
  valor_meta NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: configurações de indicadores por unidade
CREATE TABLE IF NOT EXISTS management_configuracoes_indicadores (
  unidade_id TEXT NOT NULL,
  indicador_id TEXT NOT NULL,
  nome_personalizado TEXT,
  visivel BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (unidade_id, indicador_id)
);

-- Tabela: dias úteis por mês
CREATE TABLE IF NOT EXISTS management_dias_uteis (
  unidade_id TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  total_dias_uteis INTEGER DEFAULT 0,
  PRIMARY KEY (unidade_id, ano, mes)
);

-- ============================================================
-- RLS POLICIES - MANAGEMENT REPORTS
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

-- Adicionar coluna formula à tabela management_indicadores (migração para bancos existentes)
ALTER TABLE management_indicadores ADD COLUMN IF NOT EXISTS formula TEXT;
