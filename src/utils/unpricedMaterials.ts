import type { RawMaterial } from '../types';

/** Produto sem custo nesta precificação: fora da lista ou sem preço na moeda, e sem valor informado. */
export const isUnpricedMaterial = (material: Pick<RawMaterial, 'price'>) =>
  !(Number(material.price) > 0);

export interface PriceWarnings {
  /** Selecionados que entram com preço zero (o custo não os inclui). */
  unpriced: RawMaterial[];
  /** Selecionados com valor informado pelo usuário (diferente da lista). */
  manual: RawMaterial[];
  /** Matérias-primas personalizadas (informadas pelo usuário, fora do cadastro). */
  custom: RawMaterial[];
}

/**
 * Avisos de preço dos produtos escolhidos. Antes do cálculo vale a seleção;
 * depois, use `onlyUsed` para olhar só o que entrou na mistura (quantidade > 0).
 */
export function getPriceWarnings(
  materials: RawMaterial[],
  { onlyUsed = false }: { onlyUsed?: boolean } = {}
): PriceWarnings {
  const chosen = materials.filter((material) =>
    onlyUsed ? Number(material.quantity) > 0 : material.selected
  );
  return {
    unpriced: chosen.filter(isUnpricedMaterial),
    manual: chosen.filter(
      (material) =>
        material.isManualPrice && !material.isCustomMaterial && !isUnpricedMaterial(material)
    ),
    custom: chosen.filter((material) => material.isCustomMaterial),
  };
}

export const materialNames = (materials: Pick<RawMaterial, 'name'>[]) =>
  materials.map((material) => material.name).join(', ');
