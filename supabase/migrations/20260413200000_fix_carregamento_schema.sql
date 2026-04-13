-- ─────────────────────────────────────────────────────────────────────────────
--  Fix: ensure all carregamento tables are in the public schema
--  This migration is idempotent and safe to run multiple times
-- ─────────────────────────────────────────────────────────────────────────────

-- Move tables to public schema if they exist outside it
DO $$
DECLARE
  v_schema TEXT;
BEGIN
  -- carregamentos
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'carregamentos' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.carregamentos SET SCHEMA public';
  END IF;

  -- cotacoes_frete
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'cotacoes_frete' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.cotacoes_frete SET SCHEMA public';
  END IF;

  -- filiais_carregamento
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'filiais_carregamento' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.filiais_carregamento SET SCHEMA public';
  END IF;

  -- transportadoras
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'transportadoras' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.transportadoras SET SCHEMA public';
  END IF;

  -- usuarios_filiais_carregamento
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'usuarios_filiais_carregamento' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.usuarios_filiais_carregamento SET SCHEMA public';
  END IF;

  -- alertas_carregamento
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'alertas_carregamento' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.alertas_carregamento SET SCHEMA public';
  END IF;

  -- historico_carregamento
  SELECT table_schema INTO v_schema
  FROM information_schema.tables
  WHERE table_name = 'historico_carregamento' AND table_schema != 'public'
  LIMIT 1;
  IF v_schema IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ' || quote_ident(v_schema) || '.historico_carregamento SET SCHEMA public';
  END IF;
END $$;

-- ── Recreate all tables with explicit public. prefix (IF NOT EXISTS — safe) ──

CREATE TABLE IF NOT EXISTS public.filiais_carregamento (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      VARCHAR(200) NOT NULL,
  codigo    VARCHAR(10)  UNIQUE NOT NULL,
  cidade    VARCHAR(100),
  estado    VARCHAR(2),
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transportadoras (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      VARCHAR(200) NOT NULL,
  cnpj      VARCHAR(18)  UNIQUE,
  contato   VARCHAR(100),
  telefone  VARCHAR(20),
  email     VARCHAR(200),
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usuarios_filiais_carregamento (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais_carregamento(id) ON DELETE CASCADE,
  UNIQUE (user_id, filial_id)
);

CREATE TABLE IF NOT EXISTS public.carregamentos (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_precificacao_id      UUID,
  numero_carregamento         VARCHAR(20) UNIQUE NOT NULL,
  filial_id                   UUID REFERENCES public.filiais_carregamento(id),
  tipo_frete                  VARCHAR(3)  NOT NULL CHECK (tipo_frete IN ('CIF','FOB')),
  status                      VARCHAR(30) NOT NULL DEFAULT 'aguardando_cotacao'
                                CHECK (status IN (
                                  'aguardando_cotacao','cotacao_solicitada','cotacao_recebida',
                                  'aguardando_liberacao','liberado_parcial','liberado_total',
                                  'em_carregamento','carregado','cancelado'
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
  transportadora_id           UUID REFERENCES public.transportadoras(id),
  valor_frete                 NUMERIC(15,2),
  valor_frete_unitario        NUMERIC(15,4),
  observacoes                 TEXT,
  obs_logistica               TEXT,
  liberado_por                UUID REFERENCES auth.users(id),
  criado_por                  UUID REFERENCES auth.users(id),
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cotacoes_frete (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id   UUID REFERENCES public.carregamentos(id) ON DELETE CASCADE,
  transportadora_id UUID REFERENCES public.transportadoras(id),
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

CREATE TABLE IF NOT EXISTS public.alertas_carregamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id  UUID REFERENCES public.carregamentos(id) ON DELETE CASCADE,
  tipo             VARCHAR(50)  NOT NULL,
  mensagem         TEXT         NOT NULL,
  lido             BOOLEAN      NOT NULL DEFAULT false,
  destinatario_id  UUID REFERENCES auth.users(id),
  criado_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.historico_carregamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id  UUID REFERENCES public.carregamentos(id) ON DELETE CASCADE,
  status_anterior  VARCHAR(30),
  status_novo      VARCHAR(30),
  descricao        TEXT,
  alterado_por     UUID REFERENCES auth.users(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes (idempotent) ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carregamentos_status        ON public.carregamentos (status);
CREATE INDEX IF NOT EXISTS idx_carregamentos_filial        ON public.carregamentos (filial_id);
CREATE INDEX IF NOT EXISTS idx_carregamentos_tipo_frete    ON public.carregamentos (tipo_frete);
CREATE INDEX IF NOT EXISTS idx_carregamentos_data_prevista ON public.carregamentos (data_prevista_carregamento);
CREATE INDEX IF NOT EXISTS idx_cotacoes_carregamento       ON public.cotacoes_frete (carregamento_id);
CREATE INDEX IF NOT EXISTS idx_alertas_destinatario        ON public.alertas_carregamento (destinatario_id, lido);

-- ── RLS (idempotent) ─────────────────────────────────────────────────────────
ALTER TABLE public.filiais_carregamento           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportadoras                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_filiais_carregamento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carregamentos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_frete                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_carregamento           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_carregamento         ENABLE ROW LEVEL SECURITY;

-- ── RLS policies (drop first to avoid duplicates) ─────────────────────────────

DROP POLICY IF EXISTS "filiais_read"  ON public.filiais_carregamento;
DROP POLICY IF EXISTS "filiais_write" ON public.filiais_carregamento;
CREATE POLICY "filiais_read"  ON public.filiais_carregamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "filiais_write" ON public.filiais_carregamento FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

DROP POLICY IF EXISTS "transportadoras_read"  ON public.transportadoras;
DROP POLICY IF EXISTS "transportadoras_write" ON public.transportadoras;
CREATE POLICY "transportadoras_read"  ON public.transportadoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportadoras_write" ON public.transportadoras FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

DROP POLICY IF EXISTS "usuarios_filiais_read"  ON public.usuarios_filiais_carregamento;
DROP POLICY IF EXISTS "usuarios_filiais_write" ON public.usuarios_filiais_carregamento;
CREATE POLICY "usuarios_filiais_read"  ON public.usuarios_filiais_carregamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios_filiais_write" ON public.usuarios_filiais_carregamento FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

DROP POLICY IF EXISTS "carregamentos_select" ON public.carregamentos;
DROP POLICY IF EXISTS "carregamentos_insert" ON public.carregamentos;
DROP POLICY IF EXISTS "carregamentos_update" ON public.carregamentos;
DROP POLICY IF EXISTS "carregamentos_delete" ON public.carregamentos;
CREATE POLICY "carregamentos_select" ON public.carregamentos FOR SELECT TO authenticated USING (
  filial_id IN (SELECT filial_id FROM public.usuarios_filiais_carregamento WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master','manager'))
);
CREATE POLICY "carregamentos_insert" ON public.carregamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "carregamentos_update" ON public.carregamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "carregamentos_delete" ON public.carregamentos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);

DROP POLICY IF EXISTS "cotacoes_all" ON public.cotacoes_frete;
CREATE POLICY "cotacoes_all" ON public.cotacoes_frete FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alertas_read"  ON public.alertas_carregamento;
DROP POLICY IF EXISTS "alertas_write" ON public.alertas_carregamento;
CREATE POLICY "alertas_read"  ON public.alertas_carregamento FOR SELECT TO authenticated USING (
  destinatario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master'))
);
CREATE POLICY "alertas_write" ON public.alertas_carregamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "historico_all" ON public.historico_carregamento;
CREATE POLICY "historico_all" ON public.historico_carregamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed: Filiais (idempotent) ────────────────────────────────────────────────
INSERT INTO public.filiais_carregamento (nome, codigo, cidade, estado)
VALUES
  ('Filial São Paulo',      'SP01', 'São Paulo',      'SP'),
  ('Filial Campinas',       'CP01', 'Campinas',       'SP'),
  ('Filial Ribeirão Preto', 'RP01', 'Ribeirão Preto', 'SP'),
  ('Filial Belo Horizonte', 'BH01', 'Belo Horizonte', 'MG'),
  ('Filial Cuiabá',         'CU01', 'Cuiabá',         'MT'),
  ('Filial Rondonópolis',   'RO01', 'Rondonópolis',   'MT'),
  ('Filial Sorriso',        'SO01', 'Sorriso',        'MT'),
  ('Filial Sinop',          'SI01', 'Sinop',          'MT')
ON CONFLICT (codigo) DO NOTHING;

-- ── Seed: Transportadoras (idempotent) ────────────────────────────────────────
INSERT INTO public.transportadoras (nome, cnpj, contato, telefone, email)
VALUES
  ('Transportadora Agrolog', '11.222.333/0001-44', 'Carlos Silva',  '(65) 3333-1111', 'comercial@agrolog.com.br'),
  ('TransBrasil Cargas',     '22.333.444/0001-55', 'Maria Santos',  '(11) 4444-2222', 'frete@transbrasil.com.br'),
  ('LogAgro Express',        '33.444.555/0001-66', 'João Oliveira', '(67) 5555-3333', 'logagro@express.com.br'),
  ('Cargas do Centro-Oeste', '44.555.666/0001-77', 'Ana Costa',     '(65) 6666-4444', 'contato@cargasco.com.br'),
  ('Fretamento Rural',       '55.666.777/0001-88', 'Paulo Pereira', '(66) 7777-5555', 'frete@rural.com.br')
ON CONFLICT (cnpj) DO NOTHING;
