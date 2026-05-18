-- ═══════════════════════════════════════════════════════════════════════════════
--  Migration: Unificar Permissões de Carregamento
--  Remove duplicatas e padroniza nomes de permissões no módulo carregamento
-- ═══════════════════════════════════════════════════════════════════════════════

-- Esta migration atualiza permissions JSON nos usuários para padronizar nomes
-- Mapeamento de renomeações:
-- carregamento_aceitar_cotacao    → REMOVIDO (duplicata, usar carregamento_aprovar_cotacao)
-- carregamento_aceitar_carregamento → REMOVIDO (duplicata, usar carregamento_liberar)
-- carregamento_liberacao          → RENOMEADO para carregamento_liberar

DO $$
DECLARE
  r RECORD;
  v_permissions JSONB;
  v_updated BOOLEAN;
BEGIN
  FOR r IN SELECT id, permissions FROM public.app_users WHERE permissions IS NOT NULL
  LOOP
    v_updated := FALSE;
    v_permissions := r.permissions;
    
    -- Remove duplicatas obsoletas
    IF v_permissions ? 'carregamento_aceitar_cotacao' THEN
      v_permissions := v_permissions - 'carregamento_aceitar_cotacao';
      v_updated := TRUE;
    END IF;
    
    IF v_permissions ? 'carregamento_aceitar_carregamento' THEN
      v_permissions := v_permissions - 'carregamento_aceitar_carregamento';
      v_updated := TRUE;
    END IF;
    
    -- Renomeia carregamento_liberacao → carregamento_liberar
    IF v_permissions ? 'carregamento_liberacao' THEN
      IF (v_permissions->>'carregamento_liberacao')::boolean = TRUE THEN
        v_permissions := jsonb_set(v_permissions, '{carregamento_liberar}', 'true'::jsonb);
      END IF;
      v_permissions := v_permissions - 'carregamento_liberacao';
      v_updated := TRUE;
    END IF;
    
    IF v_updated THEN
      UPDATE public.app_users
      SET permissions = v_permissions
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Atualizar access_profiles também
DO $$
DECLARE
  r RECORD;
  v_permissions JSONB;
  v_updated BOOLEAN;
BEGIN
  FOR r IN SELECT id, permissions FROM public.access_profiles WHERE permissions IS NOT NULL
  LOOP
    v_updated := FALSE;
    v_permissions := r.permissions;
    
    IF v_permissions ? 'carregamento_aceitar_cotacao' THEN
      v_permissions := v_permissions - 'carregamento_aceitar_cotacao';
      v_updated := TRUE;
    END IF;
    
    IF v_permissions ? 'carregamento_aceitar_carregamento' THEN
      v_permissions := v_permissions - 'carregamento_aceitar_carregamento';
      v_updated := TRUE;
    END IF;
    
    IF v_permissions ? 'carregamento_liberacao' THEN
      IF (v_permissions->>'carregamento_liberacao')::boolean = TRUE THEN
        v_permissions := jsonb_set(v_permissions, '{carregamento_liberar}', 'true'::jsonb);
      END IF;
      v_permissions := v_permissions - 'carregamento_liberacao';
      v_updated := TRUE;
    END IF;
    
    IF v_updated THEN
      UPDATE public.access_profiles
      SET permissions = v_permissions
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
