import { useCallback, useState } from 'react';
import type { PricingRecord, SavedFormula } from '../types';

export interface FormulaContext {
  formula: SavedFormula | null;
  branchId: string;
  priceListId: string;
}

const EMPTY_FORMULA_CONTEXT: FormulaContext = {
  formula: null,
  branchId: '',
  priceListId: '',
};

const MODULE_ROUTES: Record<string, string> = {
  pricing: '/dashboard',
  config: '/users',
  managementReports: '/managementReports_dashboard',
  prd: '/prd',
  expenses: '/expenses_lancamentos',
  carregamento: '/carregamento_visao_geral',
  relatorios: '/relatorios',
};

export function usePricingWorkspace(navigate: (path: string) => void) {
  const [editingPricing, setEditingPricing] = useState<PricingRecord | null>(null);
  const [initialFormulaContext, setInitialFormulaContext] =
    useState<FormulaContext>(EMPTY_FORMULA_CONTEXT);

  const editPricing = useCallback(
    (pricing: PricingRecord) => {
      setEditingPricing(pricing);
      navigate('/calculator');
    },
    [navigate]
  );

  const clearCalculator = useCallback(() => {
    setEditingPricing(null);
    setInitialFormulaContext(EMPTY_FORMULA_CONTEXT);
  }, []);

  const calculatorSaved = useCallback(() => {
    setEditingPricing(null);
    navigate('/history');
  }, [navigate]);

  const sendFormulaToCalculator = useCallback(
    (formula: SavedFormula, branchId: string, priceListId: string) => {
      setInitialFormulaContext({ formula, branchId, priceListId });
      navigate('/calculator');
    },
    [navigate]
  );

  const navigateFromShell = useCallback(
    (routeId: string, clearFormulaContext: boolean) => {
      if (clearFormulaContext) setInitialFormulaContext(EMPTY_FORMULA_CONTEXT);
      navigate(routeId ? `/${routeId}` : '/');
    },
    [navigate]
  );

  const selectModule = useCallback(
    (moduleId: string) => {
      const route = MODULE_ROUTES[moduleId];
      if (route) navigate(route);
    },
    [navigate]
  );

  return {
    editingPricing,
    initialFormulaContext,
    editPricing,
    clearCalculator,
    calculatorSaved,
    sendFormulaToCalculator,
    navigateFromShell,
    selectModule,
  };
}
