import type { ProfitabilityAnalysis } from '../../types';
import { calculateInterestDays } from './pricingEngine';

export interface ProfitabilityInput {
  unitaryPrice: number;
  factor: number;
  baseCost: number;
  freightDeduction: number;
  commissionRate: number;
  interestRate: number;
  taxRate: number;
  dueDate?: string;
  exemptCurrentMonth?: boolean;
  packagingValue?: number;
}

export interface ProfitabilityResult {
  baseCostAfterFactor: number;
  commissionDeduction: number;
  interestDeduction: number;
  taxDeduction: number;
  netRevenue: number;
  profitability: number;
  profitabilityPercent: number;
  daysOfInterest: number;
  packagingDeduction: number;
}

export interface ProfitabilityEngineOptions { today?: Date; }
const numeric = (value: unknown): number => Number(value) || 0;

export function calculateProfitability(
  input: ProfitabilityInput,
  options: ProfitabilityEngineOptions = {}
): ProfitabilityResult {
  const unitaryPrice = numeric(input.unitaryPrice);
  const freightDeduction = numeric(input.freightDeduction);
  const baseCostAfterFactor = numeric(input.baseCost) * numeric(input.factor);
  const daysOfInterest = calculateInterestDays(
    input.dueDate,
    Boolean(input.exemptCurrentMonth),
    options.today ?? new Date()
  );
  const interestBase = unitaryPrice - freightDeduction;
  const monthlyRate = numeric(input.interestRate) / 100;
  const interestDeduction = daysOfInterest > 0 && monthlyRate > 0
    ? interestBase * (1 - Math.pow(1 - monthlyRate, daysOfInterest / 30))
    : 0;
  const taxDeduction = unitaryPrice * (numeric(input.taxRate) / 100);
  const commissionDeduction = unitaryPrice * (numeric(input.commissionRate) / 100);
  const packagingDeduction = numeric(input.packagingValue);
  const netRevenue = unitaryPrice - taxDeduction - freightDeduction - commissionDeduction - interestDeduction - packagingDeduction;
  const profitability = netRevenue - baseCostAfterFactor;

  return {
    baseCostAfterFactor, commissionDeduction, interestDeduction, taxDeduction,
    netRevenue, profitability,
    profitabilityPercent: baseCostAfterFactor > 0 ? (profitability / baseCostAfterFactor) * 100 : 0,
    daysOfInterest, packagingDeduction,
  };
}

export interface CreateProfitabilityAnalysisInput extends ProfitabilityInput {
  pricingRecordId: string;
  calculationIndex: number;
  formulaName: string;
  analyzedByUserId: string;
  analyzedByName: string;
}

export function createProfitabilityAnalysis(
  input: CreateProfitabilityAnalysisInput,
  options: ProfitabilityEngineOptions & { analyzedAt?: Date } = {}
): ProfitabilityAnalysis {
  const result = calculateProfitability(input, options);
  return {
    pricingRecordId: input.pricingRecordId,
    calculationIndex: input.calculationIndex,
    formulaName: input.formulaName,
    unitaryPrice: input.unitaryPrice,
    factor: input.factor,
    baseCost: input.baseCost,
    ...result,
    freightDeduction: input.freightDeduction,
    commissionRate: input.commissionRate,
    interestRate: input.interestRate,
    taxRate: input.taxRate,
    dueDate: input.dueDate,
    exemptCurrentMonth: input.exemptCurrentMonth,
    packagingValue: input.packagingValue,
    analyzedByUserId: input.analyzedByUserId,
    analyzedByName: input.analyzedByName,
    analyzedAt: (options.analyzedAt ?? new Date()).toISOString(),
  };
}
