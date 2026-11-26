import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { getAccessLevels } from '../accessLevelService';

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
});
