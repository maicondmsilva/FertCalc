-- ════════════════════════════════════════════════════════════════
--  Fix: access_profiles — garantir schema cache do Supabase/PostgREST
--  Idempotente: usa IF NOT EXISTS em tudo.
-- ════════════════════════════════════════════════════════════════

-- 1. Garante que a tabela existe
CREATE TABLE IF NOT EXISTS public.access_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Garante RLS ativado
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Recria políticas de forma idempotente

-- SELECT: todos os usuários autenticados podem ver os perfis
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

-- INSERT: apenas admin e master podem criar perfis
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

-- UPDATE: apenas admin e master podem editar perfis
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

-- DELETE: apenas admin e master podem excluir perfis
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

-- 4. Trigger para manter updated_at atualizado
CREATE OR REPLACE FUNCTION public.update_access_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_access_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_access_profiles_updated_at
      BEFORE UPDATE ON public.access_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_access_profiles_updated_at();
  END IF;
END $$;

-- 5. Força o PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
