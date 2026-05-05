-- Migration idempotente: adiciona coluna id_numeric SERIAL em saved_formulas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'saved_formulas'
      AND column_name  = 'id_numeric'
  ) THEN
    ALTER TABLE public.saved_formulas ADD COLUMN id_numeric INTEGER;

    -- Atribui IDs sequenciais para linhas existentes ordenadas por created_at
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(created_at, now())) AS rn
      FROM public.saved_formulas
    )
    UPDATE public.saved_formulas sf
    SET id_numeric = o.rn
    FROM ordered o
    WHERE sf.id = o.id;

    -- Cria a sequência e associa ao campo
    CREATE SEQUENCE IF NOT EXISTS public.saved_formulas_id_numeric_seq
      START WITH 1 INCREMENT BY 1;

    -- Ajusta o próximo valor da sequência para após o máximo atual
    PERFORM setval(
      'public.saved_formulas_id_numeric_seq',
      COALESCE((SELECT MAX(id_numeric) FROM public.saved_formulas), 0) + 1,
      false
    );

    ALTER TABLE public.saved_formulas
      ALTER COLUMN id_numeric SET DEFAULT nextval('public.saved_formulas_id_numeric_seq');

    ALTER SEQUENCE public.saved_formulas_id_numeric_seq
      OWNED BY public.saved_formulas.id_numeric;
  END IF;
END $$;
