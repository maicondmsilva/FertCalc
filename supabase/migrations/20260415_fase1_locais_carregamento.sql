-- ──────────────────────────────────────────────────────────────
--  FASE 1 — Locais de Carregamento
-- ──────────────────────────────────────────────────────────────

-- 1. Sequência e tabela locais_carregamento
CREATE SEQUENCE IF NOT EXISTS public.locais_carregamento_id_numeric_seq START 1;

CREATE TABLE IF NOT EXISTS public.locais_carregamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_numeric  INTEGER NOT NULL DEFAULT nextval('public.locais_carregamento_id_numeric_seq') UNIQUE,
  nome        VARCHAR(200) NOT NULL,
  filial_id   UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  endereco    TEXT,
  cidade      VARCHAR(100),
  estado      VARCHAR(2),
  maps_url    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.locais_carregamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locais_carregamento_all" ON public.locais_carregamento
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Adicionar id_numeric em transportadoras (se não existir)
ALTER TABLE public.transportadoras
  ADD COLUMN IF NOT EXISTS id_numeric SERIAL;

-- Garantir unicidade (sem recriar se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transportadoras_id_numeric_key'
  ) THEN
    ALTER TABLE public.transportadoras ADD CONSTRAINT transportadoras_id_numeric_key UNIQUE (id_numeric);
  END IF;
END $$;
