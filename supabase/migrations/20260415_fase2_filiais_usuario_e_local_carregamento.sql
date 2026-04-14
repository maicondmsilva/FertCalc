-- ──────────────────────────────────────────────────────────────
--  FASE 2 — Permissão de Filial por Usuário + Local de Carregamento
-- ──────────────────────────────────────────────────────────────

-- 1. Campo filiais_permitidas no usuário (array de UUIDs das branches permitidas)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS filiais_permitidas UUID[] NOT NULL DEFAULT '{}';

-- 2. Campo local_carregamento_id no carregamento (FK opcional)
ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS local_carregamento_id UUID
    REFERENCES public.locais_carregamento(id) ON DELETE SET NULL;
