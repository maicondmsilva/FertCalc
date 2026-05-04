-- ════════════════════════════════════════════════════════════════
--  Fix definitivo: access_profiles — tabela + RLS + trigger
--  Idempotente: seguro executar múltiplas vezes.
-- ════════════════════════════════════════════════════════════════

-- 1. Garantir tabela
CREATE TABLE IF NOT EXISTS public.access_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Garantir RLS ativo
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas idempotentes

-- SELECT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'access_profiles'
      AND policyname = 'Autenticados podem ver perfis de acesso'
  ) THEN
    CREATE POLICY "Autenticados podem ver perfis de acesso"
      ON public.access_profiles FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- INSERT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'access_profiles'
      AND policyname = 'Admin e master podem criar perfis de acesso'
  ) THEN
    CREATE POLICY "Admin e master podem criar perfis de acesso"
      ON public.access_profiles FOR INSERT
      WITH CHECK (is_admin_or_master());
  END IF;
END $$;

-- UPDATE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'access_profiles'
      AND policyname = 'Admin e master podem editar perfis de acesso'
  ) THEN
    CREATE POLICY "Admin e master podem editar perfis de acesso"
      ON public.access_profiles FOR UPDATE
      USING (is_admin_or_master());
  END IF;
END $$;

-- DELETE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'access_profiles'
      AND policyname = 'Admin e master podem excluir perfis de acesso'
  ) THEN
    CREATE POLICY "Admin e master podem excluir perfis de acesso"
      ON public.access_profiles FOR DELETE
      USING (is_admin_or_master());
  END IF;
END $$;

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_access_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_profiles_updated_at ON public.access_profiles;
CREATE TRIGGER trg_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_access_profiles_updated_at();

-- 5. Força PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
