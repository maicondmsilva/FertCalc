import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../services/nutrientesService', () => ({
  getNutrientes: vi
    .fn()
    .mockResolvedValue([
      { id: 'b', sigla: 'B', nome: 'Boro', tipo: 'micro', aliases: [], ordem: 10, ativo: true },
    ]),
}));

import { buildCustomMaterial, customMaterialProblem } from '../CustomMaterialForm';
import { CalculatorSettingsModal } from '../../CalculatorSettingsModal';
import { calculateMaterialComposition } from '../../../domain/pricing-engine/pricingEngine';
import { getPriceWarnings } from '../../../utils/unpricedMaterials';
import { applyTemporaryMaterialPrice } from '../../../utils/temporaryMaterialPrice';
import type { RawMaterial, TargetFormula } from '../../../types';

const draft = {
  name: 'Mistura do fornecedor X',
  n: 10,
  p: 0,
  k: 20,
  s: 5,
  ca: 0,
  microGuarantees: [{ name: 'B', value: 1 }],
  price: 2500,
  minQty: 0,
  maxQty: 0,
};

describe('matéria-prima personalizada', () => {
  it('valida nome, garantias e quantidades', () => {
    expect(customMaterialProblem({ ...draft, name: ' ' })).toMatch(/nome/);
    expect(customMaterialProblem({ ...draft, n: 0, k: 0, s: 0, microGuarantees: [] })).toMatch(
      /ao menos uma garantia/
    );
    expect(customMaterialProblem({ ...draft, n: 120 })).toMatch(/entre 0 e 100/);
    expect(customMaterialProblem({ ...draft, minQty: 300, maxQty: 100 })).toMatch(/mínima/);
    expect(customMaterialProblem(draft)).toBeNull();
  });

  it('o cálculo soma NPK, S e o micro da personalizada', () => {
    const custom = { ...buildCustomMaterial(draft, 0), quantity: 500 };
    const filler = {
      ...buildCustomMaterial(
        { ...draft, name: 'Enchimento', n: 0, k: 0, s: 0, microGuarantees: [], ca: 1 },
        1
      ),
      quantity: 500,
    };
    const result = calculateMaterialComposition([custom, filler], []);
    expect(result.resultingN).toBeCloseTo(5);
    expect(result.resultingK).toBeCloseTo(10);
    expect(result.resultingS).toBeCloseTo(2.5);
    expect(result.resultingMicros.B).toBeCloseTo(0.5);
    expect(result.baseCost).toBeCloseTo(2500);
  });

  it('aviso próprio e preço digitado não vira "preço manual"', () => {
    const custom = buildCustomMaterial(draft, 0);
    expect(getPriceWarnings([custom]).custom).toHaveLength(1);
    expect(getPriceWarnings([custom]).manual).toHaveLength(0);
    const edited = applyTemporaryMaterialPrice(custom, 2800);
    expect(edited).toMatchObject({ price: 2800, isManualPrice: false });
  });
});

describe('modal de produtos da fórmula', () => {
  const globalMacros = [
    { id: 'ureia', name: 'Ureia', type: 'macro', n: 45, p: 0, k: 0, price: 3000 },
    {
      id: 'kcl',
      name: 'KCL',
      type: 'macro',
      n: 0,
      p: 0,
      k: 60,
      price: 0,
      isMissingListPrice: true,
    },
  ] as RawMaterial[];

  it('produto na fórmula desmarcado marca no primeiro clique', () => {
    const onConfirm = vi.fn();
    const formula = {
      id: 'f1',
      formula: '10-10-10',
      macros: [{ ...globalMacros[1], selected: false, quantity: 0 }],
      micros: [],
    } as unknown as TargetFormula;
    render(
      <CalculatorSettingsModal
        isOpen
        onClose={vi.fn()}
        formula={formula}
        globalMacros={globalMacros}
        globalMicros={[]}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByText('KCL'));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar|Aplicar|Salvar/ }));
    const confirmed = onConfirm.mock.calls[0][0] as TargetFormula;
    expect(confirmed.macros.find((m) => m.id === 'kcl')?.selected).toBe(true);
  });

  it('adiciona uma personalizada à fórmula', async () => {
    const onConfirm = vi.fn();
    render(
      <CalculatorSettingsModal
        isOpen
        onClose={vi.fn()}
        formula={
          { id: 'f1', formula: '10-10-10', macros: [], micros: [] } as unknown as TargetFormula
        }
        globalMacros={globalMacros}
        globalMicros={[]}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /matéria-prima personalizada/i }));
    fireEvent.change(screen.getByPlaceholderText(/Sulfato especial/), {
      target: { value: 'Mistura X' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à fórmula/ }));
    expect(await screen.findByText('Mistura X')).toBeTruthy();
    expect(screen.getByText(/Personalizada · vale só nesta precificação/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar|Aplicar|Salvar/ }));
    const confirmed = onConfirm.mock.calls[0][0] as TargetFormula;
    const custom = confirmed.macros.find((m) => m.isCustomMaterial);
    expect(custom).toMatchObject({ name: 'Mistura X', selected: true });
  });
});
