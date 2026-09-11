import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Search, Link2, Calculator } from 'lucide-react';
import { TargetFormula, User, PricingRecord } from '../types';
import { calculateProfitability, createProfitabilityAnalysis } from '../domain/pricing-engine';
import { saveProfitabilityToCalc, getPricingRecords } from '../services/db';
import { useToast } from './Toast';
import { closeModalOnBackdrop } from '../utils/modalUtils';
import {
  convertPricingMoneyToBRL,
  formatPricingMoney,
  getPricingCurrency,
  getPricingExchangeRate,
} from '../utils/pricingCurrency';

interface ProfitabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  calc: TargetFormula;
  calcIndex: number;
  pricingRecordId?: string;
  currentUser: User;
  onSaved?: () => void;
}

const addDaysToDate = (date: string, days: number): string => {
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setDate(parsed.getDate() + Math.max(0, days));
  return parsed.toISOString().split('T')[0];
};

const parseMoneyInput = (value: string): number => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoneyInput = (value: number): string => value.toFixed(2).replace('.', ',');

export default function ProfitabilityModal({
  isOpen,
  onClose,
  calc,
  calcIndex,
  pricingRecordId: initialPricingRecordId,
  currentUser,
  onSaved,
}: ProfitabilityModalProps) {
  const { showSuccess, showError } = useToast();

  const [factor, setFactor] = useState(calc.factors.factor);
  const [taxRate, setTaxRate] = useState(calc.factors.taxRate);
  const [commission, setCommission] = useState(calc.factors.commission);
  const [freight, setFreight] = useState(calc.factors.freight);
  const [interestRate, setInterestRate] = useState(calc.factors.monthlyInterestRate);
  const [dueDate, setDueDate] = useState<string>(calc.factors?.dueDate || '');
  const [paymentCondition, setPaymentCondition] = useState<'vencimento' | 'ddf'>(
    calc.factors?.paymentCondition || 'vencimento'
  );
  const [loadingDate, setLoadingDate] = useState<string>(calc.factors?.dataCarregamento || '');
  const [ddfDays, setDdfDays] = useState<number>(calc.factors?.ddfDias || 30);
  const [exemptCurrentMonth, setExemptCurrentMonth] = useState<boolean>(
    calc.factors?.exemptCurrentMonth || false
  );
  const [interestStartDate, setInterestStartDate] = useState<string>(
    calc.factors?.interestStartDate || ''
  );
  const [packagingValue, setPackagingValue] = useState<string>(
    formatMoneyInput(calc.factors?.embalagem_valor || 0)
  );
  const [unitaryPrice, setUnitaryPrice] = useState<number | ''>('');
  const [analysisCurrency, setAnalysisCurrency] = useState(
    getPricingCurrency(calc.summary, calc.factors)
  );
  const [analysisExchangeRate, setAnalysisExchangeRate] = useState<number | undefined>(
    getPricingExchangeRate(calc.summary, calc.factors)
  );
  const [analysisBaseCost, setAnalysisBaseCost] = useState(calc.summary?.baseCost ?? 0);

  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingResults, setPricingResults] = useState<PricingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PricingRecord | null>(null);
  const [selectedProductIdx, setSelectedProductIdx] = useState<number>(-1);
  const [linkedPricingRecordId, setLinkedPricingRecordId] = useState<string | undefined>(
    initialPricingRecordId
  );
  const [isSearchingPricing, setIsSearchingPricing] = useState(false);

  const [result, setResult] = useState<ReturnType<typeof calculateProfitability> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFactor(calc.factors.factor);
      setTaxRate(calc.factors.taxRate);
      setCommission(calc.factors.commission);
      setFreight(calc.factors.freight);
      setInterestRate(calc.factors.monthlyInterestRate);
      setDueDate(calc.factors?.dueDate || '');
      setPaymentCondition(calc.factors?.paymentCondition || 'vencimento');
      setLoadingDate(calc.factors?.dataCarregamento || '');
      setDdfDays(calc.factors?.ddfDias || 30);
      setExemptCurrentMonth(calc.factors?.exemptCurrentMonth || false);
      setInterestStartDate(calc.factors?.interestStartDate || '');
      setPackagingValue(formatMoneyInput(calc.factors?.embalagem_valor || 0));
      setUnitaryPrice('');
      setAnalysisCurrency(getPricingCurrency(calc.summary, calc.factors));
      setAnalysisExchangeRate(getPricingExchangeRate(calc.summary, calc.factors));
      setAnalysisBaseCost(calc.summary?.baseCost ?? 0);
      setResult(null);
      setPricingSearch('');
      setPricingResults([]);
      setSelectedRecord(null);
      setSelectedProductIdx(-1);
      setLinkedPricingRecordId(initialPricingRecordId);
    }
  }, [isOpen, calc, initialPricingRecordId]);

  // Busca reativa com debounce de 400ms
  useEffect(() => {
    if (!pricingSearch.trim()) {
      setPricingResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPricing(true);
      try {
        const all = await getPricingRecords();
        const term = pricingSearch.trim().toLowerCase();
        const filtered = all.filter((r) => {
          const cod = r.cod ? String(r.cod).padStart(4, '0') : '';
          const formattedCod = r.formattedCod?.toLowerCase() || '';
          const clientName = (r.factors?.client?.name || '').toLowerCase();
          return cod.includes(term) || formattedCod.includes(term) || clientName.includes(term);
        });
        setPricingResults(filtered.slice(0, 10));
      } catch {
        // silencioso
      } finally {
        setIsSearchingPricing(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [pricingSearch]);

  const handleSelectRecord = (record: PricingRecord) => {
    setSelectedRecord(record);
    setSelectedProductIdx(-1);
    setLinkedPricingRecordId(record.id);
    setPricingSearch(
      `#${record.formattedCod || String(record.cod).padStart(4, '0')} — ${record.factors?.client?.name || ''}`
    );
    setPricingResults([]);
  };

  const handleSelectProduct = (record: PricingRecord, idx: number) => {
    setSelectedProductIdx(idx);
    const calcs = record.calculations || [];
    const prod = calcs[idx];
    if (!prod) return;

    // Migração automática dos fatores do produto selecionado
    const f = prod.factors || record.factors;
    if (f) {
      setFreight(f.freight ?? freight);
      setCommission(f.commission ?? commission);
      setInterestRate(f.monthlyInterestRate ?? interestRate);
      setTaxRate(f.taxRate ?? taxRate);
      setDueDate(f.dueDate || '');
      setPaymentCondition(f.paymentCondition || 'vencimento');
      setLoadingDate(f.dataCarregamento || '');
      setDdfDays(f.ddfDias || 30);
      setExemptCurrentMonth(f.exemptCurrentMonth || false);
      setInterestStartDate(f.interestStartDate || '');
      setPackagingValue(formatMoneyInput(f.embalagem_valor ?? 0));
    }

    if (prod.summary?.finalPrice) {
      setUnitaryPrice(prod.summary.finalPrice);
    }
    setAnalysisCurrency(getPricingCurrency(prod.summary, f));
    setAnalysisExchangeRate(getPricingExchangeRate(prod.summary, f));
    setAnalysisBaseCost(prod.summary?.baseCost ?? 0);
  };

  const handleCalculate = () => {
    const price = typeof unitaryPrice === 'number' ? unitaryPrice : 0;
    const baseCost = analysisBaseCost;
    const res = calculateProfitability({
      unitaryPrice: price,
      factor,
      baseCost,
      freightDeduction: freight,
      commissionRate: commission,
      interestRate,
      taxRate,
      dueDate,
      exemptCurrentMonth,
      interestStartDate,
      paymentCondition,
      dataCarregamento: loadingDate,
      ddfDias: ddfDays,
      packagingValue: parseMoneyInput(packagingValue),
    });
    setResult(res);
  };

  const handleSave = async () => {
    if (!result) return;
    if (!linkedPricingRecordId) {
      showError(
        'Nenhuma precificação vinculada. Vincule ou selecione uma precificação para salvar.'
      );
      return;
    }

    const price = typeof unitaryPrice === 'number' ? unitaryPrice : 0;
    const baseCost = analysisBaseCost;

    const analysis = createProfitabilityAnalysis({
      pricingRecordId: linkedPricingRecordId,
      calculationIndex: calcIndex,
      formulaName: calc.formula,
      unitaryPrice: price,
      factor,
      baseCost,
      freightDeduction: freight,
      commissionRate: commission,
      interestRate,
      taxRate,
      dueDate,
      exemptCurrentMonth,
      interestStartDate,
      paymentCondition,
      dataCarregamento: loadingDate,
      ddfDias: ddfDays,
      packagingValue: parseMoneyInput(packagingValue),
      currency: analysisCurrency,
      exchangeRate: analysisExchangeRate,
      analyzedByUserId: currentUser.id,
      analyzedByName: currentUser.name,
    });

    setIsSaving(true);
    try {
      await saveProfitabilityToCalc(linkedPricingRecordId, calcIndex, analysis);
      showSuccess('Rentabilidade gravada com sucesso!');
      if (onSaved) onSaved();
    } catch {
      showError('Erro ao salvar rentabilidade.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
  };

  if (!isOpen) return null;

  const isPositive = result ? result.profitability >= 0 : false;
  const money = (value: number) => formatPricingMoney(value, analysisCurrency);
  const brlEquivalent = (value: number) =>
    analysisCurrency === 'USD' && analysisExchangeRate
      ? formatPricingMoney(
          convertPricingMoneyToBRL(value, analysisCurrency, analysisExchangeRate),
          'BRL'
        )
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, isSaving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-stone-800">Conferir Rentabilidade</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Formula name */}
          <div className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Fórmula</p>
            <p className="text-sm font-bold text-stone-700">{calc.formula}</p>
            {calc.summary && (
              <p className="text-[10px] text-stone-400 mt-0.5">
                Custo Base: {money(analysisBaseCost)}/t
                {brlEquivalent(analysisBaseCost) ? ` (${brlEquivalent(analysisBaseCost)}/t)` : ''}
              </p>
            )}
          </div>

          {/* Commercial factors */}
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase mb-2">Fatores Comerciais</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Fator (×)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={factor}
                  onChange={(e) => setFactor(Number(e.target.value))}
                  onFocus={handleNumericFocus}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Alíquota (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  onFocus={handleNumericFocus}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Comissão (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                  onFocus={handleNumericFocus}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Frete ({analysisCurrency}/ton)
                </label>
                <input
                  type="number"
                  value={freight}
                  onChange={(e) => setFreight(Number(e.target.value))}
                  onFocus={handleNumericFocus}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Juros (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  onFocus={handleNumericFocus}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Condição de Pagamento
                </label>
                <select
                  value={paymentCondition}
                  onChange={(e) => {
                    const condition = e.target.value as 'vencimento' | 'ddf';
                    setPaymentCondition(condition);
                    if (condition === 'ddf') {
                      const baseDate = loadingDate || new Date().toISOString().split('T')[0];
                      setLoadingDate(baseDate);
                      setDueDate(addDaysToDate(baseDate, ddfDays));
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                  <option value="vencimento">Vencimento</option>
                  <option value="ddf">DDF</option>
                </select>
              </div>
              {paymentCondition === 'vencimento' ? (
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                      Data de Carregamento
                    </label>
                    <input
                      type="date"
                      value={loadingDate}
                      onChange={(e) => {
                        setLoadingDate(e.target.value);
                        setDueDate(addDaysToDate(e.target.value, ddfDays));
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                      Dias DDF
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={ddfDays || ''}
                      onChange={(e) => {
                        const days = e.target.value === '' ? 0 : Number(e.target.value);
                        setDdfDays(days);
                        setDueDate(addDaysToDate(loadingDate, days));
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                    <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                      Vencimento:{' '}
                      {dueDate ? new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Cobrar Juros a Partir de
                </label>
                <input
                  type="date"
                  max={dueDate || undefined}
                  value={interestStartDate}
                  disabled={exemptCurrentMonth}
                  onChange={(e) => setInterestStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:bg-stone-100 disabled:text-stone-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Embalagem ({analysisCurrency}/ton)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={packagingValue}
                  onChange={(e) => {
                    if (/^-?\d*(?:[.,]\d{0,2})?$/.test(e.target.value)) {
                      setPackagingValue(e.target.value);
                    }
                  }}
                  onBlur={() =>
                    setPackagingValue(formatMoneyInput(parseMoneyInput(packagingValue)))
                  }
                  placeholder="Ex: 50,00 ou -50,00"
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="mt-1 text-[10px] text-stone-500">
                  Positivo desconta da receita; negativo acrescenta crédito.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                  Valor Unitário ({analysisCurrency}/ton)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unitaryPrice}
                  onChange={(e) =>
                    setUnitaryPrice(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  onBlur={() => {
                    if (typeof unitaryPrice === 'number')
                      setUnitaryPrice(Number(unitaryPrice.toFixed(2)));
                  }}
                  onFocus={handleNumericFocus}
                  placeholder="Digite ou vincule"
                  className="w-full px-2 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none bg-orange-50 font-bold"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-3">
              <input
                type="checkbox"
                checked={exemptCurrentMonth}
                onChange={(e) => setExemptCurrentMonth(e.target.checked)}
                className="rounded text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm font-medium text-stone-600">Isentar juros no mês atual</span>
            </label>
          </div>

          {/* Link to a pricing record */}
          <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-stone-500" />
              <p className="text-xs font-bold text-stone-500 uppercase">
                Vincular a uma Precificação (opcional)
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={pricingSearch}
                onChange={(e) => setPricingSearch(e.target.value)}
                placeholder="Digite o COD ou nome do cliente..."
                className="w-full px-3 py-2 pl-9 border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none text-sm"
              />
              {isSearchingPricing && (
                <span className="absolute right-3 top-2.5 text-xs text-stone-400">buscando...</span>
              )}
              {pricingResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                  {pricingResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRecord(r)}
                      className="w-full px-4 py-2.5 text-left hover:bg-orange-50 text-sm border-b border-stone-100 last:border-0"
                    >
                      <span className="font-bold text-orange-700">
                        #{r.formattedCod || String(r.cod).padStart(4, '0')}
                      </span>
                      <span className="text-stone-600 ml-2">{r.factors?.client?.name}</span>
                      <span className="text-stone-400 text-xs ml-2">
                        {r.date ? new Date(r.date).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedRecord &&
              selectedRecord.calculations &&
              selectedRecord.calculations.length > 0 && (
                <div>
                  <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">
                    Selecione o produto para puxar os dados
                  </p>
                  <div className="space-y-1">
                    {selectedRecord.calculations.map((c, originalIdx) =>
                      c.summary ? (
                        <button
                          key={originalIdx}
                          onClick={() => handleSelectProduct(selectedRecord, originalIdx)}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                            selectedProductIdx === originalIdx
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                              : 'bg-stone-50 border-stone-200 hover:border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          {c.formula}
                          {c.summary && (
                            <span className="ml-2 text-stone-400">
                              —{' '}
                              {formatPricingMoney(
                                c.summary.finalPrice,
                                getPricingCurrency(c.summary, c.factors)
                              )}
                              /t
                            </span>
                          )}
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              )}

            {linkedPricingRecordId && (
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span>✓</span> Vinculado ao registro:{' '}
                {selectedRecord
                  ? `#${selectedRecord.formattedCod || String(selectedRecord.cod).padStart(4, '0')} — ${selectedRecord.factors?.client?.name || ''}`
                  : linkedPricingRecordId}
              </p>
            )}
          </div>

          {/* Calculate button */}
          <button
            onClick={handleCalculate}
            disabled={unitaryPrice === '' || unitaryPrice === 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calculator className="w-4 h-4" />
            Calcular Rentabilidade
          </button>

          {/* Result panel */}
          {result && (
            <div
              className={`rounded-xl border ${isPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
            >
              <div
                className={`px-4 py-3 rounded-t-xl text-xs font-bold uppercase tracking-widest ${isPositive ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}
              >
                Análise de Rentabilidade
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Valor Unitário (Venda):</span>
                  <span className="font-mono">
                    {money(typeof unitaryPrice === 'number' ? unitaryPrice : 0)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Alíquota ({taxRate}%):</span>
                  <span className="font-mono">- {money(result.taxDeduction)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Frete:</span>
                  <span className="font-mono">- {money(freight)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Comissão ({commission}%):</span>
                  <span className="font-mono">- {money(result.commissionDeduction)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>
                    (-) Juros ({interestRate}% a.m. × {result.daysOfInterest} dias):
                  </span>
                  <span className="font-mono">- {money(result.interestDeduction)}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Condição financeira:</span>
                  <span className="font-medium">
                    {paymentCondition === 'ddf' ? `${ddfDays} DDF` : 'Vencimento'} ·{' '}
                    {dueDate
                      ? new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR')
                      : 'sem data'}
                  </span>
                </div>
                {result.packagingDeduction !== 0 && (
                  <div
                    className={`flex justify-between ${result.packagingDeduction > 0 ? 'text-red-600' : 'text-emerald-600 font-medium'}`}
                  >
                    <span>
                      {result.packagingDeduction > 0
                        ? '(-) Embalagem (Cobrança):'
                        : '(+) Embalagem (Desconto):'}
                    </span>
                    <span className="font-mono">
                      {result.packagingDeduction > 0 ? '-' : '+'}{' '}
                      {money(Math.abs(result.packagingDeduction))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-stone-200 pt-2">
                  <span>= Receita Líquida:</span>
                  <span className="font-mono">{money(result.netRevenue)}</span>
                </div>
                <div className="flex justify-between text-red-600 border-t border-stone-200 pt-2">
                  <span>(-) Custo × Fator ({factor}):</span>
                  <span className="font-mono">- {money(result.baseCostAfterFactor)}</span>
                </div>
                <div
                  className={`flex justify-between text-lg font-black pt-1 ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}
                >
                  <span>RENTABILIDADE ({result.profitabilityPercent.toFixed(2)}%):</span>
                  <span className="font-mono">
                    {isPositive ? '+' : ''}
                    {money(result.profitability)}
                  </span>
                </div>
                {brlEquivalent(result.profitability) && (
                  <div className="flex justify-between border-t border-stone-200 pt-2 text-xs font-semibold text-stone-600">
                    <span>Equivalente da rentabilidade em BRL:</span>
                    <span>{brlEquivalent(result.profitability)}</span>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !linkedPricingRecordId}
                  className={`w-full py-2.5 font-bold text-sm rounded-lg transition-colors ${
                    linkedPricingRecordId
                      ? isPositive
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  } disabled:opacity-60`}
                  title={
                    !linkedPricingRecordId ? 'Vincule uma precificação para salvar' : undefined
                  }
                >
                  {isSaving ? 'Salvando...' : 'Salvar Rentabilidade na Precificação'}
                </button>
                {!linkedPricingRecordId && (
                  <p className="text-[10px] text-stone-400 text-center mt-1">
                    Vincule uma precificação acima para habilitar o salvamento
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
