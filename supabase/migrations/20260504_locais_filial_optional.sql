-- Torna filial_id opcional no cadastro de locais de carregamento.
-- Idempotente: verifica se a coluna ainda possui NOT NULL antes de alterar.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'locais_carregamento'
      AND column_name  = 'filial_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.locais_carregamento
      ALTER COLUMN filial_id DROP NOT NULL;
  END IF;
END $$;
