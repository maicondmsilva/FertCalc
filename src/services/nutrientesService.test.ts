import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));
import { cleanAliases } from './nutrientesService';

describe('nomes alternativos do nutriente', () => {
  it('guarda em maiúsculas, sem repetir sigla, nome nem vazios', () => {
    expect(
      cleanAliases({
        sigla: 'Zn',
        nome: 'Zinco',
        aliases: ['zinco', ' ZN ', 'zn edta', '', 'ZN EDTA'],
      })
    ).toEqual(['ZN EDTA']);
  });
});
