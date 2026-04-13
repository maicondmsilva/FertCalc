-- Migration: create_access_profiles
-- Creates the access_profiles table that stores reusable permission templates.
-- Only admin and master users can manage (create/update/delete) profiles.
-- All authenticated users can view profiles (needed for the "apply profile" dropdown).

CREATE TABLE IF NOT EXISTS public.access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: todos autenticados podem visualizar; apenas admin/master podem gerenciar
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários autenticados podem ver os perfis
-- (necessário para o dropdown "Aplicar Perfil" no cadastro de usuários)
CREATE POLICY "Autenticados podem ver perfis de acesso"
  ON public.access_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: apenas admin e master podem criar perfis
CREATE POLICY "Admin e master podem criar perfis de acesso"
  ON public.access_profiles FOR INSERT
  WITH CHECK (is_admin_or_master());

-- UPDATE: apenas admin e master podem editar perfis
CREATE POLICY "Admin e master podem editar perfis de acesso"
  ON public.access_profiles FOR UPDATE
  USING (is_admin_or_master());

-- DELETE: apenas admin e master podem excluir perfis
CREATE POLICY "Admin e master podem excluir perfis de acesso"
  ON public.access_profiles FOR DELETE
  USING (is_admin_or_master());

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_access_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_access_profiles_updated_at();
