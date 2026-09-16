import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { from: fromMock } }));

import { createCotacaoSolicitada } from '../cotacaoSolicitadaService';

describe('cotacaoSolicitadaService', () => {
  beforeEach(() => fromMock.mockReset());

  it('deixa o banco atribuir o número da cotação', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'cot-1',
        numero_cotacao: 'COT-2026-0001',
        status: 'aguardando',
        criado_em: '2026-09-15T00:00:00Z',
        atualizado_em: '2026-09-15T00:00:00Z',
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn((_payload: unknown) => ({ select }));
    fromMock.mockReturnValue({ insert });

    const payload = { status: 'aguardando' as const };
    const result = await createCotacaoSolicitada(payload);

    expect(result.numero_cotacao).toBe('COT-2026-0001');
    expect(insert).toHaveBeenCalledWith(payload);
    expect(insert.mock.calls[0][0]).not.toHaveProperty('numero_cotacao');
  });

  it('propaga falha de gravação da cotação', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error('conflito') });
    fromMock.mockReturnValue({ insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) });
    await expect(createCotacaoSolicitada({ status: 'aguardando' })).rejects.toThrow('conflito');
  });
});
