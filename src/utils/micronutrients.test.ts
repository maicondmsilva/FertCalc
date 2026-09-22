import { describe, expect, it } from 'vitest';
import {
  getCatalogMicronutrientNames,
  getMissingSelectedMicronutrientSources,
} from './micronutrients';

describe('micronutrient catalog helpers', () => {
  it('lista garantias de todos os produtos ativos mesmo sem seleção e elimina duplicidades', () => {
    const result = getCatalogMicronutrientNames([
      { selected: false, ativo: true, microGuarantees: [{ name: 'ZN', value: 10 }] },
      { selected: false, ativo: true, microGuarantees: [{ name: 'Zn', value: 5 }] },
      { selected: false, ativo: true, microGuarantees: [{ name: 'B', value: 1 }] },
      { selected: false, ativo: false, microGuarantees: [{ name: 'Cu', value: 2 }] },
    ]);

    expect(result).toEqual(['B', 'Zn']);
  });

  it('informa somente metas sem fonte entre os produtos selecionados', () => {
    const result = getMissingSelectedMicronutrientSources(
      { B: 0.25, Zn: 0.1, Mn: 0 },
      [
        { selected: true, microGuarantees: [{ name: 'b', value: 5 }] },
        { selected: false, microGuarantees: [{ name: 'Zn', value: 10 }] },
      ]
    );

    expect(result).toEqual(['Zn']);
  });
});
