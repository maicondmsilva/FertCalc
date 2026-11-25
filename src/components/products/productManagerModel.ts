import type { Embalagem, UnifiedProduct } from '../../types';

export interface ProductSummary {
  ativos: number;
  inativos: number;
  macrosSemMarca: number;
  embalagensAtivas: number;
}

/** Indicadores do topo da tela de Produtos. */
export function summarizeProducts(
  products: UnifiedProduct[],
  embalagens: Embalagem[],
  brandIds: Set<string>
): ProductSummary {
  const materials = products.filter((item) => item.type === 'macro' || item.type === 'micro');
  return {
    ativos: materials.filter((item) => item.ativo !== false).length,
    inativos: materials.filter((item) => item.ativo === false).length,
    macrosSemMarca: products.filter(
      (item) => item.type === 'macro' && (!item.brandId || !brandIds.has(item.brandId))
    ).length,
    embalagensAtivas: embalagens.filter((item) => item.ativo !== false).length,
  };
}

/** Texto do selo de uso: em quantos registros o produto aparece. */
export function usageLabel(usos: number | undefined): string | null {
  if (!usos) return null;
  return usos === 1 ? 'Em uso (1)' : `Em uso (${usos})`;
}
