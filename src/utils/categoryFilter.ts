import type { RawMaterial } from '../types';

export const ALL_CATEGORIES = 'all';

const numeric = (value: unknown) => Number(value) || 0;

/** Produto com quantidade fixa (mínimo = máximo) configurada na fórmula. */
export const isFixedMaterial = (material: RawMaterial) =>
  numeric(material.minQty) > 0 && numeric(material.minQty) === numeric(material.maxQty);

/** O produto faz parte do filtro? "Todas": macros sem linha premium; micros nenhum. */
export function belongsToCategory(
  material: RawMaterial,
  category: string | undefined,
  type: 'macro' | 'micro'
): boolean {
  if (!category || category === ALL_CATEGORIES) {
    return type === 'macro' ? !material.isPremiumLine : false;
  }
  return (material.categories || []).includes(category);
}

/**
 * Aplica o filtro (categoria) à lista de produtos de UMA fórmula. Usada ao
 * trocar o filtro e na comparação, para as duas darem o mesmo resultado.
 *
 * - Parte da lista da própria fórmula: mantém mínimo/máximo, preço temporário e
 *   matérias-primas personalizadas; produtos novos do cadastro entram como estão.
 * - Marca os produtos do filtro e desmarca os demais, EXCETO os fixados (📌,
 *   marcados à mão), os de quantidade fixa e os personalizados marcados.
 */
export function applyCategoryFilter({
  current,
  catalog,
  category,
  type,
}: {
  current: RawMaterial[];
  catalog: RawMaterial[];
  category: string | undefined;
  type: 'macro' | 'micro';
}): RawMaterial[] {
  const currentById = new Map(current.map((material) => [material.id, material]));
  const catalogIds = new Set(catalog.map((material) => material.id));
  const keepSelected = (material: RawMaterial) =>
    material.selected === true &&
    (material.pinned === true || isFixedMaterial(material) || material.isCustomMaterial === true);

  const fromCatalog = catalog.map((catalogMaterial) => {
    const own = currentById.get(catalogMaterial.id);
    const material = own ? { ...catalogMaterial, ...own } : { ...catalogMaterial };
    return {
      ...material,
      selected: (own ? keepSelected(own) : false) || belongsToCategory(material, category, type),
    };
  });
  // Itens que só existem na fórmula (ex.: matéria-prima personalizada).
  const onlyInFormula = current
    .filter((material) => !catalogIds.has(material.id))
    .map((material) => ({
      ...material,
      selected: keepSelected(material) || belongsToCategory(material, category, type),
    }));
  return [...fromCatalog, ...onlyInFormula];
}
