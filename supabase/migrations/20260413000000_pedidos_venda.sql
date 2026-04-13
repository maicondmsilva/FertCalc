-- ─────────────────────────────────────────────────────────────
--  Pedidos de Venda table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos_venda (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  precificacao_id          UUID NOT NULL,      -- FK to pricing_records
  numero_pedido            VARCHAR(50),
  barra_pedido             VARCHAR(50),
  data_pedido              DATE,
  quantidade_real          NUMERIC(15,3),
  valor_unitario_negociado NUMERIC(15,4),
  valor_total_negociado    NUMERIC(15,2),
  embalagem                VARCHAR(100),
  tipo_frete               VARCHAR(3),         -- CIF or FOB
  valor_frete              NUMERIC(15,2),
  status                   VARCHAR(30) DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_carregamento', 'concluido', 'cancelado')),
  pdf_url                  TEXT,
  dados_extraidos          JSONB,
  importado_por            UUID,
  criado_em                TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em            TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast precificacao lookup
CREATE INDEX IF NOT EXISTS idx_pedidos_venda_precificacao
  ON pedidos_venda (precificacao_id);

-- Add delivery_address column to clients table (JSONB, same shape as address)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS delivery_address JSONB;
