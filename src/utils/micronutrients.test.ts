import { describe, expect, it } from 'vitest';
import {
  getCalculatedMicronutrientValue,
  getCatalogMicronutrientNames,
  getMaterialSecondaryNutrientPercentage,
  getSecondaryNutrientTarget,
  getMissingSelectedMicronutrientSources,
  getMicronutrientTargetStatus,
  isSecondaryNutrientGuarantee,
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

  it('compara meta e resultado ignorando diferenças na grafia do nutriente', () => {
    const calculated = getCalculatedMicronutrientValue({ ZN: 0.255 }, 'Zn');

    expect(calculated).toBe(0.255);
    expect(getMicronutrientTargetStatus(0.25, calculated)).toBe('met');
    expect(getMicronutrientTargetStatus(0.25, 0.3)).toBe('divergent');
    expect(getMicronutrientTargetStatus(0.25, undefined)).toBe('pending');
  });

  it('não oferece cálcio e enxofre novamente como micros alvo', () => {
    const result = getCatalogMicronutrientNames([
      {
        ativo: true,
        microGuarantees: [
          { name: 'Ca', value: 10 },
          { name: 'Enxofre', value: 5 },
          { name: 'B', value: 2 },
        ],
      },
    ]);

    expect(result).toEqual(['B']);
    expect(isSecondaryNutrientGuarantee('Cálcio')).toBe(true);
    expect(isSecondaryNutrientGuarantee('S')).toBe(true);
  });

  it('soma garantias cadastradas nos micros aos campos próprios de Ca e S', () => {
    const material = {
      ca: 2,
      s: 1,
      microGuarantees: [
        { name: 'Cálcio', value: 8 },
        { name: 'S', value: 4 },
        { name: 'B', value: 5 },
      ],
    };

    expect(getMaterialSecondaryNutrientPercentage(material, 'ca')).toBe(10);
    expect(getMaterialSecondaryNutrientPercentage(material, 's')).toBe(5);
  });

  it('recupera metas antigas de Ca e S salvas entre os micros alvo', () => {
    const targets = { Cálcio: 1.2, Enxofre: 2.5, B: 0.2 };

    expect(getSecondaryNutrientTarget(targets, 'ca')).toBe(1.2);
    expect(getSecondaryNutrientTarget(targets, 's')).toBe(2.5);
  });
});
