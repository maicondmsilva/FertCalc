-- ══════════════════════════════════════════════════════════════════════════════
--  FASE 0 — Migration Unificada v4.0 — FertCalc Pro
--  Arquivo: 20260415_v4_unificado.sql
--  Idempotente: usa IF NOT EXISTS e ADD COLUMN IF NOT EXISTS em tudo.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  0.1 — Tabela cotacoes_solicitadas
--  Tabela definitiva para cotações de frete independentes.
--  A tabela cotacoes_frete (vinculada a carregamentos) continua existindo para
--  retrocompatibilidade. Esta é a nova entidade autônoma de cotação.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cotacoes_solicitadas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cotacao        VARCHAR(20) UNIQUE NOT NULL,
  solicitado_por        UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  solicitante_nome      TEXT,
  cliente_id            UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome          TEXT,
  filial_id             UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  local_carregamento_id UUID REFERENCES public.locais_carregamento(id) ON DELETE SET NULL,
  endereco_entrega      TEXT,
  fazenda               TEXT,
  maps_url              TEXT,
  pedido_venda_id       UUID REFERENCES public.pedidos_venda(id) ON DELETE SET NULL,
  produto               TEXT,
  quantidade_ton        NUMERIC(15,3),
  observacoes           TEXT,
  status                VARCHAR(30) NOT NULL DEFAULT 'aguardando'
                          CHECK (status IN ('aguardando','em_analise','cotado','aprovado','cancelado')),
  responsavel_id        UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  transportadora_id     UUID REFERENCES public.transportadoras(id) ON DELETE SET NULL,
  transportadora_nome   TEXT,
  valor_frete           NUMERIC(15,2),
  valor_frete_unitario  NUMERIC(15,4),
  prazo_entrega_dias    INTEGER,
  obs_responsavel       TEXT,
  cotado_em             TIMESTAMPTZ,
  aprovado_em           TIMESTAMPTZ,
  precificacao_id       UUID,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cotacoes_solicitadas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cotacoes_solicitadas' AND policyname = 'cotacoes_solicitadas_all'
  ) THEN
    CREATE POLICY "cotacoes_solicitadas_all" ON public.cotacoes_solicitadas
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
--  0.2 — Coluna cotacao_frete_id em pricing_records
--  Vincula uma precificação à cotação de frete independente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pricing_records
  ADD COLUMN IF NOT EXISTS cotacao_frete_id UUID
    REFERENCES public.cotacoes_solicitadas(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
--  0.3 — Novas colunas em pedidos_venda
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pedidos_venda
  ADD COLUMN IF NOT EXISTS produto_nome          TEXT,
  ADD COLUMN IF NOT EXISTS formulacao_alterada   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_carregada  NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedido_pai_id         UUID REFERENCES public.pedidos_venda(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_id_novo       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome_novo     TEXT,
  ADD COLUMN IF NOT EXISTS ie_nova               TEXT;

-- Coluna gerada (saldo): adicionar apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'pedidos_venda'
      AND column_name  = 'saldo_disponivel'
  ) THEN
    ALTER TABLE public.pedidos_venda
      ADD COLUMN saldo_disponivel NUMERIC(15,3)
        GENERATED ALWAYS AS (
          COALESCE(quantidade_real, 0) - COALESCE(quantidade_carregada, 0)
        ) STORED;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
--  0.4 — Novas colunas em carregamentos
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS pedido_venda_id  UUID REFERENCES public.pedidos_venda(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produto_linha    TEXT,
  ADD COLUMN IF NOT EXISTS maps_url         TEXT,
  ADD COLUMN IF NOT EXISTS fazenda          TEXT,
  ADD COLUMN IF NOT EXISTS endereco_entrega TEXT,
  ADD COLUMN IF NOT EXISTS cotacao_id       UUID REFERENCES public.cotacoes_solicitadas(id) ON DELETE SET NULL;
-- Nota: pedido_precificacao_id existente é mantido para retrocompatibilidade


-- ─────────────────────────────────────────────────────────────────────────────
--  0.5 — Coluna carregamento_filial_ids em app_users
--  Permite definir quais filiais o usuário pode tratar carregamentos.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS carregamento_filial_ids UUID[] DEFAULT '{}';


-- ─────────────────────────────────────────────────────────────────────────────
--  0.6 — Tabela embalagens
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.embalagens_id_numeric_seq START 1;

CREATE TABLE IF NOT EXISTS public.embalagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_numeric  INTEGER NOT NULL DEFAULT nextval('public.embalagens_id_numeric_seq') UNIQUE,
  nome        VARCHAR(200) NOT NULL,
  cobrar      BOOLEAN NOT NULL DEFAULT false,
  desconto    BOOLEAN NOT NULL DEFAULT false,
  valor       NUMERIC(10,4) NOT NULL DEFAULT 0,
  tipo_valor  TEXT NOT NULL DEFAULT 'por_tonelada'
              CHECK (tipo_valor IN ('por_tonelada','fixo')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.embalagens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'embalagens' AND policyname = 'embalagens_all'
  ) THEN
    CREATE POLICY "embalagens_all" ON public.embalagens
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
--  0.7 — Sequências de IDs numéricos para carregamentos e price_lists
-- ─────────────────────────────────────────────────────────────────────────────

-- Número sequencial para carregamentos (se não existir coluna)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'carregamentos'
      AND column_name  = 'numero'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS public.carregamentos_numero_seq START 1;
    ALTER TABLE public.carregamentos
      ADD COLUMN numero INTEGER DEFAULT nextval('public.carregamentos_numero_seq');
    -- Preencher registros existentes
    UPDATE public.carregamentos SET numero = nextval('public.carregamentos_numero_seq') WHERE numero IS NULL;
  END IF;
END $$;

-- id_numeric em price_lists (sequência explícita, mais transparente que SERIAL)
CREATE SEQUENCE IF NOT EXISTS public.price_lists_id_numeric_seq START 1;

ALTER TABLE public.price_lists
  ADD COLUMN IF NOT EXISTS id_numeric INTEGER DEFAULT nextval('public.price_lists_id_numeric_seq');

-- Preencher registros existentes que ainda não possuem id_numeric
UPDATE public.price_lists SET id_numeric = nextval('public.price_lists_id_numeric_seq') WHERE id_numeric IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'price_lists_id_numeric_key'
  ) THEN
    ALTER TABLE public.price_lists ADD CONSTRAINT price_lists_id_numeric_key UNIQUE (id_numeric);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
--  0.8 — Trigger para atualizar quantidade_carregada no pedido automaticamente
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.atualizar_saldo_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  -- Determinar qual pedido_venda_id foi afetado
  IF TG_OP = 'DELETE' THEN
    v_pedido_id := OLD.pedido_venda_id;
  ELSE
    v_pedido_id := NEW.pedido_venda_id;
  END IF;

  -- Só atualizar se o carregamento está vinculado a um pedido
  IF v_pedido_id IS NOT NULL THEN
    UPDATE public.pedidos_venda
    SET quantidade_carregada = (
      SELECT COALESCE(SUM(quantidade_total), 0)
      FROM public.carregamentos
      WHERE pedido_venda_id = v_pedido_id
        AND status NOT IN ('cancelado')
    )
    WHERE id = v_pedido_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saldo_pedido ON public.carregamentos;
CREATE TRIGGER trg_saldo_pedido
  AFTER INSERT OR UPDATE OR DELETE ON public.carregamentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_pedido();

-- Índice para otimizar a consulta do trigger (pedido_venda_id + status)
CREATE INDEX IF NOT EXISTS idx_carregamentos_pedido_status
  ON public.carregamentos (pedido_venda_id, status)
  WHERE pedido_venda_id IS NOT NULL;


-- ══════════════════════════════════════════════════════════════════════════════
--  CHECKLIST DO QUE FOI CRIADO / ALTERADO
-- ══════════════════════════════════════════════════════════════════════════════
--
--  [CRIADO]  TABLE  public.cotacoes_solicitadas          (0.1)
--  [CRIADO]  POLICY cotacoes_solicitadas_all             (0.1)
--  [CRIADO]  COLUMN pricing_records.cotacao_frete_id     (0.2)
--  [CRIADO]  COLUMN pedidos_venda.produto_nome           (0.3)
--  [CRIADO]  COLUMN pedidos_venda.formulacao_alterada    (0.3)
--  [CRIADO]  COLUMN pedidos_venda.quantidade_carregada   (0.3)
--  [CRIADO]  COLUMN pedidos_venda.pedido_pai_id          (0.3)
--  [CRIADO]  COLUMN pedidos_venda.cliente_id_novo        (0.3)
--  [CRIADO]  COLUMN pedidos_venda.cliente_nome_novo      (0.3)
--  [CRIADO]  COLUMN pedidos_venda.ie_nova                (0.3)
--  [CRIADO]  COLUMN pedidos_venda.saldo_disponivel       (0.3, gerada)
--  [CRIADO]  COLUMN carregamentos.pedido_venda_id        (0.4)
--  [CRIADO]  COLUMN carregamentos.produto_linha          (0.4)
--  [CRIADO]  COLUMN carregamentos.maps_url               (0.4)
--  [CRIADO]  COLUMN carregamentos.fazenda                (0.4)
--  [CRIADO]  COLUMN carregamentos.endereco_entrega       (0.4)
--  [CRIADO]  COLUMN carregamentos.cotacao_id             (0.4)
--  [CRIADO]  COLUMN app_users.carregamento_filial_ids    (0.5)
--  [CRIADO]  SEQUENCE public.embalagens_id_numeric_seq   (0.6)
--  [CRIADO]  TABLE  public.embalagens                    (0.6)
--  [CRIADO]  POLICY embalagens_all                       (0.6)
--  [CRIADO]  SEQUENCE public.carregamentos_numero_seq    (0.7, condicional)
--  [CRIADO]  COLUMN carregamentos.numero                 (0.7, condicional)
--  [CRIADO]  SEQUENCE public.price_lists_id_numeric_seq   (0.7)
--  [CRIADO]  COLUMN price_lists.id_numeric               (0.7)
--  [CRIADO]  CONSTRAINT price_lists_id_numeric_key       (0.7)
--  [CRIADO]  FUNCTION public.atualizar_saldo_pedido()    (0.8)
--  [CRIADO]  TRIGGER trg_saldo_pedido ON carregamentos   (0.8)
--  [CRIADO]  INDEX  idx_carregamentos_pedido_status      (0.8)
--
-- ══════════════════════════════════════════════════════════════════════════════
