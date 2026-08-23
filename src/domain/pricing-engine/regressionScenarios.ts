import type { PricingFactors, RawMaterial } from '../../types';

export interface PricingRegressionScenario {
  name: string;
  calculationDate: Date;
  dueDate: string;
  macros: RawMaterial[];
  factors: PricingFactors;
  expected: {
    totalWeight: number;
    baseCost: number;
    resultingN: number;
    resultingP: number;
    resultingK: number;
    resultingS: number;
    resultingCa: number;
    basePrice: number;
    interestValue: number;
    taxValue: number;
    commissionValue: number;
    freightValue: number;
    finalPrice: number;
    totalSaleValue: number;
  };
}

const material = (
  id: string,
  name: string,
  price: number,
  quantity: number,
  guarantees: Partial<Pick<RawMaterial, 'n' | 'p' | 'k' | 's' | 'ca'>> = {}
): RawMaterial => ({
  id,
  type: 'macro',
  name,
  price,
  n: guarantees.n ?? 0,
  p: guarantees.p ?? 0,
  k: guarantees.k ?? 0,
  s: guarantees.s ?? 0,
  ca: guarantees.ca ?? 0,
  microGuarantees: [],
  minQty: quantity,
  maxQty: quantity,
  selected: true,
  quantity,
});

/**
 * Casos de referência do negócio mantidos como dados imutáveis.
 * Alterações intencionais na matemática devem atualizar estes valores em revisão explícita.
 */
export const pricingRegressionScenarios: PricingRegressionScenario[] = [
  {
    name: 'mistura NPK CIF com enxofre e cálcio sem meta',
    calculationDate: new Date('2026-01-15T12:00:00'),
    dueDate: '2026-02-14T12:00:00',
    macros: [
      material('ureia', 'Ureia', 2500, 300, { n: 45, s: 1 }),
      material('map', 'MAP', 3200, 100, { n: 11, p: 52, ca: 2 }),
      material('kcl', 'KCl', 2100, 300, { k: 60 }),
      material('filler', 'Filler calcário', 400, 300, { ca: 20 }),
    ],
    factors: {
      targetFormula: '14-05-18',
      factor: 1.05,
      discount: 20,
      margin: 0,
      freight: 120,
      tipoFrete: 'CIF',
      taxRate: 7,
      commission: 3,
      monthlyInterestRate: 1.5,
      dueDate: '2026-02-14T12:00:00',
      exemptCurrentMonth: false,
      embalagem_valor: 40,
      client: { id: 'cliente-regressao', code: '001', name: 'Cliente de referência', document: '' },
      agent: { id: 'agente-regressao', code: '001', name: 'Agente de referência', document: '' },
      branchId: 'filial-regressao',
      priceListId: 'tabela-regressao',
      totalTons: 10,
    },
    expected: {
      totalWeight: 1000,
      baseCost: 1820,
      resultingN: 14.6,
      resultingP: 5.2,
      resultingK: 18,
      resultingS: 0.3,
      resultingCa: 6.2,
      basePrice: 1891,
      interestValue: 28.365,
      taxValue: 132.37,
      commissionValue: 56.73,
      freightValue: 120,
      finalPrice: 2268.465,
      totalSaleValue: 22684.65,
    },
  },
  {
    name: 'mistura FOB à vista sem encargos comerciais',
    calculationDate: new Date('2026-01-15T12:00:00'),
    dueDate: '',
    macros: [
      material('sulfato-amonio', 'Sulfato de amônio', 1700, 500, { n: 20, s: 22 }),
      material('filler', 'Filler calcário', 400, 500, { ca: 20 }),
    ],
    factors: {
      targetFormula: '10-00-00',
      factor: 1,
      discount: 0,
      margin: 0,
      freight: 250,
      tipoFrete: 'FOB',
      taxRate: 0,
      commission: 0,
      monthlyInterestRate: 0,
      dueDate: '',
      exemptCurrentMonth: false,
      client: { id: 'cliente-regressao', code: '001', name: 'Cliente de referência', document: '' },
      agent: { id: 'agente-regressao', code: '001', name: 'Agente de referência', document: '' },
      branchId: 'filial-regressao',
      priceListId: 'tabela-regressao',
      totalTons: 5,
    },
    expected: {
      totalWeight: 1000,
      baseCost: 1050,
      resultingN: 10,
      resultingP: 0,
      resultingK: 0,
      resultingS: 11,
      resultingCa: 10,
      basePrice: 1050,
      interestValue: 0,
      taxValue: 0,
      commissionValue: 0,
      freightValue: 0,
      finalPrice: 1050,
      totalSaleValue: 5250,
    },
  },
];
