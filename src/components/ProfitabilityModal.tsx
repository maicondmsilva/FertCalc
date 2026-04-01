import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Search, Link2, Calculator } from 'lucide-react';
import { TargetFormula, User, ProfitabilityAnalysis, PricingRecord } from '../types';
import { calcRentability } from '../utils/rentabilityUtils';
import { saveProfitabilityToCalc, getPricingRecords } from '../services/db';
import { useToast } from './Toast';

interface ProfitabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  calc: TargetFormula;
  calcIndex: number;
  pricingRecordId?: string;
  currentUser: User;
  onSaved?: () => void;
}

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
  const [unitaryPrice, setUnitaryPrice] = useState<number | ''>('');

  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingResults, setPricingResults] = useState<PricingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PricingRecord | null>(null);
  const [selectedProductIdx, setSelectedProductIdx] = useState<number>(-1);
  const [linkedPricingRecordId, setLinkedPricingRecordId] = useState<string | undefined>(initialPricingRecordId);

  const [result, setResult] = useState<ReturnType<typeof calcRentability> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFactor(calc.factors.factor);
      setTaxRate(calc.factors.taxRate);
      setCommission(calc.factors.commission);
      setFreight(calc.factors.freight);
      setInterestRate(calc.factors.monthlyInterestRate);
      setUnitaryPrice('');
      setResult(null);
      setPricingSearch('');
      setPricingResults([]);
      setSelectedRecord(null);
      setSelectedProductIdx(-1);
      setLinkedPricingRecordId(initialPricingRecordId);
    }
  }, [isOpen, calc, initialPricingRecordId]);

  const handleSearchPricing = async () => {
    if (!pricingSearch.trim()) return;
    setIsSearching(true);
    try {
      const all = await getPricingRecords();
      const term = pricingSearch.trim().toLowerCase();
      const filtered = all.filter(r => {
        const cod = r.cod ? String(r.cod).padStart(4, '0') : '';
        const clientName = (r.factors?.client?.name || '').toLowerCase();
        return cod.includes(term) || clientName.includes(term);
      });
      setPricingResults(filtered.slice(0, 10));
    } catch {
      showError('Erro ao buscar precificações.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRecord = (record: PricingRecord) => {
    setSelectedRecord(record);
    setSelectedProductIdx(-1);
    setLinkedPricingRecordId(record.id);
  };

  const handleSelectProduct = (idx: number) => {
    if (!selectedRecord) return;
    setSelectedProductIdx(idx);
    const calcs = selectedRecord.calculations && selectedRecord.calculations.length > 0
      ? selectedRecord.calculations
      : [];
    const prod = calcs[idx];
    if (prod?.summary?.finalPrice) {
      setUnitaryPrice(prod.summary.finalPrice);
    }
  };

  const handleCalculate = () => {
    const price = typeof unitaryPrice === 'number' ? unitaryPrice : 0;
    const baseCost = calc.summary?.baseCost ?? 0;
    const res = calcRentability({
      unitaryPrice: price,
      factor,
      baseCost,
      freightDeduction: freight,
      commissionRate: commission,
      interestRate,
      taxRate,
    });
    setResult(res);
  };

  const handleSave = async () => {
    if (!result) return;
    if (!linkedPricingRecordId) {
      showError('Nenhuma precificação vinculada. Vincule ou selecione uma precificação para salvar.');
      return;
    }

    const price = typeof unitaryPrice === 'number' ? unitaryPrice : 0;
    const baseCost = calc.summary?.baseCost ?? 0;

    const analysis: ProfitabilityAnalysis = {
      pricingRecordId: linkedPricingRecordId,
      calculationIndex: calcIndex,
      formulaName: calc.formula,
      unitaryPrice: price,
      factor,
      baseCost,
      baseCostAfterFactor: result.baseCostAfterFactor,
      freightDeduction: freight,
      commissionRate: commission,
      commissionDeduction: result.commissionDeduction,
      interestRate,
      interestDeduction: result.interestDeduction,
      taxRate,
      taxDeduction: result.taxDeduction,
      netRevenue: result.netRevenue,
      profitability: result.profitability,
      profitabilityPercent: result.profitabilityPercent,
      analyzedByUserId: currentUser.id,
      analyzedByName: currentUser.name,
      analyzedAt: new Date().toISOString(),
    };

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

  if (!isOpen) return null;

  const isPositive = result ? result.profitability >= 0 : false;
  const price = typeof unitaryPrice === 'number' ? unitaryPrice : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-stone-800">Conferir Rentabilidade</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Formula name */}
          <div className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Fórmula</p>
            <p className="text-sm font-bold text-stone-700">{calc.formula}</p>
            {calc.summary && (
              <p className="text-[10px] text-stone-400 mt-0.5">Custo Base: R$ {calc.summary.baseCost.toFixed(2)}/t</p>
            )}
          </div>

          {/* Commercial factors */}
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase mb-2">Fatores Comerciais</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Fator (×)</label>
                <input
                  type="number" step="0.01"
                  value={factor}
                  onChange={(e) => setFactor(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Alíquota (%)</label>
                <input
                  type="number" step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Comissão (%)</label>
                <input
                  type="number" step="0.1"
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Frete (R$/ton)</label>
                <input
                  type="number"
                  value={freight}
                  onChange={(e) => setFreight(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Juros (%)</label>
                <input
                  type="number" step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Valor Unitário (R$/ton)</label>
                <input
                  type="number" step="0.01"
                  value={unitaryPrice}
                  onChange={(e) => setUnitaryPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Digite ou vincule"
                  className="w-full px-2 py-1.5 text-sm border border-orange-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none bg-orange-50 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Link to a pricing record */}
          <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-stone-500" />
              <p className="text-xs font-bold text-stone-500 uppercase">Vincular a uma Precificação (opcional)</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={pricingSearch}
                onChange={(e) => setPricingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchPricing()}
                placeholder="COD ou nome do cliente..."
                className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-1 focus:ring-stone-500 outline-none"
              />
              <button
                onClick={handleSearchPricing}
                disabled={isSearching}
                className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 text-white text-xs font-bold rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-60"
              >
                <Search className="w-3.5 h-3.5" />
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {pricingResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {pricingResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRecord(r)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                      selectedRecord?.id === r.id
                        ? 'bg-orange-50 border-orange-300 text-orange-700 font-bold'
                        : 'bg-stone-50 border-stone-200 hover:border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    <span className="font-mono font-bold">#{r.cod ? String(r.cod).padStart(4, '0') : r.id.slice(-4)}</span>
                    {' | '}
                    <span>{r.factors?.client?.name || '—'}</span>
                    {' | '}
                    <span className="text-stone-400">{r.date ? new Date(r.date).toLocaleDateString('pt-BR') : ''}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedRecord && selectedRecord.calculations && selectedRecord.calculations.length > 0 && (
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Selecione o produto para puxar o Valor Unitário</p>
                <div className="space-y-1">
                  {selectedRecord.calculations.map((calc, originalIdx) => (
                    calc.summary ? (
                      <button
                        key={originalIdx}
                        onClick={() => handleSelectProduct(originalIdx)}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors ${
                          selectedProductIdx === originalIdx
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                            : 'bg-stone-50 border-stone-200 hover:border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        {calc.formula}
                        {calc.summary && (
                          <span className="ml-2 text-stone-400">— R$ {calc.summary.finalPrice.toFixed(2)}/t</span>
                        )}
                      </button>
                    ) : null
                  ))}
                </div>
              </div>
            )}

            {linkedPricingRecordId && (
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span>✓</span> Vinculado ao registro: {
                  selectedRecord
                    ? `#${selectedRecord.cod ? String(selectedRecord.cod).padStart(4, '0') : selectedRecord.id.slice(-4)} — ${selectedRecord.factors?.client?.name || ''}`
                    : linkedPricingRecordId
                }
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
            <div className={`rounded-xl border ${isPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`px-4 py-3 rounded-t-xl text-xs font-bold uppercase tracking-widest ${isPositive ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>
                Análise de Rentabilidade
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Custo (base):</span>
                  <span className="font-mono">R$ {(calc.summary?.baseCost ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">× Fator ({factor}):</span>
                  <span className="font-mono">R$ {result.baseCostAfterFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Frete:</span>
                  <span className="font-mono">- R$ {freight.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Comissão ({commission}%):</span>
                  <span className="font-mono">- R$ {result.commissionDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Juros ({interestRate}%):</span>
                  <span className="font-mono">- R$ {result.interestDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) Alíquota ({taxRate}%):</span>
                  <span className="font-mono">- R$ {result.taxDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-stone-200 pt-2">
                  <span>= Receita Líquida:</span>
                  <span className="font-mono">R$ {result.netRevenue.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between text-lg font-black pt-1 ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                  <span>RENTABILIDADE ({result.profitabilityPercent.toFixed(2)}%):</span>
                  <span className="font-mono">{isPositive ? '+' : ''}R$ {result.profitability.toFixed(2)}</span>
                </div>
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
                  title={!linkedPricingRecordId ? 'Vincule uma precificação para salvar' : undefined}
                >
                  {isSaving ? 'Salvando...' : 'Salvar Rentabilidade na Precificação'}
                </button>
                {!linkedPricingRecordId && (
                  <p className="text-[10px] text-stone-400 text-center mt-1">Vincule uma precificação acima para habilitar o salvamento</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
