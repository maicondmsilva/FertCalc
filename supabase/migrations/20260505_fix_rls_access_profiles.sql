-- ════════════════════════════════════════════════════════════════
--  Fix RLS + is_admin_or_master — access_profiles
--  Idempotente: seguro executar múltiplas vezes.
-- ════════════════════════════════════════════════════════════════

-- 1. Garantir função is_admin_or_master() existe com base em app_users.role
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'master') FROM public.app_users WHERE id = auth.uid()),
    false
  );
$$;

-- 2. Garantir tabela access_profiles existe
CREATE TABLE IF NOT EXISTS public.access_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Garantir RLS ativo
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Recriar políticas de forma idempotente (DROP + CREATE)

-- SELECT
DROP POLICY IF EXISTS "Autenticados podem ver perfis de acesso" ON public.access_profiles;
CREATE POLICY "Autenticados podem ver perfis de acesso"
  ON public.access_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT
DROP POLICY IF EXISTS "Admin e master podem criar perfis de acesso" ON public.access_profiles;
CREATE POLICY "Admin e master podem criar perfis de acesso"
  ON public.access_profiles FOR INSERT
  WITH CHECK (public.is_admin_or_master());

-- UPDATE
DROP POLICY IF EXISTS "Admin e master podem editar perfis de acesso" ON public.access_profiles;
CREATE POLICY "Admin e master podem editar perfis de acesso"
  ON public.access_profiles FOR UPDATE
  USING (public.is_admin_or_master());

-- DELETE
DROP POLICY IF EXISTS "Admin e master podem excluir perfis de acesso" ON public.access_profiles;
CREATE POLICY "Admin e master podem excluir perfis de acesso"
  ON public.access_profiles FOR DELETE
  USING (public.is_admin_or_master());

-- 5. Garantir trigger updated_at
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

-- 6. Força PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
