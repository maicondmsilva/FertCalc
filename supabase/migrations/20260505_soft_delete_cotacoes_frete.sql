-- Adiciona coluna de soft delete em cotacoes_frete
ALTER TABLE public.cotacoes_frete
  ADD COLUMN IF NOT EXISTS arquivada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.cotacoes_frete
  ADD COLUMN IF NOT EXISTS arquivada_em TIMESTAMPTZ;

ALTER TABLE public.cotacoes_frete
  ADD COLUMN IF NOT EXISTS arquivada_por TEXT;

-- Índice para queries de listagem ativa
CREATE INDEX IF NOT EXISTS idx_cotacoes_frete_arquivada
  ON public.cotacoes_frete (arquivada);
