-- Separa o acesso à calculadora completa do acesso à calculadora simplificada.
-- Compatibilidade: usuários e perfis que já tinham acesso à calculadora recebem
-- inicialmente acesso à versão simplificada; depois o administrador pode revogar
-- cada acesso de forma independente.

UPDATE public.app_users
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{simplified_calculator}',
  COALESCE(permissions -> 'calculator', 'false'::jsonb),
  true
)
WHERE NOT (COALESCE(permissions, '{}'::jsonb) ? 'simplified_calculator');

UPDATE public.access_profiles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{simplified_calculator}',
  COALESCE(permissions -> 'calculator', 'false'::jsonb),
  true
)
WHERE NOT (COALESCE(permissions, '{}'::jsonb) ? 'simplified_calculator');

UPDATE public.access_levels
SET default_permissions = jsonb_set(
  COALESCE(default_permissions, '{}'::jsonb),
  '{simplified_calculator}',
  COALESCE(default_permissions -> 'calculator', 'false'::jsonb),
  true
)
WHERE NOT (COALESCE(default_permissions, '{}'::jsonb) ? 'simplified_calculator');
