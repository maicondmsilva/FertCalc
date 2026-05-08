-- Adicionar colunas de entrega à tabela de cotações solicitadas
ALTER TABLE public.cotacoes_solicitadas
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS cidade_entrega      TEXT,
  ADD COLUMN IF NOT EXISTS estado_entrega      TEXT;
