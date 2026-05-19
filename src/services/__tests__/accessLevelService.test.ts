import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  createAccessLevel,
  deleteAccessLevel,
  getAccessLevels,
  updateAccessLevel,
} from '../accessLevelService';

describe('accessLevelService', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('retorna fallback quando tabela não existe', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'missing relation' } });
    const select = vi.fn(() => ({ order }));
    fromMock.mockReturnValue({ select });

    const levels = await getAccessLevels();
    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0].code).toBe('master');
  });

  it('cria e atualiza nível de acesso', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'lvl-1',
        code: 'qa',
        name: 'QA',
        is_system: false,
        hierarchy_level: 55,
        default_permissions: {},
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValueOnce({ insert }).mockReturnValueOnce({ update });

    const created = await createAccessLevel({
      code: 'qa',
      name: 'QA',
      hierarchy_level: 55,
      default_permissions: {},
    });
    const updated = await updateAccessLevel(created.id, { name: 'QA 2' });

    expect(created.code).toBe('qa');
    expect(updated).toBe(true);
  });

  it('impede exclusão de nível em uso', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'lvl-2', code: 'manager', is_system: false },
      error: null,
    });
    const selectLevel = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }));

    const selectCount = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }));

    fromMock
      .mockReturnValueOnce({ select: selectLevel })
      .mockReturnValueOnce({ select: selectCount });

    await expect(deleteAccessLevel('lvl-2')).rejects.toThrow('em uso');
  });
});
