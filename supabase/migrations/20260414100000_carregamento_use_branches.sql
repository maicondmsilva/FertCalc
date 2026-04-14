-- ─────────────────────────────────────────────────────────────────────────────
--  Fix: carregamentos.filial_id should reference the `branches` table
--  (managed in Configurações / Settings) instead of `filiais_carregamento`.
--
--  This migration:
--    0. Migrates filiais_carregamento data into branches (preserving existing data)
--    1. Nullifies carregamentos.filial_id values that don't exist in branches
--    2. Drops the FK from carregamentos.filial_id → filiais_carregamento
--    3. Adds a new FK carregamentos.filial_id → branches(id)
--    4. Drops the obsolete tables: filiais_carregamento, usuarios_filiais_carregamento
--    5. Simplifies the carregamentos_select RLS policy
--  All steps are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Migrate data: copy filiais_carregamento rows into branches ─────────────
--    Only inserts rows whose id does not already exist in branches.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'filiais_carregamento') THEN
    INSERT INTO public.branches (id, name, ativo)
    SELECT fc.id, fc.nome, fc.ativo
    FROM public.filiais_carregamento fc
    WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = fc.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ── 1. Nullify orphan filial_id values ────────────────────────────────────────
--    If any carregamento references a filial that was NOT migrated to branches,
--    set it to NULL so the new FK doesn't fail.
UPDATE public.carregamentos
SET filial_id = NULL
WHERE filial_id IS NOT NULL
  AND filial_id NOT IN (SELECT id FROM public.branches);

-- ── 2. Drop old FK constraint on carregamentos.filial_id ──────────────────────
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

-- ── 3. Add new FK carregamentos.filial_id → branches(id) ─────────────────────
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

-- ── 4. Drop obsolete tables ──────────────────────────────────────────────────
DROP TABLE IF EXISTS public.usuarios_filiais_carregamento CASCADE;
DROP TABLE IF EXISTS public.filiais_carregamento CASCADE;

-- ── 5. Update carregamentos_select RLS — simplified (no more usuarios_filiais table) ─
DROP POLICY IF EXISTS "carregamentos_select" ON public.carregamentos;
CREATE POLICY "carregamentos_select" ON public.carregamentos FOR SELECT TO authenticated USING (
  filial_id IS NULL
  OR EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('admin','master','manager'))
);
