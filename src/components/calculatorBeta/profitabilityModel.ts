import type { PriceListCurrency, PricingFactors, PricingSummary, User } from '../../types';
import type { ProfitabilityInput } from '../../domain/pricing-engine/profitabilityEngine';
import { getPricingCurrency, getPricingExchangeRate } from '../../utils/pricingCurrency';

/** Mesma regra do banco: manager ou acima, ou a permissão "Análise de Rentabilidade". */
export function canCheckProfitability(user: Pick<User, 'role' | 'permissions'>): boolean {
  if (user.role === 'master' || user.role === 'admin' || user.role === 'manager') return true;
  return Boolean(
    (user.permissions as Record<string, unknown> | undefined)?.calculator_profitabilityCheck
  );
}

/** Campos do formulário, como texto (aceitam vírgula). */
export interface ProfitabilityForm {
  unitaryPrice: string;
  factor: string;
  taxRate: string;
  commission: string;
  freight: string;
  interestRate: string;
  packaging: string;
  paymentCondition: 'vencimento' | 'ddf';
  dueDate: string;
  loadingDate: string;
  ddfDays: string;
  interestStartDate: string;
  exemptCurrentMonth: boolean;
}

export interface ProfitabilityContext {
  form: ProfitabilityForm;
  baseCost: number;
  currency: PriceListCurrency;
  exchangeRate?: number;
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export const parseDecimal = (value: string): number => {
  const text = String(value ?? '').trim();
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown, decimals?: number) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '0';
  return (decimals === undefined ? String(number) : number.toFixed(decimals)).replace('.', ',');
};

export function addDaysToDate(date: string, days: number): string {
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setDate(parsed.getDate() + Math.max(0, Math.trunc(days)));
  return parsed.toISOString().split('T')[0];
}

/** No FOB o frete não faz parte do preço; só desconta frete quando a venda é CIF. */
export const freightToDeduct = (factors?: Partial<PricingFactors>): number =>
  factors?.tipoFrete === 'FOB' ? 0 : Number(factors?.freight) || 0;

/** Formulário preenchido com as condições e o preço calculado da fórmula. */
export function contextFromCalculation(calc: {
  factors?: Partial<PricingFactors>;
  summary?: Partial<PricingSummary> | null;
}): ProfitabilityContext {
  const factors = calc.factors || {};
  const summary = calc.summary || undefined;
  return {
    baseCost: Number(summary?.baseCost) || 0,
    currency: getPricingCurrency(summary, factors),
    exchangeRate: getPricingExchangeRate(summary, factors),
    form: {
      unitaryPrice: summary?.finalPrice ? toText(summary.finalPrice, 2) : '',
      factor: toText(factors.factor),
      taxRate: toText(factors.taxRate),
      commission: toText(factors.commission),
      freight: toText(freightToDeduct(factors), 2),
      interestRate: toText(factors.monthlyInterestRate),
      packaging: toText(factors.embalagem_valor, 2),
      paymentCondition: factors.paymentCondition === 'ddf' ? 'ddf' : 'vencimento',
      dueDate: factors.dueDate || '',
      loadingDate: factors.dataCarregamento || '',
      ddfDays: String(factors.ddfDias || 30),
      interestStartDate: factors.interestStartDate || '',
      exemptCurrentMonth: Boolean(factors.exemptCurrentMonth),
    },
  };
}

/** Entrada do motor de rentabilidade a partir do formulário. */
export function toProfitabilityInput(
  form: ProfitabilityForm,
  baseCost: number
): ProfitabilityInput {
  return {
    unitaryPrice: parseDecimal(form.unitaryPrice),
    factor: parseDecimal(form.factor),
    baseCost,
    freightDeduction: parseDecimal(form.freight),
    commissionRate: parseDecimal(form.commission),
    interestRate: parseDecimal(form.interestRate),
    taxRate: parseDecimal(form.taxRate),
    dueDate: form.dueDate || undefined,
    exemptCurrentMonth: form.exemptCurrentMonth,
    interestStartDate: form.exemptCurrentMonth ? undefined : form.interestStartDate || undefined,
    paymentCondition: form.paymentCondition,
    dataCarregamento: form.loadingDate || undefined,
    ddfDias: Math.max(0, Math.trunc(parseDecimal(form.ddfDays))),
    packagingValue: parseDecimal(form.packaging),
  };
}

/** Problema que impede calcular/gravar, ou null. */
export function profitabilityProblem(form: ProfitabilityForm, baseCost: number): string | null {
  if (!(parseDecimal(form.unitaryPrice) > 0)) return 'Informe o valor de venda por tonelada.';
  if (!(baseCost > 0)) return 'Calcule a fórmula antes: o custo base está zerado.';
  const percents = [form.taxRate, form.commission, form.interestRate].map(parseDecimal);
  if (percents.some((value) => value < 0 || value > 100))
    return 'Alíquota, comissão e juros devem ficar entre 0 e 100%.';
  if (parseDecimal(form.freight) < 0) return 'O frete não pode ser negativo.';
  if (form.paymentCondition === 'vencimento' && !form.dueDate)
    return 'Informe a data de vencimento.';
  if (form.paymentCondition === 'ddf' && !form.loadingDate)
    return 'Informe a data de carregamento.';
  return null;
}

/** Faixa da rentabilidade sobre o custo, para a cor do resultado. */
export function profitabilityTone(percent: number): 'loss' | 'low' | 'good' {
  if (percent < 0) return 'loss';
  if (percent < 5) return 'low';
  return 'good';
}
