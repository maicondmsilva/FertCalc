import { User } from '../types';

/**
 * Retorna os IDs de filiais que o usuário pode acessar no módulo carregamento.
 * Se o array estiver vazio, o usuário tem acesso a todas as filiais.
 * Roles master/admin sempre têm acesso total, independente de carregamento_filial_ids.
 */
export function useCarregamentoFiliais(user: User): {
  filialIds: string[];
  hasAllAccess: boolean;
} {
  const isMasterOrAdmin = user.role === 'master' || user.role === 'admin';
  if (isMasterOrAdmin || user.permissions?.carregamento_all_filiais) {
    return { filialIds: [], hasAllAccess: true };
  }
  const filialIds = user.permissions?.carregamento_filial_ids ?? [];
  return {
    filialIds,
    hasAllAccess: filialIds.length === 0,
  };
}
