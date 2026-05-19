CREATE TABLE IF NOT EXISTS public.access_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  hierarchy_level INTEGER NOT NULL,
  default_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.access_levels (code, name, is_system, hierarchy_level)
VALUES
  ('master', 'Master', true, 100),
  ('admin', 'Administrador', true, 80),
  ('manager', 'Gerente', false, 60),
  ('user', 'Vendedor', false, 40)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND constraint_name = 'app_users_role_fk'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_role_fk
      FOREIGN KEY (role) REFERENCES public.access_levels(code) ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.user_hierarchy_level(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT al.hierarchy_level
  FROM public.app_users u
  JOIN public.access_levels al ON al.code = u.role
  WHERE u.id = p_user_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

ALTER TABLE public.access_levels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_levels'
      AND policyname = 'access_levels_read'
  ) THEN
    CREATE POLICY "access_levels_read"
    ON public.access_levels FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_levels'
      AND policyname = 'access_levels_write_admin'
  ) THEN
    CREATE POLICY "access_levels_write_admin"
    ON public.access_levels FOR ALL TO authenticated
    USING (COALESCE(public.user_hierarchy_level(auth.uid()), 0) >= 80)
    WITH CHECK (COALESCE(public.user_hierarchy_level(auth.uid()), 0) >= 80);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
