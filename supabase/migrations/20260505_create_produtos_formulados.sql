-- Migration idempotente: cria tabela produtos_formulados
CREATE TABLE IF NOT EXISTS public.produtos_formulados (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_numeric        SERIAL,
  nome              TEXT        NOT NULL,
  formula_npk       TEXT,
  saved_formula_id  UUID        REFERENCES public.saved_formulas(id) ON DELETE SET NULL,
  linha_diferenciada BOOLEAN    NOT NULL DEFAULT false,
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por        TEXT
);

-- RLS: habilitar e permitir leitura/escrita para usuários autenticados
ALTER TABLE public.produtos_formulados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'produtos_formulados'
      AND policyname = 'produtos_formulados_all'
  ) THEN
    CREATE POLICY produtos_formulados_all
      ON public.produtos_formulados
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
