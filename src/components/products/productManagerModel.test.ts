import { describe, expect, it } from 'vitest';
import type { Embalagem, UnifiedProduct } from '../../types';
import { summarizeProducts, usageLabel } from './productManagerModel';

const p = (type: UnifiedProduct['type'], ativo = true, brandId?: string) =>
  ({ id: Math.random().toString(), type, ativo, brandId }) as UnifiedProduct;

describe('tela de Produtos', () => {
  it('resume ativos, inativos, macros sem marca e embalagens ativas', () => {
    const products = [
      p('macro', true, 'b1'),
      p('macro', true),
      p('macro', false, 'apagada'),
      p('micro', true),
      p('finished', true),
    ];
    const embalagens = [{ ativo: true }, { ativo: false }] as Embalagem[];
    expect(summarizeProducts(products, embalagens, new Set(['b1']))).toEqual({
      ativos: 3,
      inativos: 1,
      macrosSemMarca: 2,
      embalagensAtivas: 1,
    });
  });

  it('selo de uso', () => {
    expect(usageLabel(0)).toBeNull();
    expect(usageLabel(undefined)).toBeNull();
    expect(usageLabel(12)).toBe('Em uso (12)');
  });
});
