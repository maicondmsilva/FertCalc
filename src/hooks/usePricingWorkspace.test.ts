import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PricingRecord, SavedFormula } from '../types';
import { usePricingWorkspace } from './usePricingWorkspace';

afterEach(cleanup);

describe('usePricingWorkspace', () => {
  it('abre uma precificação existente na calculadora', () => {
    const navigate = vi.fn();
    const pricing = { id: 'pricing-1' } as PricingRecord;
    const { result } = renderHook(() => usePricingWorkspace(navigate));

    act(() => result.current.editPricing(pricing));

    expect(result.current.editingPricing).toBe(pricing);
    expect(navigate).toHaveBeenCalledWith('/calculator');
  });

  it('limpa a edição e o contexto da fórmula', () => {
    const formula = { id: 'formula-1' } as SavedFormula;
    const { result } = renderHook(() => usePricingWorkspace(vi.fn()));

    act(() => result.current.sendFormulaToCalculator(formula, 'branch-1', 'list-1'));
    act(() => result.current.clearCalculator());

    expect(result.current.editingPricing).toBeNull();
    expect(result.current.initialFormulaContext).toEqual({
      formula: null,
      branchId: '',
      priceListId: '',
    });
  });

  it('envia uma fórmula salva para a calculadora com seu contexto', () => {
    const navigate = vi.fn();
    const formula = { id: 'formula-1' } as SavedFormula;
    const { result } = renderHook(() => usePricingWorkspace(navigate));

    act(() => result.current.sendFormulaToCalculator(formula, 'branch-1', 'list-1'));

    expect(result.current.initialFormulaContext).toEqual({
      formula,
      branchId: 'branch-1',
      priceListId: 'list-1',
    });
    expect(navigate).toHaveBeenCalledWith('/calculator');
  });

  it('coordena a navegação do menu, módulos e conclusão da calculadora', () => {
    const navigate = vi.fn();
    const formula = { id: 'formula-1' } as SavedFormula;
    const { result } = renderHook(() => usePricingWorkspace(navigate));

    act(() => result.current.sendFormulaToCalculator(formula, 'branch-1', 'list-1'));
    act(() => result.current.navigateFromShell('dashboard', true));
    expect(result.current.initialFormulaContext.formula).toBeNull();
    expect(navigate).toHaveBeenLastCalledWith('/dashboard');

    act(() => result.current.selectModule('expenses'));
    expect(navigate).toHaveBeenLastCalledWith('/expenses_lancamentos');

    act(() => result.current.calculatorSaved());
    expect(navigate).toHaveBeenLastCalledWith('/history');
  });
});
