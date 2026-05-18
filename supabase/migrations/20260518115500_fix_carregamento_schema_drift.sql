-- ═══════════════════════════════════════════════════════════════════════════════
--  Migration: Fix Schema Drift - carregamento_itens + pedido_venda_numero
--  Corrige drift de schema identificado na análise profunda do módulo carregamento
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Criar tabela carregamento_itens (idempotente) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.carregamento_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carregamento_id       UUID NOT NULL REFERENCES public.carregamentos(id) ON DELETE CASCADE,
  pedido_venda_item_id  UUID REFERENCES public.pedidos_venda_itens(id) ON DELETE SET NULL,
  produto_nome          TEXT NOT NULL,
  quantidade_ton        NUMERIC(15,3) NOT NULL DEFAULT 0,
  embalagem             TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.carregamento_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'carregamento_itens'
      AND policyname = 'carregamento_itens_all'
  ) THEN
    CREATE POLICY "carregamento_itens_all" ON public.carregamento_itens
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Índice para busca por carregamento
CREATE INDEX IF NOT EXISTS idx_carregamento_itens_carregamento_id
  ON public.carregamento_itens (carregamento_id);

-- ── 2. Adicionar pedido_venda_numero em carregamentos (idempotente) ────────────
ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS pedido_venda_numero TEXT;

-- Índice composto para busca eficiente
CREATE INDEX IF NOT EXISTS idx_carregamentos_pedido_venda
  ON public.carregamentos (pedido_venda_id, pedido_venda_numero)
  WHERE pedido_venda_id IS NOT NULL;

-- ── 3. Popular pedido_venda_numero a partir de pedido_venda_id (se vazio) ──────
UPDATE public.carregamentos c
SET pedido_venda_numero = pv.numero_pedido || '/' || pv.emitente
FROM public.pedidos_venda pv
WHERE c.pedido_venda_id = pv.id
  AND c.pedido_venda_numero IS NULL;

NOTIFY pgrst, 'reload schema';
