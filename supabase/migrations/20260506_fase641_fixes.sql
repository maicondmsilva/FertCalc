-- Fase 6.4.1 — Correções e novas funcionalidades
-- Fix: coluna embalagem em pedidos_venda (pode já existir de migration anterior)
ALTER TABLE public.pedidos_venda ADD COLUMN IF NOT EXISTS embalagem TEXT;

-- Fix: precificacao_id agora é opcional (pode ser NULL quando pedido criado sem precificação)
ALTER TABLE public.pedidos_venda ALTER COLUMN precificacao_id DROP NOT NULL;

-- Fix: emitente com valor padrão 1 (garante que insert sem emitente não falha)
ALTER TABLE public.pedidos_venda ALTER COLUMN emitente SET DEFAULT 1;
