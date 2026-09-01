import type { PriceList, PricingFactors, SavedFormula } from '../types';
import { calculateInterestDays } from '../domain/pricing-engine';

export type ReportCommercialFactors = Pick<
  PricingFactors,
  | 'factor'
  | 'discount'
  | 'freight'
  | 'tipoFrete'
  | 'taxRate'
  | 'commission'
  | 'monthlyInterestRate'
  | 'dueDate'
  | 'exemptCurrentMonth'
  | 'paymentCondition'
  | 'dataCarregamento'
  | 'ddfDias'
  | 'totalTons'
  | 'embalagem_id'
  | 'embalagem_nome'
  | 'embalagem_valor'
  | 'embalagem_ajuste'
>;

export const DEFAULT_REPORT_COMMERCIAL_FACTORS: ReportCommercialFactors = {
  factor: 0.8,
  discount: 0,
  freight: 0,
  tipoFrete: 'CIF',
  taxRate: 0,
  commission: 0,
  monthlyInterestRate: 0,
  dueDate: '',
  exemptCurrentMonth: false,
  paymentCondition: 'vencimento',
  dataCarregamento: '',
  ddfDias: 0,
  totalTons: 0,
  embalagem_id: '',
  embalagem_nome: '',
  embalagem_valor: 0,
  embalagem_ajuste: 'nenhum',
};

export function calculateReportPrice(
  baseCost: number,
  factors: ReportCommercialFactors,
  today = new Date()
): number {
  const basePrice = baseCost * (Number(factors.factor) || 1) - Number(factors.discount || 0);
  const days = calculateInterestDays(factors.dueDate, factors.exemptCurrentMonth, today);
  const interest = basePrice * (Number(factors.monthlyInterestRate || 0) / 30 / 100) * days;
  const tax = basePrice * (Number(factors.taxRate || 0) / 100);
  const commission = basePrice * (Number(factors.commission || 0) / 100);
  const freight = factors.tipoFrete === 'CIF' ? Number(factors.freight || 0) : 0;
  return basePrice + interest + tax + commission + freight + Number(factors.embalagem_valor || 0);
}

export function getPriceListsForLoadingLocation(
  priceLists: PriceList[],
  loadingLocationId: string
): PriceList[] {
  if (!loadingLocationId) return [];
  return priceLists.filter((list) => list.local_carregamento_id === loadingLocationId);
}

export function getFormulaUpdateProtection(
  formula: SavedFormula,
  isDifferentiatedLine: boolean
): { canUpdate: boolean; protectedMaterialIds: string[]; reason?: string } {
  if (isDifferentiatedLine) {
    return {
      canUpdate: false,
      protectedMaterialIds: [...formula.macros, ...formula.micros].map((material) => material.id),
      reason: 'Produtos de linha diferenciada devem manter a composição cadastrada.',
    };
  }

  return {
    canUpdate: true,
    protectedMaterialIds: formula.micros.map((material) => material.id),
    reason:
      formula.micros.length > 0
        ? 'Os micronutrientes serão preservados para manter a descrição da formulação.'
        : undefined,
  };
}
