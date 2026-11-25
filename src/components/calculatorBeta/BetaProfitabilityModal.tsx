import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Link2, Loader2, Save, Search, TrendingUp, X } from 'lucide-react';
import type { PricingRecord, TargetFormula } from '../../types';
import {
  calculateProfitability,
  createProfitabilityAnalysis,
} from '../../domain/pricing-engine/profitabilityEngine';
import { formatPricingMoney, convertPricingMoneyToBRL } from '../../utils/pricingCurrency';
import { useToast } from '../Toast';
import {
  CatalogModal,
  Field,
  FormSection,
  Switch,
  fieldClass,
  primaryButton,
  secondaryButton,
} from '../products/catalogUi';
import {
  addDaysToDate,
  contextFromCalculation,
  parseDecimal,
  profitabilityProblem,
  profitabilityTone,
  toProfitabilityInput,
  type ProfitabilityContext,
  type ProfitabilityForm,
} from './profitabilityModel';
import { zeroClearingHandlers } from '../ui/NumericInput';

interface BetaProfitabilityModalProps {
  calc: TargetFormula;
  calcIndex: number;
  /** Precificação salva nesta tela (vínculo padrão). */
  savedPricingId?: string;
  currentUser: { id: string; name: string };
  onClose: () => void;
}

const recordCode = (record: PricingRecord) =>
  `#${record.formattedCod || String(record.cod ?? '').padStart(4, '0')}`;

const TONE = {
  good: {
    card: 'border-emerald-200 bg-emerald-50',
    value: 'text-emerald-700',
    badge: 'bg-emerald-600 text-white',
    label: 'Rentável',
  },
  low: {
    card: 'border-amber-200 bg-amber-50',
    value: 'text-amber-700',
    badge: 'bg-amber-500 text-white',
    label: 'Margem baixa',
  },
  loss: {
    card: 'border-red-200 bg-red-50',
    value: 'text-red-700',
    badge: 'bg-red-600 text-white',
    label: 'Prejuízo',
  },
} as const;

/**
 * Conferir rentabilidade da fórmula (Calculadora teste): resultado ao vivo ao
 * lado dos campos; grava a análise na precificação vinculada. A permissão e o
 * autor são conferidos pelo banco.
 */
export default function BetaProfitabilityModal({
  calc,
  calcIndex,
  savedPricingId,
  currentUser,
  onClose,
}: BetaProfitabilityModalProps) {
  const { showSuccess, showError } = useToast();
  const [context, setContext] = useState<ProfitabilityContext>(() => contextFromCalculation(calc));
  const [linkedId, setLinkedId] = useState<string | undefined>(savedPricingId);
  const [linkedLabel, setLinkedLabel] = useState(savedPricingId ? 'Precificação desta tela' : '');
  const [target, setTarget] = useState({ index: calcIndex, formula: calc.formula });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PricingRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedRecord, setPickedRecord] = useState<PricingRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { form, baseCost, currency, exchangeRate } = context;
  const calculatedPrice = Number(calc.summary?.finalPrice) || 0;
  const set = (patch: Partial<ProfitabilityForm>) =>
    setContext((current) => ({ ...current, form: { ...current.form, ...patch } }));

  // Busca no banco (código ou cliente), com espera de 350 ms e só a última resposta.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2 || pickedRecord) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { searchPricingRecords } = await import('../../services/pricingSearchService');
        const found = await searchPricingRecords(term);
        if (active) setResults(found);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, pickedRecord]);

  const problem = profitabilityProblem(form, baseCost);
  const result = useMemo(
    () => (problem ? null : calculateProfitability(toProfitabilityInput(form, baseCost))),
    [form, baseCost, problem]
  );
  const money = (value: number) => formatPricingMoney(value, currency);
  const inBRL = (value: number) =>
    currency === 'USD' && exchangeRate
      ? formatPricingMoney(convertPricingMoneyToBRL(value, currency, exchangeRate), 'BRL')
      : null;

  const pickRecord = (record: PricingRecord) => {
    setPickedRecord(record);
    setSearch(`${recordCode(record)} · ${record.factors?.client?.name || 'sem cliente'}`);
    setResults([]);
  };

  const pickProduct = (record: PricingRecord, index: number) => {
    const product = record.calculations?.[index];
    if (!product?.summary) return;
    setContext(
      contextFromCalculation({
        factors: product.factors || record.factors,
        summary: product.summary,
      })
    );
    setLinkedId(record.id);
    setLinkedLabel(
      `${recordCode(record)} · ${record.factors?.client?.name || 'sem cliente'} · ${product.formula}`
    );
    setTarget({ index, formula: product.formula });
  };

  const resetLink = () => {
    setPickedRecord(null);
    setSearch('');
    setContext(contextFromCalculation(calc));
    setLinkedId(savedPricingId);
    setLinkedLabel(savedPricingId ? 'Precificação desta tela' : '');
    setTarget({ index: calcIndex, formula: calc.formula });
  };

  const save = async () => {
    if (savingRef.current || !result || !linkedId) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const analysis = createProfitabilityAnalysis({
        ...toProfitabilityInput(form, baseCost),
        pricingRecordId: linkedId,
        calculationIndex: target.index,
        formulaName: target.formula,
        currency,
        exchangeRate,
        // O banco substitui autor e data pelos da sessão.
        analyzedByUserId: currentUser.id,
        analyzedByName: currentUser.name,
      });
      const { saveProfitabilityToCalc } = await import('../../services/db');
      await saveProfitabilityToCalc(linkedId, target.index, analysis);
      showSuccess('Rentabilidade gravada na precificação.');
      onClose();
    } catch (error) {
      const message = (error as { message?: string })?.message;
      showError(
        message?.includes('permissão') ? message : 'Não foi possível gravar a rentabilidade.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const tone = result ? TONE[profitabilityTone(result.profitabilityPercent)] : null;
  const unitaryPrice = parseDecimal(form.unitaryPrice);
  const deductions = result
    ? ([
        ['Frete', parseDecimal(form.freight)],
        [`Alíquota (${form.taxRate}%)`, result.taxDeduction],
        [`Comissão (${form.commission}%)`, result.commissionDeduction],
        [`Juros (${result.daysOfInterest} dias)`, result.interestDeduction],
        ...(result.packagingDeduction !== 0
          ? [['Embalagem', result.packagingDeduction] as [string, number]]
          : []),
      ] as [string, number][])
    : [];

  const percentField = (
    label: string,
    key: 'factor' | 'taxRate' | 'commission' | 'interestRate'
  ) => (
    <Field label={label}>
      <input
        inputMode="decimal"
        value={form[key]}
        onChange={(event) => set({ [key]: event.target.value })}
        {...zeroClearingHandlers(form[key], (next) => set({ [key]: next }))}
        className={`${fieldClass} text-right font-mono`}
      />
    </Field>
  );

  return (
    <CatalogModal
      isOpen
      size="xl"
      title="Rentabilidade"
      subtitle={`${calc.formula || 'Fórmula'} · custo base ${money(baseCost)}/t`}
      icon={<TrendingUp className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Fechar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !result || !linkedId}
            title={!linkedId ? 'Vincule uma precificação para gravar' : undefined}
            className={primaryButton}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Gravando…' : 'Gravar na precificação'}
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <FormSection
            title="Preço de venda"
            description={`Valor por tonelada em ${currency === 'USD' ? 'dólar' : 'reais'}.`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label={`Valor unitário (${currency}/t)`} className="flex-1">
                <input
                  inputMode="decimal"
                  value={form.unitaryPrice}
                  onChange={(event) => set({ unitaryPrice: event.target.value })}
                  {...zeroClearingHandlers(
                    form.unitaryPrice,
                    (next) => set({ unitaryPrice: next }),
                    ''
                  )}
                  className={`${fieldClass} border-emerald-300 bg-emerald-50/50 text-right font-mono text-lg font-black`}
                />
              </Field>
              {calculatedPrice > 0 && Math.abs(unitaryPrice - calculatedPrice) > 0.004 && (
                <button
                  type="button"
                  onClick={() =>
                    set({ unitaryPrice: calculatedPrice.toFixed(2).replace('.', ',') })
                  }
                  className={`${secondaryButton} whitespace-nowrap`}
                >
                  Usar preço calculado ({money(calculatedPrice)})
                </button>
              )}
            </div>
          </FormSection>

          <FormSection title="Fatores e deduções">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {percentField('Fator (×)', 'factor')}
              {percentField('Alíquota (%)', 'taxRate')}
              {percentField('Comissão (%)', 'commission')}
              <Field label={`Frete (${currency}/t)`}>
                <input
                  inputMode="decimal"
                  value={form.freight}
                  onChange={(event) => set({ freight: event.target.value })}
                  {...zeroClearingHandlers(form.freight, (next) => set({ freight: next }))}
                  className={`${fieldClass} text-right font-mono`}
                />
              </Field>
              {percentField('Juros (% a.m.)', 'interestRate')}
              <Field label={`Embalagem (${currency}/t)`} hint="Negativo = crédito.">
                <input
                  inputMode="decimal"
                  value={form.packaging}
                  onChange={(event) => set({ packaging: event.target.value })}
                  {...zeroClearingHandlers(form.packaging, (next) => set({ packaging: next }))}
                  className={`${fieldClass} text-right font-mono`}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Prazo de pagamento">
            <div className="inline-flex rounded-xl bg-stone-100 p-1" role="radiogroup">
              {(
                [
                  ['vencimento', 'Vencimento'],
                  ['ddf', 'DDF'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.paymentCondition === value}
                  onClick={() => {
                    if (value === 'ddf') {
                      const base = form.loadingDate || new Date().toISOString().split('T')[0];
                      set({
                        paymentCondition: 'ddf',
                        loadingDate: base,
                        dueDate: addDaysToDate(base, parseDecimal(form.ddfDays)),
                      });
                    } else set({ paymentCondition: 'vencimento' });
                  }}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${
                    form.paymentCondition === value
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {form.paymentCondition === 'vencimento' ? (
                <Field label="Vencimento">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => set({ dueDate: event.target.value })}
                    className={fieldClass}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Carregamento">
                    <input
                      type="date"
                      value={form.loadingDate}
                      onChange={(event) =>
                        set({
                          loadingDate: event.target.value,
                          dueDate: addDaysToDate(event.target.value, parseDecimal(form.ddfDays)),
                        })
                      }
                      className={fieldClass}
                    />
                  </Field>
                  <Field
                    label="Dias DDF"
                    hint={
                      form.dueDate
                        ? `Vence ${new Date(`${form.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}`
                        : undefined
                    }
                  >
                    <input
                      inputMode="numeric"
                      value={form.ddfDays}
                      onChange={(event) =>
                        set({
                          ddfDays: event.target.value.replace(/\D/g, ''),
                          dueDate: addDaysToDate(
                            form.loadingDate,
                            parseDecimal(event.target.value)
                          ),
                        })
                      }
                      className={`${fieldClass} text-right font-mono`}
                    />
                  </Field>
                </>
              )}
              <Field label="Juros a partir de">
                <input
                  type="date"
                  max={form.dueDate || undefined}
                  value={form.interestStartDate}
                  disabled={form.exemptCurrentMonth}
                  onChange={(event) => set({ interestStartDate: event.target.value })}
                  className={fieldClass}
                />
              </Field>
            </div>
            <Switch
              checked={form.exemptCurrentMonth}
              onChange={(checked) => set({ exemptCurrentMonth: checked })}
              label="Isentar juros no mês atual"
            />
          </FormSection>

          <FormSection
            title="Vincular à precificação"
            description="Onde a análise será gravada. Ao escolher outra precificação, os dados dela são carregados."
          >
            {linkedId ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{linkedLabel}</span>
                {linkedId !== savedPricingId && (
                  <button
                    type="button"
                    onClick={resetLink}
                    className="text-xs font-bold text-emerald-700 underline"
                  >
                    Voltar para esta fórmula
                  </button>
                )}
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Link2 className="h-4 w-4 shrink-0" />
                Salve a precificação ou busque uma abaixo para poder gravar.
              </p>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => {
                  setPickedRecord(null);
                  setSearch(event.target.value);
                }}
                placeholder="Código ou nome do cliente"
                aria-label="Buscar precificação"
                className={`${fieldClass} pl-9 pr-9`}
              />
              {searching ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
              ) : (
                search && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => {
                      setPickedRecord(null);
                      setSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )
              )}
              {results.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
                  {results.map((record) => (
                    <li key={record.id}>
                      <button
                        type="button"
                        onClick={() => pickRecord(record)}
                        className="flex w-full items-baseline gap-2 border-b border-stone-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-emerald-50"
                      >
                        <span className="font-black text-emerald-700">{recordCode(record)}</span>
                        <span className="min-w-0 flex-1 truncate text-stone-700">
                          {record.factors?.client?.name || 'sem cliente'}
                        </span>
                        <span className="text-xs text-stone-400">
                          {record.date ? new Date(record.date).toLocaleDateString('pt-BR') : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {pickedRecord && (
              <div className="flex flex-wrap gap-2">
                {(pickedRecord.calculations || []).map((product, index) =>
                  product.summary ? (
                    <button
                      key={index}
                      type="button"
                      onClick={() => pickProduct(pickedRecord, index)}
                      aria-pressed={linkedId === pickedRecord.id && target.index === index}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        linkedId === pickedRecord.id && target.index === index
                          ? 'border-emerald-400 bg-emerald-50 font-bold text-emerald-800'
                          : 'border-stone-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      {product.formula}
                      <span className="ml-1.5 text-xs text-stone-500">
                        {formatPricingMoney(
                          product.summary.finalPrice,
                          product.summary.currency || 'BRL'
                        )}
                        /t
                      </span>
                    </button>
                  ) : null
                )}
              </div>
            )}
          </FormSection>
        </div>

        {/* Resultado ao vivo */}
        <aside
          className="order-first lg:sticky lg:top-0 lg:order-last lg:self-start"
          aria-live="polite"
        >
          {result && tone ? (
            <div className={`overflow-hidden rounded-2xl border ${tone.card}`}>
              <div className="space-y-1 px-4 py-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-black ${tone.badge}`}
                >
                  {tone.label}
                </span>
                <p className={`text-3xl font-black tabular-nums ${tone.value}`}>
                  {result.profitability >= 0 ? '+' : ''}
                  {money(result.profitability)}
                </p>
                <p className="text-sm font-bold text-stone-600">
                  {result.profitabilityPercent.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  % sobre o custo · por tonelada
                </p>
                {inBRL(result.profitability) && (
                  <p className="text-xs text-stone-500">≈ {inBRL(result.profitability)}</p>
                )}
              </div>
              <dl className="space-y-1.5 border-t border-black/5 bg-white/70 px-4 py-3 text-sm tabular-nums">
                <div className="flex justify-between font-bold text-stone-800">
                  <dt>Venda</dt>
                  <dd>{money(unitaryPrice)}</dd>
                </div>
                {deductions.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2 text-stone-600">
                    <dt className="min-w-0 truncate">(−) {label}</dt>
                    <dd className={`whitespace-nowrap ${value < 0 ? 'text-emerald-700' : ''}`}>
                      {value < 0 ? '+' : '−'} {money(Math.abs(value))}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-stone-200 pt-1.5 font-bold text-stone-800">
                  <dt>Receita líquida</dt>
                  <dd>{money(result.netRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-2 text-stone-600">
                  <dt>(−) Custo × fator {form.factor}</dt>
                  <dd>− {money(result.baseCostAfterFactor)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
              {problem}
            </div>
          )}
        </aside>
      </div>
    </CatalogModal>
  );
}
