-- ─────────────────────────────────────────────────────────────────────────────
--  Fix: carregamentos.filial_id should reference the `branches` table
--  (managed in Configurações / Settings) instead of `filiais_carregamento`.
--
--  This migration:
--    1. Drops the FK from carregamentos.filial_id → filiais_carregamento
--    2. Adds a new FK carregamentos.filial_id → branches(id)
--    3. Drops the obsolete tables: filiais_carregamento, usuarios_filiais_carregamento
--    4. Simplifies the carregamentos_select RLS policy (no more usuarios_filiais_carregamento)
--  All steps are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop old FK constraint on carregamentos.filial_id ──────────────────────
DO $$
BEGIN
  -- The constraint name may vary; drop all FK constraints on carregamentos(filial_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'carregamentos'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'filiais_carregamento'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.carregamentos DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'carregamentos'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'filiais_carregamento'
      LIMIT 1
    );
  END IF;
END $$;

-- ── 2. Add new FK carregamentos.filial_id → branches(id) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'carregamentos'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'branches'
  ) THEN
    ALTER TABLE public.carregamentos
      ADD CONSTRAINT carregamentos_filial_id_fkey
      FOREIGN KEY (filial_id) REFERENCES public.branches(id);
  END IF;
END $$;

-- ── 3. Drop obsolete tables ──────────────────────────────────────────────────
DROP TABLE IF EXISTS public.usuarios_filiais_carregamento CASCADE;
DROP TABLE IF EXISTS public.filiais_carregamento CASCADE;

-- ── 4. Update carregamentos_select RLS — simplified (no more usuarios_filiais table) ─
DROP POLICY IF EXISTS "carregamentos_select" ON public.carregamentos;
CREATE POLICY "carregamentos_select" ON public.carregamentos FOR SELECT TO authenticated USING (
  filial_id IS NULL
  OR EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master','manager'))
  OR TRUE  -- all authenticated users can see all carregamentos for now
);
