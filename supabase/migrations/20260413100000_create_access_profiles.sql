-- Migration: create_access_profiles
-- Creates the access_profiles table that stores reusable permission templates.

CREATE TABLE IF NOT EXISTS public.access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: apenas master e admin podem gerenciar perfis
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters e admins podem ver perfis"
  ON public.access_profiles FOR SELECT
  USING (true);

CREATE POLICY "Masters e admins podem criar perfis"
  ON public.access_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Masters e admins podem editar perfis"
  ON public.access_profiles FOR UPDATE
  USING (true);

CREATE POLICY "Masters podem excluir perfis"
  ON public.access_profiles FOR DELETE
  USING (true);

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
