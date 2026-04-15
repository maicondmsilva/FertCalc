import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Calculator as CalculatorIcon,
  Building2,
  Database,
  Search,
  Tag,
  Settings,
  X,
  Beaker,
  Truck,
  Package,
} from 'lucide-react';
import { PricingRecord, SavedFormula, User as AppUser, Embalagem } from '../types';
import { useToast } from './Toast';
import { formatNPK } from '../utils/formatters';
import { FertigranPComparisonModal } from './FertigranPComparisonModal';
import { CalculatorSettingsModal } from './CalculatorSettingsModal';
import ProfitabilityModal from './ProfitabilityModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { PromptDialog } from './ui/PromptDialog';
import { useCalculator } from '../hooks/useCalculator';
import { getCotacoesAprovadas } from '../services/cotacaoSolicitadaService';
import { CotacaoSolicitada } from '../types/carregamento';
import { getEmbalagens } from '../services/embalagensService';

interface CalculatorProps {
  initialData?: PricingRecord | null;
  initialFormulaToLoad?: SavedFormula | null;
  initialBranchId?: string;
  initialPriceListId?: string;
  onClearEditing?: () => void;
  onSaveSuccess?: (record: PricingRecord) => void;
  currentUser: AppUser;
  isSimplified?: boolean;
}

export default function Calculator({
  initialData,
  initialFormulaToLoad,
  initialBranchId,
  initialPriceListId,
  onClearEditing,
  onSaveSuccess,
  currentUser,
  isSimplified,
}: CalculatorProps) {
  const { showSuccess } = useToast();

  const {
    confirmState,
    handleConfirm,
    handleCancel,
    promptState,
    setPromptState,
    isSettingsOpen,
    activeFormulaId,
    openSettings,
    closeSettings,
    status,
    setStatus,
    isFertigranPModalOpen,
    setIsFertigranPModalOpen,
    currentComparisonFormula,
    setCurrentComparisonFormula,
    isProfitabilityModalOpen,
    setIsProfitabilityModalOpen,
    profitabilityTargetCalc,
    setProfitabilityTargetCalc,
    profitabilityTargetIndex,
    setProfitabilityTargetIndex,
    savedPricingId,
    branches,
    priceLists,
    availableClients,
    availableAgents,
    clientSearch,
    setClientSearch,
    agentSearch,
    setAgentSearch,
    showClientResults,
    setShowClientResults,
    showAgentResults,
    setShowAgentResults,
    macros,
    micros,
    compCategories,
    isLocked,
    factors,
    setFactors,
    calculations,
    setCalculations,
    expandedCalc,
    setExpandedCalc,
    handleFactorChange,
    calculateFormula,
    addTargetFormula,
    removeTargetFormula,
    updateCalculation,
    updateCalculationFactors,
    savePricing,
    saveToFormulasList,
  } = useCalculator({
    initialData,
    initialFormulaToLoad,
    initialBranchId,
    initialPriceListId,
    onClearEditing,
    onSaveSuccess,
    currentUser,
  });

  // ─── Quote search modal state ────────────────────────────────
  const [showCotacaoModal, setShowCotacaoModal] = useState(false);
  const [cotacaoModalCalcId, setCotacaoModalCalcId] = useState<string | null>(null);
  const [cotacoesAprovadas, setCotacoesAprovadas] = useState<CotacaoSolicitada[]>([]);
  const [cotacaoLoading, setCotacaoLoading] = useState(false);

  // ─── Embalagem state ─────────────────────────────────────────
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);

  useEffect(() => {
    getEmbalagens(true)
      .then(setEmbalagens)
      .catch(() => {});
  }, []);

  const openCotacaoModal = async (calcId: string) => {
    setCotacaoModalCalcId(calcId);
    setShowCotacaoModal(true);
    setCotacaoLoading(true);
    try {
      const data = await getCotacoesAprovadas(currentUser.id);
      setCotacoesAprovadas(data);
    } catch {
      setCotacoesAprovadas([]);
    } finally {
      setCotacaoLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Header Info */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-stone-800">Informações Gerais</h2>
            <div className="flex items-center gap-4">
              {isLocked && (
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100 uppercase">
                  Bloqueada para Edição
                </span>
              )}
              {initialData && (
                <button
                  onClick={() => {
                    setClientSearch('');
                    setAgentSearch('');
                    onClearEditing?.();
                  }}
                  className="text-xs bg-stone-100 text-stone-600 px-3 py-1 rounded-lg hover:bg-stone-200 font-bold"
                >
                  Nova Cotação
                </button>
              )}
            </div>
          </div>

          {!isSimplified && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Selection */}
              <div className="md:col-span-2 bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-stone-400" />
                  <span className="text-sm font-bold text-stone-600 uppercase">
                    Status da Precificação
                  </span>
                </div>
                <select
                  value={status}
                  disabled={isLocked}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border-2 focus:ring-2 focus:ring-stone-500 outline-none transition-all ${
                    status === 'Fechada'
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                      : status === 'Perdida'
                        ? 'bg-red-100 border-red-200 text-red-800'
                        : 'bg-blue-100 border-blue-200 text-blue-800'
                  } ${isLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Fechada">Fechada</option>
                  <option value="Perdida">Perdida</option>
                </select>
              </div>

              {/* Client Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">
                  Seleção do Cliente
                </h3>
                <div className="relative">
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Buscar Cliente (Nome ou Código)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input
                      type="text"
                      value={clientSearch || ''}
                      disabled={isLocked}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientResults(true);
                      }}
                      onFocus={() => setShowClientResults(true)}
                      className={`w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                      placeholder="Digite nome ou código..."
                    />
                  </div>
                  {showClientResults && clientSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {availableClients
                        .filter(
                          (c) =>
                            c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                            c.code.toLowerCase().includes(clientSearch.toLowerCase())
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFactors({ ...factors, client: c });
                              setClientSearch(c.name);
                              setShowClientResults(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                          >
                            <p className="text-sm font-bold text-stone-800">{c.name}</p>
                            <p className="text-[10px] text-stone-500">
                              {c.code} | {c.document}
                            </p>
                          </button>
                        ))}
                    </div>
                  )}
                  {factors.client.name && (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-emerald-800">{factors.client.name}</p>
                        <p className="text-[10px] text-emerald-600">
                          Cód: {factors.client.code} | Doc: {factors.client.document}
                        </p>
                      </div>
                      <button
                        disabled={isLocked}
                        onClick={() => {
                          setFactors({
                            ...factors,
                            client: { id: '', code: '', name: '', document: '' },
                          });
                          setClientSearch('');
                        }}
                        className={`${isLocked ? 'text-stone-300 cursor-not-allowed' : 'text-emerald-400 hover:text-emerald-600'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">
                  Seleção do Agente
                </h3>
                <div className="relative">
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Buscar Agente (Nome ou Código)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input
                      type="text"
                      value={agentSearch || ''}
                      disabled={isLocked}
                      onChange={(e) => {
                        setAgentSearch(e.target.value);
                        setShowAgentResults(true);
                      }}
                      onFocus={() => setShowAgentResults(true)}
                      className={`w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                      placeholder="Digite nome ou código..."
                    />
                  </div>
                  {showAgentResults && agentSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {availableAgents
                        .filter(
                          (a) =>
                            a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                            a.code.toLowerCase().includes(agentSearch.toLowerCase())
                        )
                        .map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setFactors({ ...factors, agent: a });
                              setAgentSearch(a.name);
                              setShowAgentResults(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                          >
                            <p className="text-sm font-bold text-stone-800">{a.name}</p>
                            <p className="text-[10px] text-stone-500">
                              {a.code} | {a.document}
                            </p>
                          </button>
                        ))}
                    </div>
                  )}
                  {factors.agent.name && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-blue-800">{factors.agent.name}</p>
                        <p className="text-[10px] text-blue-600">
                          Cód: {factors.agent.code} | Doc: {factors.agent.document}
                        </p>
                      </div>
                      <button
                        disabled={isLocked}
                        onClick={() => {
                          setFactors({
                            ...factors,
                            agent: { id: '', code: '', name: '', document: '' },
                          });
                          setAgentSearch('');
                        }}
                        className={`${isLocked ? 'text-stone-300 cursor-not-allowed' : 'text-blue-400 hover:text-blue-600'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-stone-100">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <Building2 className="w-4 h-4 mr-1" /> Filial
              </label>
              <select
                value={factors.branchId}
                onChange={(e) => {
                  const newBranch = e.target.value;
                  const lists = priceLists.filter((l) => l.branchId === newBranch);
                  const latestListId = lists.length > 0 ? lists[0].id : '';
                  setFactors({ ...factors, branchId: newBranch, priceListId: latestListId });
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione uma filial</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <Database className="w-4 h-4 mr-1" /> Lista de Preço
              </label>
              <select
                value={factors.priceListId}
                onChange={(e) => handleFactorChange('priceListId', e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                disabled={!factors.branchId}
              >
                <option value="">Selecione uma lista</option>
                {priceLists
                  .filter((l) => l.branchId === factors.branchId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* F\u00f3rmulas Alvo \u2014 full-width below status */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <label className="block text-sm font-medium text-stone-600 mb-2">Fórmulas Alvo</label>
            <div className="space-y-3">
              {calculations.map((calc, calcIdx) => (
                <div
                  key={calc.id}
                  className="relative p-2 bg-stone-50 rounded-lg border border-stone-200 space-y-2"
                >
                  {/* Main row: checkbox + formula + CA/S + type + gear + calc + delete */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={calc.selected}
                      onChange={(e) => updateCalculation(calc.id, 'selected', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                    />
                    {/* Formula input */}
                    <input
                      type="text"
                      value={calc.formula}
                      onChange={(e) => updateCalculation(calc.id, 'formula', e.target.value)}
                      placeholder="Ex: 04-14-08"
                      className="flex-1 min-w-[90px] px-2 py-1 text-sm border border-stone-300 rounded focus:ring-2 focus:ring-emerald-500"
                    />
                    {/* CA% input */}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] font-bold text-amber-600">CA%</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={(calc.targetCa || 0) === 0 ? '' : calc.targetCa}
                        onChange={(e) =>
                          updateCalculation(
                            calc.id,
                            'targetCa',
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        placeholder="0"
                        title="Cálcio alvo (%)"
                        className="w-14 px-1.5 py-1 text-xs border border-amber-300 rounded focus:ring-1 focus:ring-amber-400 bg-amber-50"
                      />
                    </div>
                    {/* S% input */}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] font-bold text-yellow-600">S%</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={(calc.targetS || 0) === 0 ? '' : calc.targetS}
                        onChange={(e) =>
                          updateCalculation(
                            calc.id,
                            'targetS',
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        placeholder="0"
                        title="Enxofre alvo (%)"
                        className="w-14 px-1.5 py-1 text-xs border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-400 bg-yellow-50"
                      />
                    </div>
                    <select
                      value={calc.category || 'all'}
                      onChange={(e) => updateCalculation(calc.id, 'category', e.target.value)}
                      className="px-2 py-1 text-xs border border-stone-300 rounded focus:ring-2 focus:ring-emerald-500 w-24"
                      title="Tipo de Fórmula"
                    >
                      <option value="all">Todas</option>
                      {compCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => openSettings(calc.id)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Configurar Produtos"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedCalc(expandedCalc === calc.id ? null : calc.id)}
                      className={`p-1.5 rounded transition-colors ${expandedCalc === calc.id ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
                      title="Fatores e Micronutrientes"
                    >
                      <CalculatorIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => calculateFormula(calc.id)}
                      className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                      title="Calcular esta fórmula"
                    >
                      <CalculatorIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeTargetFormula(calc.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Selected Macros and Micros with Min Quantity Adjustments */}
                  {[...calc.macros, ...calc.micros].filter((m) => m.selected).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-stone-100">
                      <p className="text-[10px] uppercase font-bold text-stone-500 mb-2">
                        Macros Selecionados
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[...calc.macros, ...calc.micros]
                          .filter((m) => m.selected)
                          .map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs shadow-sm"
                            >
                              <span
                                className="font-medium text-stone-700 truncate max-w-[120px]"
                                title={m.name}
                              >
                                {m.name}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                (Mín: {m.minQuantity || 0})
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={m.minQty === 0 ? '' : m.minQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (m.type === 'macro') {
                                    updateCalculation(
                                      calc.id,
                                      'macros',
                                      calc.macros.map((mac) =>
                                        mac.id === m.id ? { ...mac, minQty: val } : mac
                                      )
                                    );
                                  } else {
                                    updateCalculation(
                                      calc.id,
                                      'micros',
                                      calc.micros.map((mic) =>
                                        mic.id === m.id ? { ...mic, minQty: val } : mic
                                      )
                                    );
                                  }
                                }}
                                className="w-14 px-1 py-0.5 text-right border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                                placeholder="0"
                                title="Ajuste a quantidade mínima"
                              />
                              <span className="text-stone-500 font-medium">kg</span>
                              <button
                                onClick={() => {
                                  if (m.type === 'macro') {
                                    updateCalculation(
                                      calc.id,
                                      'macros',
                                      calc.macros.map((mac) =>
                                        mac.id === m.id ? { ...mac, selected: false } : mac
                                      )
                                    );
                                  } else {
                                    updateCalculation(
                                      calc.id,
                                      'micros',
                                      calc.micros.map((mic) =>
                                        mic.id === m.id ? { ...mic, selected: false } : mic
                                      )
                                    );
                                  }
                                }}
                                className="text-stone-400 hover:text-red-500 ml-1 transition-colors"
                                title="Remover produto da fórmula"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Gear Panel \u2014 absolute, extends right toward summary */}
                  {expandedCalc === calc.id && (
                    <div
                      className="absolute left-0 z-40 p-3 bg-white rounded-lg border border-stone-300 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-1"
                      style={{
                        top: '100%',
                        width: 'min(800px, calc(100vw - 2rem))',
                        marginTop: '4px',
                      }}
                    >
                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <div className="flex items-center gap-4">
                          <h4 className="text-xs font-bold text-stone-500 uppercase">
                            ? {calc.formula || 'Fórmula'}
                          </h4>
                          {calc.summary &&
                            (currentUser.role === 'master' ||
                              currentUser.role === 'admin' ||
                              currentUser.role === 'manager' ||
                              (currentUser.permissions as any)?.calculator_fertigranP !==
                                false) && (
                              <button
                                onClick={() => {
                                  setCurrentComparisonFormula({
                                    formulaName: calc.formula,
                                    n: calc.summary!.resultingN,
                                    p: calc.summary!.resultingP,
                                    k: calc.summary!.resultingK,
                                  });
                                  setIsFertigranPModalOpen(true);
                                }}
                                className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition-colors flex items-center"
                              >
                                Comparar com Fertigran P
                              </button>
                            )}
                        </div>
                        <button
                          onClick={() => setExpandedCalc(null)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Fatores Comerciais */}
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                          Fatores Comerciais
                        </p>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Fator (×)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={calc.factors.factor}
                              onChange={(e) =>
                                updateCalculationFactors(calc.id, 'factor', Number(e.target.value))
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Desconto (R$/t)
                            </label>
                            <input
                              type="number"
                              value={calc.factors.discount === 0 ? '' : calc.factors.discount}
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'discount',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Alíquota (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={calc.factors.taxRate === 0 ? '' : calc.factors.taxRate}
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'taxRate',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Comissão (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={calc.factors.commission === 0 ? '' : calc.factors.commission}
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'commission',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          {/* CIF / FOB toggle */}
                          <div className="col-span-2 lg:col-span-3">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Tipo de Frete
                            </label>
                            <div className="flex gap-1 mb-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCalculationFactors(calc.id, 'tipoFrete', 'CIF')
                                }
                                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${(calc.factors.tipoFrete ?? 'CIF') === 'CIF' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                              >
                                CIF
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateCalculationFactors(calc.id, 'tipoFrete', 'FOB');
                                  updateCalculationFactors(calc.id, 'freight', 0);
                                  updateCalculationFactors(calc.id, 'cotacaoFreteId', '');
                                  updateCalculationFactors(calc.id, 'cotacaoFreteNumero', '');
                                }}
                                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${(calc.factors.tipoFrete ?? 'CIF') === 'FOB' ? 'bg-stone-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                              >
                                FOB
                              </button>
                            </div>
                            {(calc.factors.tipoFrete ?? 'CIF') === 'CIF' && (
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  placeholder="R$/t"
                                  value={calc.factors.freight === 0 ? '' : calc.factors.freight}
                                  onChange={(e) => {
                                    const freightVal =
                                      e.target.value === '' ? 0 : Number(e.target.value);
                                    updateCalculationFactors(calc.id, 'freight', freightVal);
                                    updateCalculationFactors(calc.id, 'cotacaoFreteId', '');
                                    updateCalculationFactors(calc.id, 'cotacaoFreteNumero', '');
                                  }}
                                  className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  title="Buscar Cotação Aprovada"
                                  onClick={() => openCotacaoModal(calc.id)}
                                  className="p-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded border border-stone-300"
                                >
                                  <Search className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {calc.factors.cotacaoFreteNumero && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                <Truck className="w-3 h-3 shrink-0" />
                                <span className="flex-1 truncate">
                                  ✓ {calc.factors.cotacaoFreteNumero} · R${' '}
                                  {(calc.factors.freight || 0).toFixed(2)}/t
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateCalculationFactors(calc.id, 'cotacaoFreteId', '');
                                    updateCalculationFactors(calc.id, 'cotacaoFreteNumero', '');
                                    updateCalculationFactors(calc.id, 'freight', 0);
                                  }}
                                  className="text-emerald-500 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Embalagem */}
                          <div className="col-span-2 lg:col-span-3">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Embalagem
                            </label>
                            <select
                              value={calc.factors.embalagem_id || ''}
                              onChange={(e) => {
                                const emb = embalagens.find((em) => em.id === e.target.value);
                                if (emb) {
                                  const valor = emb.cobrar
                                    ? emb.valor
                                    : emb.desconto
                                      ? -emb.valor
                                      : 0;
                                  updateCalculationFactors(calc.id, 'embalagem_id', emb.id);
                                  updateCalculationFactors(calc.id, 'embalagem_nome', emb.nome);
                                  updateCalculationFactors(calc.id, 'embalagem_valor', valor);
                                } else {
                                  updateCalculationFactors(calc.id, 'embalagem_id', '');
                                  updateCalculationFactors(calc.id, 'embalagem_nome', '');
                                  updateCalculationFactors(calc.id, 'embalagem_valor', 0);
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="">— Sem embalagem —</option>
                              {embalagens.map((emb) => (
                                <option key={emb.id} value={emb.id}>
                                  {emb.nome}
                                </option>
                              ))}
                            </select>
                            {calc.factors.embalagem_nome && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-600">
                                <Package className="w-3 h-3 shrink-0" />
                                <span>
                                  {calc.factors.embalagem_nome} ·{' '}
                                  {(calc.factors.embalagem_valor || 0) >= 0
                                    ? `Cobrar +R$ ${(calc.factors.embalagem_valor || 0).toFixed(2)}/t`
                                    : `Desconto -R$ ${Math.abs(calc.factors.embalagem_valor || 0).toFixed(2)}/t`}
                                </span>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Juros Mensal (%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={
                                calc.factors.monthlyInterestRate === 0
                                  ? ''
                                  : calc.factors.monthlyInterestRate
                              }
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'monthlyInterestRate',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Qtd Total (Tons)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={calc.factors.totalTons === 0 ? '' : calc.factors.totalTons}
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'totalTons',
                                  e.target.value === '' ? 0 : Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                              Vencimento
                            </label>
                            <input
                              type="date"
                              value={calc.factors.dueDate || ''}
                              onChange={(e) =>
                                updateCalculationFactors(calc.id, 'dueDate', e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="flex items-center pt-4">
                            <input
                              type="checkbox"
                              id={`exempt-${calc.id}`}
                              checked={calc.factors.exemptCurrentMonth}
                              onChange={(e) =>
                                updateCalculationFactors(
                                  calc.id,
                                  'exemptCurrentMonth',
                                  e.target.checked
                                )
                              }
                              className="rounded text-emerald-600 focus:ring-emerald-500 mr-2"
                            />
                            <label
                              htmlFor={`exempt-${calc.id}`}
                              className="text-[10px] font-bold text-stone-500 uppercase"
                            >
                              Isentar juros mês atual
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Resultado Real */}
                      {calc.summary && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                            Resultado Real
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                              N-P-K:{' '}
                              {formatNPK(
                                calc.formula,
                                calc.summary.resultingN,
                                calc.summary.resultingP,
                                calc.summary.resultingK
                              )}
                            </span>
                            {(calc.summary.resultingCa || 0) > 0 && (
                              <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-bold">
                                CA: {calc.summary.resultingCa.toFixed(2)}%
                              </span>
                            )}
                            {(calc.summary.resultingS || 0) > 0 && (
                              <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs font-bold">
                                S: {calc.summary.resultingS.toFixed(2)}%
                              </span>
                            )}
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">
                              R$ {calc.summary.finalPrice.toFixed(2)}/t
                            </span>
                            {(() => {
                              const fmatch = calc.formula.match(
                                /(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/
                              );
                              if (!fmatch || !calc.summary) return null;
                              const tN = parseFloat(fmatch[1].replace(',', '.'));
                              const tP = parseFloat(fmatch[2].replace(',', '.'));
                              const tK = parseFloat(fmatch[3].replace(',', '.'));
                              const TOL = 0.05;
                              const deviations: string[] = [];
                              if (Math.abs(calc.summary.resultingN - tN) > TOL)
                                deviations.push(
                                  `N: ${calc.summary.resultingN.toFixed(2)} (alvo ${tN})`
                                );
                              if (Math.abs(calc.summary.resultingP - tP) > TOL)
                                deviations.push(
                                  `P: ${calc.summary.resultingP.toFixed(2)} (alvo ${tP})`
                                );
                              if (Math.abs(calc.summary.resultingK - tK) > TOL)
                                deviations.push(
                                  `K: ${calc.summary.resultingK.toFixed(2)} (alvo ${tK})`
                                );
                              if (deviations.length === 0)
                                return (
                                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold flex items-center gap-1">
                                    ✓ Garantias OK
                                  </span>
                                );
                              return (
                                <span
                                  className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-bold flex items-center gap-1"
                                  title={deviations.join(' | ')}
                                >
                                  ⚠ Desvio: {deviations.join(' | ')}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Matérias-Primas Utilizadas */}
                      {calc.summary && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                            Matérias-Primas Utilizadas
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                            {[...calc.macros, ...calc.micros]
                              .filter((m) => m.quantity > 0)
                              .map((m) => (
                                <div
                                  key={m.id}
                                  className="flex flex-col gap-0.5 text-[11px] bg-stone-50 border border-stone-100 px-2 py-1.5 rounded"
                                >
                                  <div className="flex justify-between">
                                    <span
                                      className="text-stone-700 font-bold truncate pr-1"
                                      title={m.name}
                                    >
                                      {m.name}
                                    </span>
                                    <span className="text-emerald-600 font-black shrink-0">
                                      {m.quantity.toFixed(2)} kg
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[9px] text-stone-400">
                                      R$ {m.price.toFixed(2)}/t
                                    </span>
                                    <span className="text-[10px] text-stone-600 font-semibold shrink-0">
                                      R$ {((m.quantity / 1000) * m.price).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Micro Guarantees */}
                      {calc.summary?.resultingMicros &&
                        Object.keys(calc.summary.resultingMicros).length > 0 && (
                          <div className="pt-2 border-t border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                              Garantias de Micros
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(calc.summary.resultingMicros).map(([name, val]) => (
                                <div
                                  key={name}
                                  className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                                >
                                  <span className="text-[10px] font-bold text-stone-600">
                                    {name}:
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-600">
                                    {(val as number).toFixed(3)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Quick summary bar */}
                  {calc.summary && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200">
                      <div className="text-center">
                        <p className="text-[8px] text-stone-400 uppercase font-bold">Preço Final</p>
                        <p className="text-xs font-bold text-emerald-600">
                          R$ {calc.summary.finalPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center border-x border-stone-100">
                        <p className="text-[8px] text-stone-400 uppercase font-bold">N-P-K Real</p>
                        <p className="text-xs font-bold text-indigo-600">
                          {formatNPK(
                            calc.formula,
                            calc.summary.resultingN,
                            calc.summary.resultingP,
                            calc.summary.resultingK
                          )}
                        </p>
                        {((calc.summary.resultingCa || 0) > 0 ||
                          (calc.summary.resultingS || 0) > 0) && (
                          <p className="text-[9px] text-stone-500">
                            {(calc.summary.resultingCa || 0) > 0 &&
                              `CA:${calc.summary.resultingCa.toFixed(1)}%`}
                            {(calc.summary.resultingCa || 0) > 0 &&
                              (calc.summary.resultingS || 0) > 0 &&
                              ' '}
                            {(calc.summary.resultingS || 0) > 0 &&
                              `S:${calc.summary.resultingS.toFixed(1)}%`}
                          </p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] text-stone-400 uppercase font-bold">Custo Base</p>
                        <p className="text-xs font-bold text-stone-700">
                          R$ {calc.summary.baseCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conferir Rentabilidade */}
                  {calc.summary &&
                    (currentUser.role === 'master' ||
                      currentUser.role === 'admin' ||
                      currentUser.role === 'manager' ||
                      (currentUser.permissions as any)?.calculator_profitabilityCheck) && (
                      <div className="pt-2 border-t border-stone-200">
                        <button
                          type="button"
                          onClick={() => {
                            setProfitabilityTargetCalc(calc);
                            setProfitabilityTargetIndex(calcIdx);
                            setIsProfitabilityModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-sm"
                          title="Conferir Rentabilidade"
                        >
                          <span>📊</span>
                          <span>Rentabilidade</span>
                        </button>
                      </div>
                    )}
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  onClick={addTargetFormula}
                  className="w-full py-2 border-2 border-dashed border-stone-300 rounded-lg text-stone-500 hover:border-emerald-500 hover:text-emerald-600 transition-all text-xs font-bold flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Fórmula Alvo
                </button>
              </div>
              {calculations.some((c) => c.selected) && (
                <button
                  onClick={() => calculateFormula()}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-sm flex items-center justify-center"
                >
                  <CalculatorIcon className="w-4 h-4 mr-2" /> Calcular Fórmulas Selecionadas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* O Modal de configurações substituiu as tabelas de Macros e Micros */}

        {!isSimplified && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">
              Observação Comercial (para PDF)
            </h2>
            <textarea
              value={factors.commercialObservation || ''}
              disabled={isLocked}
              onChange={(e) => handleFactorChange('commercialObservation', e.target.value)}
              className={`w-full px-3 py-2 border border-stone-300 rounded-lg h-24 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
              placeholder="Ex: Condições de pagamento especiais..."
            />
          </div>
        )}
      </div>

      {/* Summary Panel */}
      <div className="space-y-6">
        <div className="bg-stone-900 text-white p-6 rounded-xl shadow-lg sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 border-b border-stone-700 pb-4">
            Resumo das Fórmulas
          </h2>

          <div className="space-y-6">
            {calculations
              .filter((c) => c.summary)
              .map((calc) => (
                <div
                  key={calc.id}
                  className="p-4 bg-stone-800 rounded-xl border border-stone-700 space-y-4"
                >
                  <div className="flex justify-between items-center border-b border-stone-700 pb-2">
                    <span className="text-emerald-400 font-bold">{calc.formula}</span>
                    <span className="text-xs text-stone-500">#{calc.id.slice(-4)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-stone-500 uppercase font-bold">Preço Final</p>
                      <p className="text-lg font-bold text-white">
                        R$ {calc.summary?.finalPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-stone-500 uppercase font-bold">N-P-K Real</p>
                      <p className="text-sm font-mono text-emerald-400">
                        {formatNPK(
                          calc.formula,
                          calc.summary?.resultingN || 0,
                          calc.summary?.resultingP || 0,
                          calc.summary?.resultingK || 0
                        )}
                      </p>
                      {(calc.summary?.resultingCa || 0) > 0 && (
                        <p className="text-[10px] font-mono text-amber-400 mt-1">
                          CA: {calc.summary!.resultingCa.toFixed(2)}%
                        </p>
                      )}
                      {(calc.summary?.resultingS || 0) > 0 && (
                        <p className="text-[10px] font-mono text-yellow-500">
                          S: {calc.summary!.resultingS.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-700 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-stone-500">Custo Base:</span>
                      <span className="text-stone-300">R$ {calc.summary?.baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-stone-500">Venda Total:</span>
                      <span className="text-stone-300">
                        R${' '}
                        {calc.summary?.totalSaleValue.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Materials List in Summary */}
                  <div className="pt-2 border-t border-stone-700">
                    <p className="text-[9px] text-stone-500 uppercase font-bold mb-1">
                      Composição (kg)
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {[...calc.macros, ...calc.micros]
                        .filter((m) => m.quantity > 0)
                        .map((m) => (
                          <div key={m.id} className="flex justify-between text-[9px]">
                            <span className="text-stone-400 truncate pr-1">{m.name}</span>
                            <span className="text-emerald-500 font-mono">
                              {m.quantity.toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))}

            {calculations.filter((c) => c.summary).length === 0 && (
              <div className="py-8 text-center text-stone-500 italic text-sm">
                Nenhum cálculo realizado ainda.
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-stone-700">
            {!isSimplified &&
              (currentUser.role === 'master' ||
                currentUser.role === 'admin' ||
                currentUser.role === 'manager' ||
                (currentUser.permissions as any)?.calculator_savePricing !== false) && (
                <button
                  onClick={savePricing}
                  disabled={isLocked}
                  className={`w-full py-4 rounded-xl flex items-center justify-center font-bold text-lg transition-colors 
                  ${isLocked ? 'bg-stone-500 text-stone-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-400 shadow-xl shadow-emerald-500/20'}`}
                >
                  <Save className="w-5 h-5 mr-3" />
                  {initialData ? 'Atualizar Precificação' : 'Criar Nova Precificação'}
                </button>
              )}
            {(currentUser.role === 'master' ||
              currentUser.role === 'admin' ||
              currentUser.role === 'manager' ||
              (currentUser.permissions as any)?.calculator_saveFormula !== false) && (
              <button
                onClick={saveToFormulasList}
                disabled={isLocked}
                className={`mt-4 w-full py-3 rounded-xl flex items-center justify-center font-bold text-sm transition-colors 
                  ${isLocked ? 'hidden' : 'bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 shadow-lg shadow-black/20'}`}
              >
                <Beaker className="w-4 h-4 mr-2" />
                Salvar Fórmula/Batida
              </button>
            )}
          </div>
        </div>
      </div>

      {currentComparisonFormula && (
        <FertigranPComparisonModal
          isOpen={isFertigranPModalOpen}
          onClose={() => setIsFertigranPModalOpen(false)}
          originalFormulaName={currentComparisonFormula.formulaName}
          originalN={currentComparisonFormula.n}
          originalP={currentComparisonFormula.p}
          originalK={currentComparisonFormula.k}
          currentUser={currentUser}
          macros={macros}
          micros={micros}
          onApplyFertigranP={(newFormula) => {
            setCalculations([
              ...calculations,
              {
                ...newFormula,
                id: `f_${Date.now()}`,
              },
            ]);
            showSuccess('Receita Fertigran adicionada na Precificação!');
          }}
        />
      )}
      <CalculatorSettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        formula={calculations.find((c) => c.id === activeFormulaId) || null}
        globalMacros={macros}
        globalMicros={micros}
        onConfirm={(updatedFormula) => {
          setCalculations(
            calculations.map((c) => (c.id === updatedFormula.id ? updatedFormula : c))
          );
        }}
      />

      {isProfitabilityModalOpen && profitabilityTargetCalc && (
        <ProfitabilityModal
          isOpen={isProfitabilityModalOpen}
          onClose={() => setIsProfitabilityModalOpen(false)}
          calc={profitabilityTargetCalc}
          calcIndex={profitabilityTargetIndex}
          pricingRecordId={savedPricingId}
          currentUser={currentUser}
          onSaved={() => {
            setIsProfitabilityModalOpen(false);
          }}
        />
      )}

      {/* Custom dialogs replacing native alert/confirm/prompt */}
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <PromptDialog
        isOpen={promptState.isOpen}
        title="Salvar Batida"
        message="Dê um nome para esta Batida Salva:"
        defaultValue={promptState.defaultValue}
        confirmLabel="Salvar"
        onConfirm={promptState.onConfirm}
        onCancel={() => setPromptState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Modal: Buscar Cotação Aprovada */}
      {showCotacaoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-emerald-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Buscar Cotação de Frete Aprovada
              </h2>
              <button
                onClick={() => setShowCotacaoModal(false)}
                className="p-1 hover:bg-white/20 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cotacaoLoading ? (
                <p className="text-center text-stone-400 py-8">Carregando cotações...</p>
              ) : cotacoesAprovadas.length === 0 ? (
                <p className="text-center text-stone-400 italic py-8">
                  Nenhuma cotação aprovada encontrada.
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs border-b">
                    <tr>
                      <th className="px-3 py-2">Nº</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Transportadora</th>
                      <th className="px-3 py-2 text-right">R$/ton</th>
                      <th className="px-3 py-2 text-right">Prazo</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cotacoesAprovadas.map((cot) => (
                      <tr key={cot.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2 font-mono text-xs text-emerald-700 font-bold">
                          {cot.numero_cotacao}
                        </td>
                        <td className="px-3 py-2 text-stone-700">{cot.cliente_nome || '—'}</td>
                        <td className="px-3 py-2 text-stone-600">
                          {cot.transportadora_nome || cot.transportadora?.nome || '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-stone-800">
                          R$ {(cot.valor_frete_unitario || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-stone-500">
                          {cot.prazo_entrega_dias != null ? `${cot.prazo_entrega_dias}d` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              if (cotacaoModalCalcId) {
                                updateCalculationFactors(
                                  cotacaoModalCalcId,
                                  'freight',
                                  cot.valor_frete_unitario || 0
                                );
                                updateCalculationFactors(
                                  cotacaoModalCalcId,
                                  'cotacaoFreteId',
                                  cot.id
                                );
                                updateCalculationFactors(
                                  cotacaoModalCalcId,
                                  'cotacaoFreteNumero',
                                  cot.numero_cotacao
                                );
                                updateCalculationFactors(cotacaoModalCalcId, 'tipoFrete', 'CIF');
                              }
                              setShowCotacaoModal(false);
                            }}
                            className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700"
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
