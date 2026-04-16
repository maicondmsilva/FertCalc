-- ════════════════════════════════════════════════════════════════
--  Migration: pedidos_venda_itens + campos vencimento/observacoes
--  Permite que um pedido de venda tenha múltiplos produtos/itens.
-- ════════════════════════════════════════════════════════════════

-- 1. Adicionar campos de vencimento e observações em pedidos_venda (idempotente)
ALTER TABLE public.pedidos_venda
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT;

-- 2. Criar tabela de itens do pedido (multi-produto)
CREATE TABLE IF NOT EXISTS public.pedidos_venda_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_venda_id UUID NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
  produto_nome    TEXT NOT NULL,
  formulacao      TEXT,
  quantidade_ton  NUMERIC(15,3) NOT NULL DEFAULT 0,
  preco_unitario  NUMERIC(15,4),
  precificacao_id UUID REFERENCES public.pricing_records(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.pedidos_venda_itens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedidos_venda_itens'
      AND policyname = 'pedidos_venda_itens_all'
  ) THEN
    CREATE POLICY "pedidos_venda_itens_all" ON public.pedidos_venda_itens
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Índice para busca por pedido
CREATE INDEX IF NOT EXISTS idx_pedidos_venda_itens_pedido_id
  ON public.pedidos_venda_itens (pedido_venda_id);

NOTIFY pgrst, 'reload schema';
