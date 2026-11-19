import React from 'react';
import { CalendarClock, Package, Percent, Truck, X } from 'lucide-react';
import type { Embalagem, PricingFactors, TargetFormula } from '../../types';
import { calculateInterestDays } from '../../domain/pricing-engine';
import { isValidExchangeRate } from '../../utils/priceListCurrency';
import { formatMoney } from './betaCalculatorModel';
import type { BetaCalculator } from './SimplifiedCalculatorBeta';

interface BetaConditionsPanelProps {
  calculation: TargetFormula;
  calculator: BetaCalculator;
  embalagens: Embalagem[];
  canSimulateReduction: boolean;
  onSimulateReduction: () => void;
  onClose: () => void;
}

const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr || !days) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const inputClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400';

function Field({
  label,
  unit,
  hint,
  children,
}: {
  label: string;
  unit?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </span>
      <span className="relative block">
        {children}
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
            {unit}
          </span>
        )}
      </span>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-11 rounded-xl bg-stone-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === option.value
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h4 className="mb-3 flex items-center gap-2 text-[15px] font-black text-stone-900">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function BetaConditionsPanel({
  calculation,
  calculator,
  embalagens,
  canSimulateReduction,
  onSimulateReduction,
  onClose,
}: BetaConditionsPanelProps) {
  const { factors: globalFactors, updateCalculationFactors } = calculator;
  const factors = calculation.factors;
  const id = calculation.id;
  const isUsd = globalFactors.priceListCurrency === 'USD';
  const currencySymbol = isUsd ? 'US$' : 'R$';

  const set = (field: keyof PricingFactors, value: string | number | boolean) =>
    updateCalculationFactors(id, field, value);
  const numberValue = (value: number | undefined) => (Number(value) === 0 ? '' : (value ?? ''));
  const parseNumber = (raw: string) => (raw === '' ? 0 : Number(raw));

  const selectedPackage = embalagens.find((item) => item.id === factors.embalagem_id);
  const canCharge = selectedPackage?.cobrar ?? false;
  const canDiscount = selectedPackage?.descontar ?? selectedPackage?.desconto ?? false;
  const packageAdjustment =
    factors.embalagem_ajuste ||
    ((factors.embalagem_valor || 0) > 0
      ? 'cobrar'
      : (factors.embalagem_valor || 0) < 0
        ? 'descontar'
        : 'nenhum');
  // Mesma conversão da calculadora oficial para listas em dólar.
  const toPricingCurrency = (value: number) =>
    isUsd && isValidExchangeRate(globalFactors.appliedExchangeRate)
      ? value / Number(globalFactors.appliedExchangeRate)
      : value;
  const packageValue = (embalagem: Embalagem, adjustment: 'nenhum' | 'cobrar' | 'descontar') => {
    if (adjustment === 'cobrar' && embalagem.cobrar) {
      return toPricingCurrency(Number(embalagem.valor_cobrar ?? embalagem.valor ?? 0));
    }
    if (adjustment === 'descontar' && (embalagem.descontar ?? embalagem.desconto)) {
      return -toPricingCurrency(Number(embalagem.valor_descontar ?? embalagem.valor ?? 0));
    }
    return 0;
  };

  const paymentCondition = factors.paymentCondition || 'vencimento';
  const interestDays = calculateInterestDays(
    factors.dueDate,
    Boolean(factors.exemptCurrentMonth),
    new Date(),
    factors.interestStartDate
  );

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-stone-900">Condições comerciais</h3>
          <p className="text-sm text-stone-600">O preço é atualizado a cada alteração.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSimulateReduction && (
            <button
              type="button"
              onClick={onSimulateReduction}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
            >
              Simular redução →
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-white"
            aria-label="Fechar condições"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 @4xl:grid-cols-2">
        <Group icon={Percent} title="Fatores comerciais" tone="bg-emerald-100 text-emerald-700">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fator" unit="×">
              <input
                type="number"
                step="0.01"
                value={factors.factor}
                onChange={(event) => set('factor', parseNumber(event.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Desconto" unit={`${currencySymbol}/t`}>
              <input
                type="number"
                step="0.01"
                value={numberValue(factors.discount)}
                onChange={(event) => set('discount', parseNumber(event.target.value))}
                placeholder="0,00"
                className={`${inputClass} pr-14`}
              />
            </Field>
            <Field label="Comissão" unit="%">
              <input
                type="number"
                step="0.1"
                min="0"
                value={numberValue(factors.commission)}
                onChange={(event) => set('commission', parseNumber(event.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Alíquota" unit="%">
              <input
                type="number"
                step="0.01"
                value={numberValue(factors.taxRate)}
                onChange={(event) => set('taxRate', parseNumber(event.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </Group>

        <Group icon={Truck} title="Frete" tone="bg-blue-100 text-blue-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                Tipo
              </span>
              <Segmented
                label="Tipo de frete"
                value={(factors.tipoFrete ?? 'CIF') as 'CIF' | 'FOB'}
                options={[
                  { value: 'CIF', label: 'CIF' },
                  { value: 'FOB', label: 'FOB' },
                ]}
                onChange={(value) => {
                  set('tipoFrete', value);
                  if (value === 'FOB') {
                    set('cotacaoFreteId', '');
                    set('cotacaoFreteNumero', '');
                  }
                }}
              />
            </div>
            <Field label="Valor" unit={`${currencySymbol}/t`}>
              <input
                type="number"
                step="0.01"
                disabled={(factors.tipoFrete ?? 'CIF') === 'FOB'}
                value={numberValue(factors.freight)}
                onChange={(event) => {
                  set('freight', parseNumber(event.target.value));
                  set('cotacaoFreteId', '');
                  set('cotacaoFreteNumero', '');
                }}
                placeholder="0,00"
                className={`${inputClass} pr-14`}
              />
            </Field>
          </div>
          {(factors.tipoFrete ?? 'CIF') === 'FOB' && (
            <p className="mt-2 text-sm text-stone-500">FOB: o frete não entra no preço.</p>
          )}
        </Group>

        <Group icon={CalendarClock} title="Pagamento e juros" tone="bg-orange-100 text-orange-700">
          <div className="mb-3">
            <Segmented
              label="Condição de pagamento"
              value={paymentCondition}
              options={[
                { value: 'vencimento', label: 'Vencimento' },
                { value: 'ddf', label: 'DDF (dias após carregamento)' },
              ]}
              onChange={(value) => {
                set('paymentCondition', value);
                if (value === 'ddf') {
                  const loadingDate =
                    factors.dataCarregamento || new Date().toISOString().split('T')[0];
                  const days = factors.ddfDias || 30;
                  set('dataCarregamento', loadingDate);
                  set('ddfDias', days);
                  set('dueDate', addDaysToDate(loadingDate, days));
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {paymentCondition === 'vencimento' ? (
              <Field label="Vencimento">
                <input
                  type="date"
                  value={factors.dueDate || ''}
                  onChange={(event) => set('dueDate', event.target.value)}
                  className={inputClass}
                />
              </Field>
            ) : (
              <>
                <Field label="Carregamento">
                  <input
                    type="date"
                    value={factors.dataCarregamento || ''}
                    onChange={(event) => {
                      set('dataCarregamento', event.target.value);
                      set('dueDate', addDaysToDate(event.target.value, factors.ddfDias || 0));
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="Dias DDF" unit="dias">
                  <input
                    type="number"
                    min="0"
                    value={numberValue(factors.ddfDias)}
                    onChange={(event) => {
                      const days = parseNumber(event.target.value);
                      set('ddfDias', days);
                      set('dueDate', addDaysToDate(factors.dataCarregamento || '', days));
                    }}
                    className={`${inputClass} pr-14`}
                  />
                </Field>
              </>
            )}
            <Field label="Juros mensal" unit="% a.m.">
              <input
                type="number"
                step="0.01"
                value={numberValue(factors.monthlyInterestRate)}
                onChange={(event) => set('monthlyInterestRate', parseNumber(event.target.value))}
                className={`${inputClass} pr-16`}
              />
            </Field>
            <Field
              label="Juros a partir de"
              hint={factors.exemptCurrentMonth ? 'Inativo: mês atual isento.' : 'Opcional.'}
            >
              <input
                type="date"
                max={factors.dueDate || undefined}
                disabled={factors.exemptCurrentMonth}
                value={factors.interestStartDate || ''}
                onChange={(event) => set('interestStartDate', event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={Boolean(factors.exemptCurrentMonth)}
                onChange={(event) => set('exemptCurrentMonth', event.target.checked)}
                className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              Isentar juros do mês atual
            </label>
            <span className="text-sm text-stone-500">
              {factors.dueDate
                ? `${interestDays} dia(s) de juros · vence ${new Date(
                    `${factors.dueDate}T12:00:00`
                  ).toLocaleDateString('pt-BR')}`
                : 'Sem vencimento: sem juros'}
            </span>
          </div>
        </Group>

        <Group icon={Package} title="Volume e embalagem" tone="bg-violet-100 text-violet-700">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade" unit="t">
              <input
                type="number"
                min="0"
                step="0.01"
                value={numberValue(factors.totalTons)}
                onChange={(event) => set('totalTons', parseNumber(event.target.value))}
                className={`${inputClass} pr-8`}
              />
            </Field>
            <Field label="Embalagem">
              <select
                value={factors.embalagem_id || ''}
                onChange={(event) => {
                  const embalagem = embalagens.find((item) => item.id === event.target.value);
                  set('embalagem_id', embalagem?.id || '');
                  set('embalagem_nome', embalagem?.nome || '');
                  set('embalagem_ajuste', 'nenhum');
                  set('embalagem_valor', 0);
                }}
                className={inputClass}
              >
                <option value="">Sem embalagem</option>
                {embalagens.map((embalagem) => (
                  <option key={embalagem.id} value={embalagem.id}>
                    {embalagem.nome}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {selectedPackage && (canCharge || canDiscount) && (
            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                Ajuste da embalagem
              </span>
              <Segmented
                label="Ajuste da embalagem"
                value={packageAdjustment}
                options={[
                  { value: 'nenhum', label: 'Nenhum' },
                  { value: 'cobrar', label: 'Cobrar', disabled: !canCharge },
                  { value: 'descontar', label: 'Descontar', disabled: !canDiscount },
                ]}
                onChange={(value) => {
                  set('embalagem_ajuste', value);
                  set('embalagem_valor', packageValue(selectedPackage, value));
                }}
              />
              {packageAdjustment !== 'nenhum' && (
                <p className="mt-1.5 text-sm text-stone-600">
                  {packageAdjustment === 'cobrar' ? 'Acréscimo' : 'Desconto'} de{' '}
                  <strong>
                    {formatMoney(Math.abs(factors.embalagem_valor || 0), isUsd ? 'USD' : 'BRL')}/t
                  </strong>
                </p>
              )}
            </div>
          )}
        </Group>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-3">
        <span className="text-sm text-stone-600">
          {calculation.summary ? (
            <>
              Preço com estas condições:{' '}
              <strong className="text-lg text-emerald-800">
                {formatMoney(calculation.summary.finalPrice, isUsd ? 'USD' : 'BRL')}/t
              </strong>
            </>
          ) : (
            'Calcule a fórmula para ver o preço.'
          )}
        </span>
      </div>
    </section>
  );
}
