import type { PriceListCurrency, ProfitabilityAnalysis } from '../../types';
import { calculateInterestDays } from './pricingEngine';
import { roundMoney } from './commercialWaterfall';

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
  interestStartDate?: string;
  paymentCondition?: 'vencimento' | 'ddf';
  dataCarregamento?: string;
  ddfDias?: number;
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

export interface ProfitabilityEngineOptions {
  today?: Date;
}
const numeric = (value: unknown): number => Number(value) || 0;

export function calculateProfitability(
  input: ProfitabilityInput,
  options: ProfitabilityEngineOptions = {}
): ProfitabilityResult {
  const unitaryPrice = numeric(input.unitaryPrice);
  const freightDeduction = numeric(input.freightDeduction);
  const baseCostAfterFactor = roundMoney(numeric(input.baseCost) * numeric(input.factor));
  const daysOfInterest = calculateInterestDays(
    input.dueDate,
    Boolean(input.exemptCurrentMonth),
    options.today ?? new Date(),
    input.interestStartDate
  );
  const priceAfterTax = roundMoney(Math.max(0, unitaryPrice - freightDeduction));
  const taxRate = Math.max(0, numeric(input.taxRate)) / 100;
  const priceAfterCommission = roundMoney(priceAfterTax / (1 + taxRate));
  const taxDeduction = roundMoney(priceAfterTax - priceAfterCommission);
  const commissionRate = Math.max(0, numeric(input.commissionRate)) / 100;
  const priceAfterInterest = roundMoney(priceAfterCommission / (1 + commissionRate));
  const commissionDeduction = roundMoney(priceAfterCommission - priceAfterInterest);
  const monthlyRate = Math.max(0, numeric(input.interestRate)) / 100;
  const interestFactor = Math.pow(1 + monthlyRate, Math.max(0, daysOfInterest / 30));
  const priceBeforeInterest = roundMoney(priceAfterInterest / interestFactor);
  const interestDeduction = roundMoney(priceAfterInterest - priceBeforeInterest);
  const packagingDeduction = numeric(input.packagingValue);
  const netRevenue = roundMoney(priceBeforeInterest - packagingDeduction);
  const profitability = roundMoney(netRevenue - baseCostAfterFactor);

  return {
    baseCostAfterFactor,
    commissionDeduction,
    interestDeduction,
    taxDeduction,
    netRevenue,
    profitability,
    profitabilityPercent: baseCostAfterFactor > 0 ? (profitability / baseCostAfterFactor) * 100 : 0,
    daysOfInterest,
    packagingDeduction,
  };
}

export interface CreateProfitabilityAnalysisInput extends ProfitabilityInput {
  pricingRecordId: string;
  calculationIndex: number;
  formulaName: string;
  analyzedByUserId: string;
  analyzedByName: string;
  currency?: PriceListCurrency;
  exchangeRate?: number;
}

export function createProfitabilityAnalysis(
  input: CreateProfitabilityAnalysisInput,
  options: ProfitabilityEngineOptions & { analyzedAt?: Date } = {}
): ProfitabilityAnalysis {
  const result = calculateProfitability(input, options);
  const currency = input.currency || 'BRL';
  const exchangeRate =
    currency === 'USD' && Number(input.exchangeRate) > 0 ? Number(input.exchangeRate) : 1;
  return {
    pricingRecordId: input.pricingRecordId,
    calculationIndex: input.calculationIndex,
    formulaName: input.formulaName,
    unitaryPrice: input.unitaryPrice,
    factor: input.factor,
    baseCost: input.baseCost,
    ...result,
    currency,
    exchangeRate: currency === 'USD' ? exchangeRate : undefined,
    unitaryPriceBRL: input.unitaryPrice * exchangeRate,
    baseCostBRL: input.baseCost * exchangeRate,
    netRevenueBRL: result.netRevenue * exchangeRate,
    profitabilityBRL: result.profitability * exchangeRate,
    freightDeduction: input.freightDeduction,
    commissionRate: input.commissionRate,
    interestRate: input.interestRate,
    taxRate: input.taxRate,
    dueDate: input.dueDate,
    exemptCurrentMonth: input.exemptCurrentMonth,
    interestStartDate: input.interestStartDate,
    paymentCondition: input.paymentCondition,
    dataCarregamento: input.dataCarregamento,
    ddfDias: input.ddfDias,
    packagingValue: input.packagingValue,
    analyzedByUserId: input.analyzedByUserId,
    analyzedByName: input.analyzedByName,
    analyzedAt: (options.analyzedAt ?? new Date()).toISOString(),
  };
}
