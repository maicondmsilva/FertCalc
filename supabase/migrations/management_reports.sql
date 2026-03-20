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
