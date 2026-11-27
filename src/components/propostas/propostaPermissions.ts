import type { User } from '../../types';

const isAdmin = (user: Pick<User, 'role'>) => user.role === 'master' || user.role === 'admin';

/** Mesma regra do banco: admin/master sempre; os demais pela permissão do usuário. */
export function permissoesProposta(user: Pick<User, 'role' | 'permissions'>) {
  const permissions = (user.permissions || {}) as Record<string, unknown>;
  const has = (key: string) => isAdmin(user) || permissions[key] === true;
  return {
    ver: has('propostas'),
    criar: has('propostas_criar'),
    editar: has('propostas_editar'),
    cancelar: has('propostas_cancelar'),
  };
}

export const canCreatePropostas = (user: Pick<User, 'role' | 'permissions'>) =>
  permissoesProposta(user).criar;
