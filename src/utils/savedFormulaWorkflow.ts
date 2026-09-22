import type { PriceList, PricingFactors, SavedFormula } from '../types';
import { applyCommercialWaterfall, calculateInterestDays } from '../domain/pricing-engine';

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
  | 'interestStartDate'
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
  interestStartDate: '',
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
  const days = calculateInterestDays(
    factors.dueDate,
    factors.exemptCurrentMonth,
    today,
    factors.interestStartDate
  );
  const freight = factors.tipoFrete === 'CIF' ? Number(factors.freight || 0) : 0;
  return applyCommercialWaterfall({
    adjustedCost: baseCost * (Number(factors.factor) || 1),
    discount: factors.discount,
    packagingAdjustment: factors.embalagem_valor,
    monthlyInterestRate: factors.monthlyInterestRate,
    interestDays: days,
    commissionRate: factors.commission,
    taxRate: factors.taxRate,
    freight,
  }).finalPrice;
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

export function getSavedFormulaCompositionKey(
  formula: Pick<
    SavedFormula,
    'targetFormula' | 'category' | 'targetCa' | 'targetS' | 'targetMicros' | 'macros' | 'micros'
  >
): string {
  const normalizeMaterials = (materials: SavedFormula['macros']) =>
    materials
      .filter((material) => Number(material.quantity || 0) > 0)
      .map((material) => ({
        id: material.id,
        quantity: Number(Number(material.quantity || 0).toFixed(6)),
        suffix: (material.formulaSuffix || '').replace(/^[Cc]\/\s*/, '').trim(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    targetFormula: formula.targetFormula.trim(),
    category: formula.category ?? 'all',
    targetCa: Number(formula.targetCa || 0),
    targetS: Number(formula.targetS || 0),
    targetMicros: Object.entries(formula.targetMicros || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([nutrient, value]) => [nutrient, Number(Number(value).toFixed(6))])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    macros: normalizeMaterials(formula.macros),
    micros: normalizeMaterials(formula.micros),
  });
}
