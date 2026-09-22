import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawMaterial } from '../types';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { saveFormulaWithProduct } from './savedFormulaService';

const material = { id: 'macro-1', name: 'Macro', quantity: 100 } as RawMaterial;

describe('saveFormulaWithProduct', () => {
  beforeEach(() => rpcMock.mockReset());

  it('salva batida e produto formulado por uma unica operacao atomica', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'formula-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        user_name: 'Usuário',
        name: '10-10-10',
        date: '2026-09-23T00:00:00Z',
        target_formula: '10-10-10',
        category: 'all',
        target_micros: {},
        macros: [material],
        micros: [],
      },
      error: null,
    });

    const result = await saveFormulaWithProduct({
      name: ' 10-10-10 ',
      targetFormula: '10-10-10',
      macros: [material],
      micros: [],
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      'save_formula_with_product',
      expect.objectContaining({ p_formula_id: null, p_name: '10-10-10' })
    );
    expect(result).toMatchObject({ id: 'formula-1', name: '10-10-10' });
  });

  it('envia o identificador ao atualizar uma batida existente', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'formula-1',
        user_id: 'user-1',
        user_name: 'Usuário',
        name: 'Descrição nova',
        target_formula: '10-10-10',
        macros: [],
        micros: [],
      },
      error: null,
    });

    await saveFormulaWithProduct({
      id: 'formula-1',
      name: 'Descrição nova',
      targetFormula: '10-10-10',
      macros: [],
      micros: [],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'save_formula_with_product',
      expect.objectContaining({ p_formula_id: 'formula-1', p_name: 'Descrição nova' })
    );
  });

  it('propaga a mensagem do banco sem confirmar um salvamento parcial', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'falha transacional' } });

    await expect(
      saveFormulaWithProduct({
        name: '10-10-10',
        targetFormula: '10-10-10',
        macros: [],
        micros: [],
      })
    ).rejects.toThrow('falha transacional');
  });
});
