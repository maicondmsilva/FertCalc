import { describe, expect, it } from 'vitest';
import type { User } from '../../../types';
import { canEditDeleteCarregamento } from '../shared';

const user = (overrides: Partial<User>): User =>
  ({ id: 'u1', role: 'user', permissions: {}, ...overrides }) as User;

const carga = {
  status: 'aguardando_liberacao' as const,
  criado_por: 'u1',
  quantidade_liberada: 0,
  quantidade_carregada: 0,
};

describe('permissões do carregamento (iguais às do banco)', () => {
  it('quem criou edita e exclui enquanto aguarda liberação', () => {
    expect(canEditDeleteCarregamento(carga, user({}))).toEqual({ canEdit: true, canDelete: true });
  });

  it('outro vendedor não edita nem exclui', () => {
    expect(canEditDeleteCarregamento(carga, user({ id: 'u2' }))).toEqual({
      canEdit: false,
      canDelete: false,
    });
  });

  it('logística edita, mas só admin ou acima exclui solicitação de outra pessoa', () => {
    const logistica = user({ id: 'u3', permissions: { carregamento_liberar: true } as never });
    expect(canEditDeleteCarregamento(carga, logistica)).toEqual({
      canEdit: true,
      canDelete: false,
    });
    expect(canEditDeleteCarregamento(carga, user({ id: 'u4', role: 'admin' }))).toEqual({
      canEdit: true,
      canDelete: true,
    });
  });

  it('nada liberado ou carregado pode ser excluído, nem pelo admin', () => {
    const liberado = { ...carga, status: 'liberado_parcial' as const, quantidade_liberada: 10 };
    expect(canEditDeleteCarregamento(liberado, user({ role: 'master' })).canDelete).toBe(false);
    expect(canEditDeleteCarregamento(liberado, user({})).canDelete).toBe(false);
  });

  it('solicitação cancelada não é editada', () => {
    expect(
      canEditDeleteCarregamento({ ...carga, status: 'cancelado' }, user({ role: 'master' })).canEdit
    ).toBe(false);
  });
});
