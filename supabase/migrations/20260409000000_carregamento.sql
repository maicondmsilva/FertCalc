-- ─────────────────────────────────────────────────────────────────────────────
--  Módulo de Carregamento — Migration
--  Cria tabelas, RLS policies e dados de seed (filiais / transportadoras)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Filiais de Carregamento ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filiais_carregamento (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    VARCHAR(200) NOT NULL,
  codigo  VARCHAR(10)  UNIQUE NOT NULL,
  cidade  VARCHAR(100),
  estado  VARCHAR(2),
  ativo   BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Transportadoras ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transportadoras (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome     VARCHAR(200) NOT NULL,
  cnpj     VARCHAR(18)  UNIQUE,
  contato  VARCHAR(100),
  telefone VARCHAR(20),
  email    VARCHAR(200),
  ativo    BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Usuários ↔ Filiais (associação) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_filiais_carregamento (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais_carregamento(id) ON DELETE CASCADE,
  UNIQUE (user_id, filial_id)
);

-- ── 4. Carregamentos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carregamentos (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_precificacao_id      UUID,
  numero_carregamento         VARCHAR(20) UNIQUE NOT NULL,
  filial_id                   UUID REFERENCES filiais_carregamento(id),
  tipo_frete                  VARCHAR(3)  NOT NULL CHECK (tipo_frete IN ('CIF','FOB')),
  status                      VARCHAR(30) NOT NULL DEFAULT 'aguardando_cotacao'
                                CHECK (status IN (
                                  'aguardando_cotacao',
                                  'cotacao_solicitada',
                                  'cotacao_recebida',
                                  'aguardando_liberacao',
                                  'liberado_parcial',
                                  'liberado_total',
                                  'em_carregamento',
                                  'carregado',
                                  'cancelado'
                                )),
  tipo_liberacao              VARCHAR(10)  CHECK (tipo_liberacao IN ('total','parcial')),
  quantidade_total            NUMERIC(15,3) NOT NULL,
  quantidade_liberada         NUMERIC(15,3) NOT NULL DEFAULT 0,
  quantidade_carregada        NUMERIC(15,3) NOT NULL DEFAULT 0,
  saldo_disponivel            NUMERIC(15,3),
  data_prevista_carregamento  DATE,
  data_real_carregamento      DATE,
  data_solicitacao_cotacao    TIMESTAMPTZ,
  data_liberacao              TIMESTAMPTZ,
  transportadora_id           UUID REFERENCES transportadoras(id),
  valor_frete                 NUMERIC(15,2),
  valor_frete_unitario        NUMERIC(15,4),
  observacoes                 TEXT,
  obs_logistica               TEXT,
  liberado_por                UUID REFERENCES auth.users(id),
  criado_por                  UUID REFERENCES auth.users(id),
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Cotações de Frete ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotacoes_frete (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id   UUID REFERENCES carregamentos(id) ON DELETE CASCADE,
  transportadora_id UUID REFERENCES transportadoras(id),
  valor_cotado      NUMERIC(15,2),
  prazo_dias        INTEGER,
  validade_cotacao  DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','aprovada','reprovada','expirada')),
  observacoes       TEXT,
  arquivo_cotacao   TEXT,
  solicitado_por    UUID REFERENCES auth.users(id),
  respondido_por    UUID REFERENCES auth.users(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. Alertas de Carregamento ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas_carregamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id  UUID REFERENCES carregamentos(id) ON DELETE CASCADE,
  tipo             VARCHAR(50)  NOT NULL,
  mensagem         TEXT         NOT NULL,
  lido             BOOLEAN      NOT NULL DEFAULT false,
  destinatario_id  UUID REFERENCES auth.users(id),
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 7. Histórico de Status ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_carregamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id  UUID REFERENCES carregamentos(id) ON DELETE CASCADE,
  status_anterior  VARCHAR(30),
  status_novo      VARCHAR(30),
  descricao        TEXT,
  alterado_por     UUID REFERENCES auth.users(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carregamentos_status        ON carregamentos (status);
CREATE INDEX IF NOT EXISTS idx_carregamentos_filial        ON carregamentos (filial_id);
CREATE INDEX IF NOT EXISTS idx_carregamentos_tipo_frete    ON carregamentos (tipo_frete);
CREATE INDEX IF NOT EXISTS idx_carregamentos_data_prevista ON carregamentos (data_prevista_carregamento);
CREATE INDEX IF NOT EXISTS idx_cotacoes_carregamento       ON cotacoes_frete (carregamento_id);
CREATE INDEX IF NOT EXISTS idx_alertas_destinatario        ON alertas_carregamento (destinatario_id, lido);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE filiais_carregamento          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportadoras               ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_filiais_carregamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE carregamentos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes_frete                ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_carregamento          ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_carregamento        ENABLE ROW LEVEL SECURITY;

-- Filiais: authenticated users can read; only admins write
CREATE POLICY "filiais_read"  ON filiais_carregamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "filiais_write" ON filiais_carregamento FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- Transportadoras: authenticated users can read; only admins write
CREATE POLICY "transportadoras_read"  ON transportadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportadoras_write" ON transportadoras FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- Usuários ↔ Filiais: authenticated read; admin write
CREATE POLICY "usuarios_filiais_read"  ON usuarios_filiais_carregamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios_filiais_write" ON usuarios_filiais_carregamento FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- Carregamentos: users see their filial or admins see all
CREATE POLICY "carregamentos_select" ON carregamentos FOR SELECT TO authenticated USING (
  filial_id IN (
    SELECT filial_id FROM usuarios_filiais_carregamento WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master','manager')
  )
);
CREATE POLICY "carregamentos_insert" ON carregamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "carregamentos_update" ON carregamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "carregamentos_delete" ON carregamentos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

-- Cotações: authenticated users can read and write
CREATE POLICY "cotacoes_all" ON cotacoes_frete FOR ALL TO authenticated USING (true);

-- Alertas: users see their own alerts
CREATE POLICY "alertas_read"  ON alertas_carregamento FOR SELECT TO authenticated USING (
  destinatario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "alertas_write" ON alertas_carregamento FOR ALL TO authenticated USING (true);

-- Histórico: authenticated can read and write
CREATE POLICY "historico_all" ON historico_carregamento FOR ALL TO authenticated USING (true);

-- ── Seed: Filiais ─────────────────────────────────────────────────────────────
INSERT INTO filiais_carregamento (nome, codigo, cidade, estado)
VALUES
  ('Filial São Paulo',        'SP01', 'São Paulo',      'SP'),
  ('Filial Campinas',         'CP01', 'Campinas',       'SP'),
  ('Filial Ribeirão Preto',   'RP01', 'Ribeirão Preto', 'SP'),
  ('Filial Belo Horizonte',   'BH01', 'Belo Horizonte', 'MG'),
  ('Filial Cuiabá',           'CU01', 'Cuiabá',         'MT'),
  ('Filial Rondonópolis',     'RO01', 'Rondonópolis',   'MT'),
  ('Filial Sorriso',          'SO01', 'Sorriso',        'MT'),
  ('Filial Sinop',            'SI01', 'Sinop',          'MT')
ON CONFLICT (codigo) DO NOTHING;

-- ── Seed: Transportadoras ─────────────────────────────────────────────────────
INSERT INTO transportadoras (nome, cnpj, contato, telefone, email)
VALUES
  ('Transportadora Agrolog',    '11.222.333/0001-44', 'Carlos Silva',   '(65) 3333-1111', 'comercial@agrolog.com.br'),
  ('TransBrasil Cargas',        '22.333.444/0001-55', 'Maria Santos',   '(11) 4444-2222', 'frete@transbrasil.com.br'),
  ('LogAgro Express',           '33.444.555/0001-66', 'João Oliveira',  '(67) 5555-3333', 'logagro@express.com.br'),
  ('Cargas do Centro-Oeste',    '44.555.666/0001-77', 'Ana Costa',      '(65) 6666-4444', 'contato@cargasco.com.br'),
  ('Fretamento Rural',          '55.666.777/0001-88', 'Paulo Pereira',  '(66) 7777-5555', 'frete@rural.com.br')
ON CONFLICT (cnpj) DO NOTHING;
