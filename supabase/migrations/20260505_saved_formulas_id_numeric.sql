-- Migration idempotente: adiciona coluna id_numeric SERIAL em saved_formulas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'saved_formulas'
      AND column_name  = 'id_numeric'
  ) THEN
    ALTER TABLE public.saved_formulas ADD COLUMN id_numeric SERIAL;
  END IF;
END $$;
