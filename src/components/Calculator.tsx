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
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronDown,
  UserRound,
  Layers3,
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
import { getCalculationMode } from '../utils/calculationMode';
import { getCotacoesAprovadasByCliente } from '../services/cotacaoSolicitadaService';
import { CotacaoSolicitada } from '../types/carregamento';
import { getEmbalagens } from '../services/embalagensService';
import { getSavedFormulas } from '../services/db';
import { getProdutosFormulados, ProdutoFormulado } from '../services/produtosFormuladosService';

const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr || !days) return '';
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

interface CalculatorProps {
  initialData?: PricingRecord | null;
  initialFormulaToLoad?: SavedFormula | null;
  initialBranchId?: string;
  initialLoadingLocationId?: string;
  initialPriceListId?: string;
  onClearEditing?: () => void;
  onSaveSuccess?: (record: PricingRecord) => void;
  onSavedFormulaSuccess?: () => void;
  currentUser: AppUser;
  isSimplified?: boolean;
  disableConditions?: boolean;
}

export default function Calculator({
  initialData,
  initialFormulaToLoad,
  initialBranchId,
  initialLoadingLocationId,
  initialPriceListId,
  onClearEditing,
  onSaveSuccess,
  onSavedFormulaSuccess,
  currentUser,
  isSimplified,
  disableConditions = false,
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
    locaisCarregamento,
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
    isMaterialsLoading,
    hasNoMaterialsInDatabase,
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
    setCalculationMode,
    addProdutoLivreToCalculation,
    updateProdutoLivreQuantity,
    removeProdutoLivreFromCalculation,
    updateCalculationFactors,
    savePricing,
    saveToFormulasList,
  } = useCalculator({
    initialData,
    initialFormulaToLoad,
    initialBranchId,
    initialLoadingLocationId,
    initialPriceListId,
    onClearEditing,
    onSaveSuccess,
    onSavedFormulaSuccess,
    currentUser,
  });

  // ─── Clear editing state on unmount so Calculator always starts fresh ──────
  useEffect(() => {
    return () => {
      onClearEditing?.();
    };
  }, [onClearEditing]);

  // ─── Quote search modal state ────────────────────────────────
  const [showCotacaoModal, setShowCotacaoModal] = useState(false);
  const [cotacaoModalCalcId, setCotacaoModalCalcId] = useState<string | null>(null);
  const [cotacoesAprovadas, setCotacoesAprovadas] = useState<CotacaoSolicitada[]>([]);
  const [cotacaoLoading, setCotacaoLoading] = useState(false);

  // ─── Embalagem state ─────────────────────────────────────────
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [formulaProductSearch, setFormulaProductSearch] = useState<Record<string, string>>({});
  const [activeProductSearchCalcId, setActiveProductSearchCalcId] = useState<string | null>(null);

  // ─── Produtos Formulados e Batidas Salvas Autocomplete state ───
  const [produtosFormulados, setProdutosFormulados] = useState<ProdutoFormulado[]>([]);
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>([]);
  const [activeSearchCalcId, setActiveSearchCalcId] = useState<string | null>(null);
  const [formulaSearchTerm, setFormulaSearchTerm] = useState<Record<string, string>>({});
  const protectedMaterialIds = initialFormulaToLoad?.protectedMaterialIds || [];
  const isSavedFormulaRevision = initialFormulaToLoad?.isRevisionFromSavedFormula === true;

  useEffect(() => {
    getEmbalagens(true)
      .then(setEmbalagens)
      .catch(() => {});
  }, []);

  useEffect(() => {
    getProdutosFormulados()
      .then(setProdutosFormulados)
      .catch(() => {});
    getSavedFormulas()
      .then(setSavedFormulas)
      .catch(() => {});
  }, []);

  const openCotacaoModal = async (calcId: string) => {
    setCotacaoModalCalcId(calcId);
    setShowCotacaoModal(true);
    setCotacaoLoading(true);
    try {
      const clienteId = factors.client?.id || undefined;
      const data = await getCotacoesAprovadasByCliente(currentUser.id, clienteId);
      setCotacoesAprovadas(data);
    } catch {
      setCotacoesAprovadas([]);
    } finally {
      setCotacaoLoading(false);
    }
  };

  const getAvailableProductsForCalc = (calc: (typeof calculations)[number]) =>
    [
      ...(calc.macros.length > 0 ? calc.macros : macros),
      ...(calc.micros.length > 0 ? calc.micros : micros),
    ]
      .filter((material) => material.name)
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

  const formatFormulaProductDetails = (
    product?: ReturnType<typeof getAvailableProductsForCalc>[number] | null
  ) => {
    if (!product) return '—';

    if (product.type === 'macro') {
      return `${Number(product.n || 0)}-${Number(product.p || 0)}-${Number(product.k || 0)}`;
    }

    const guarantees = (product.microGuarantees || [])
      .filter((guarantee) => Number(guarantee.value) > 0)
      .map((guarantee) => `${guarantee.name} ${Number(guarantee.value).toFixed(2)}%`);

    return guarantees.length > 0 ? guarantees.join(' + ') : 'Garantias indisponíveis';
  };

  const shouldShowProductDropdown = (calcId: string, searchTerm: string) =>
    activeProductSearchCalcId === calcId && searchTerm.trim().length > 0;

  const canSavePricing =
    !isSimplified &&
    (currentUser.role === 'master' ||
      currentUser.role === 'admin' ||
      currentUser.role === 'manager' ||
      (currentUser.permissions as any)?.calculator_savePricing !== false);

  const pendingIssues = [
    !isSimplified && !factors.client?.id ? 'Selecione o cliente' : '',
    !factors.branchId ? 'Informe a filial' : '',
    !factors.priceListId ? 'Selecione a lista de preço' : '',
    calculations.length === 0 ? 'Adicione ao menos uma fórmula' : '',
    calculations.some((calc) => calc.selected && Number(calc.factors?.totalTons) <= 0)
      ? 'Informe as toneladas das fórmulas selecionadas'
      : '',
    calculations.some(
      (calc) => calc.selected && Number(calc.factors?.commission) > 0 && !factors.agent?.id
    )
      ? 'Selecione um agente para usar comissão'
      : '',
  ].filter(Boolean);

  const duplicateCalculation = (calc: (typeof calculations)[number]) => {
    setCalculations([
      ...calculations,
      {
        ...calc,
        id: `f_${Date.now()}`,
        formula: calc.formula,
        selected: true,
        summary: undefined,
        profitabilityAnalysis: undefined,
        macros: calc.macros.map((material) => ({ ...material, quantity: 0 })),
        micros: calc.micros.map((material) => ({ ...material, quantity: 0 })),
        produtos_livres: calc.produtos_livres?.map((product) => ({ ...product })),
        factors: { ...calc.factors },
      },
    ]);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 pb-44 sm:gap-6 sm:pb-32 lg:grid-cols-3">
      <>
        <nav
          className="sticky top-2 z-30 min-w-0 rounded-xl border border-stone-200 bg-white/95 px-2 py-2 shadow-md backdrop-blur lg:col-span-3 sm:px-3"
          aria-label="Atalhos da calculadora"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 snap-x items-center gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <a
                href="#dados-comerciais"
                className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 hover:text-emerald-700"
              >
                <UserRound className="h-4 w-4" /> Dados comerciais
              </a>
              <a
                href="#formulas-calculo"
                className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 hover:text-emerald-700"
              >
                <Layers3 className="h-4 w-4" /> Produtos e fórmulas
              </a>
              <a
                href="#resumo-calculo"
                className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 hover:text-emerald-700"
              >
                <CalculatorIcon className="h-4 w-4" /> Resultado
              </a>
            </div>
            <div
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold sm:px-3 ${pendingIssues.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
            >
              {pendingIssues.length === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {pendingIssues.length === 0
                  ? 'Pronta para salvar'
                  : `${pendingIssues.length} pendência(s)`}
              </span>
              <span className="sm:hidden" aria-label={`${pendingIssues.length} pendências`}>
                {pendingIssues.length}
              </span>
            </div>
          </div>
        </nav>
        {isSavedFormulaRevision && (
          <div className="lg:col-span-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-bold">Revisão de batida salva</p>
            <p>
              A fórmula e os micronutrientes estão protegidos. Ajuste somente as matérias-primas
              permitidas e recalcule antes de gerar o relatório de preços.
            </p>
          </div>
        )}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <div
            id="dados-comerciais"
            className="scroll-mt-24 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-stone-200"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-stone-800">Informações Gerais</h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
                <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
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
                          <p className="text-sm font-bold text-emerald-800">
                            {factors.client.name}
                          </p>
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
                            calculations.forEach((calculation) => {
                              if (Number(calculation.factors?.commission) !== 0) {
                                updateCalculationFactors(calculation.id, 'commission', 0);
                              }
                            });
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-stone-100">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                  <Building2 className="w-4 h-4 mr-1" /> Filial
                </label>
                <select
                  value={factors.branchId}
                  onChange={(e) => {
                    setFactors({
                      ...factors,
                      branchId: e.target.value,
                    });
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
                  <MapPin className="w-4 h-4 mr-1" /> Local de Carregamento
                </label>
                <select
                  value={factors.local_carregamento_id || ''}
                  onChange={(e) => {
                    const localId = e.target.value;
                    const matchingList = priceLists.find(
                      (l) => l.local_carregamento_id === localId
                    );
                    setFactors({
                      ...factors,
                      local_carregamento_id: localId || undefined,
                      priceListId: matchingList ? matchingList.id : factors.priceListId,
                    });
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Selecione o local (opcional) —</option>
                  {locaisCarregamento.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                      {l.cidade ? ` — ${l.cidade}${l.estado ? `/${l.estado}` : ''}` : ''}
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
                >
                  <option value="">Selecione uma lista</option>
                  {(factors.local_carregamento_id
                    ? priceLists.filter(
                        (l) => l.local_carregamento_id === factors.local_carregamento_id
                      )
                    : priceLists
                  ).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* F\u00f3rmulas Alvo \u2014 full-width below status */}
            <div id="formulas-calculo" className="scroll-mt-24 mt-6 pt-5 border-t border-stone-100">
              {isMaterialsLoading && (
                <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600">
                  Carregando matérias-primas cadastradas...
                </div>
              )}
              {!isMaterialsLoading && hasNoMaterialsInDatabase && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  Nenhuma matéria-prima cadastrada. Acesse o cadastro de produtos para adicionar.
                </div>
              )}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-stone-800">Produtos e fórmulas</h3>
                  <p className="text-xs text-stone-500">
                    Configure, calcule e acompanhe cada fórmula separadamente.
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                  {calculations.length} fórmula(s)
                </span>
              </div>
              <div className="space-y-4">
                {calculations.map((calc, calcIdx) => (
                  <div
                    key={calc.id}
                    className={`relative overflow-visible rounded-xl border bg-white p-3 shadow-sm transition ${calc.selected ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-stone-200 opacity-80'}`}
                  >
                    {(() => {
                      const calcMode = getCalculationMode(calc);
                      const isProdutosLivresMode = calcMode === 'produtos_livres';
                      const availableFormulaProducts = getAvailableProductsForCalc(calc);
                      const selectedProdutosLivres = (calc.produtos_livres || [])
                        .map((item) => ({
                          ...item,
                          product: availableFormulaProducts.find(
                            (product) => product.id === item.productId
                          ),
                        }))
                        .filter((item) => item.product);

                      return (
                        <>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={calc.selected}
                                onChange={(e) =>
                                  updateCalculation(calc.id, 'selected', e.target.checked)
                                }
                                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                aria-label={`Selecionar fórmula ${calcIdx + 1}`}
                              />
                              <div>
                                <p className="text-sm font-black text-stone-800">
                                  Fórmula {calcIdx + 1}
                                </p>
                                <p
                                  className={`text-[11px] font-bold ${calc.summary ? 'text-emerald-600' : calc.formula && Number(calc.factors?.totalTons) > 0 ? 'text-blue-600' : 'text-amber-600'}`}
                                >
                                  {calc.summary
                                    ? 'Calculada'
                                    : calc.formula && Number(calc.factors?.totalTons) > 0
                                      ? 'Pronta para calcular'
                                      : 'Configuração incompleta'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCalculationMode(calc.id, 'formulacao')}
                                className={`px-2 py-1 rounded-full text-xs font-bold transition-colors ${
                                  calcMode === 'formulacao'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                              >
                                Formulação NPK
                              </button>
                              <button
                                type="button"
                                onClick={() => setCalculationMode(calc.id, 'produtos_livres')}
                                disabled={isSavedFormulaRevision}
                                className={`px-2 py-1 rounded-full text-xs font-bold transition-colors ${
                                  isProdutosLivresMode
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                              >
                                Produtos Livres
                              </button>
                            </div>
                          </div>

                          {/* Main row: checkbox + formula + CA/S + type + gear + calc + delete */}
                          <div className="flex flex-wrap items-end gap-2">
                            {/* Formula input with autocomplete */}
                            <div className="relative flex-1 min-w-[150px]">
                              <input
                                type="text"
                                value={calc.formula}
                                onChange={(e) => {
                                  updateCalculation(calc.id, 'formula', e.target.value);
                                  setFormulaSearchTerm((prev) => ({
                                    ...prev,
                                    [calc.id]: e.target.value,
                                  }));
                                  setActiveSearchCalcId(calc.id);
                                }}
                                onFocus={() => {
                                  setActiveSearchCalcId(calc.id);
                                  setFormulaSearchTerm((prev) => ({
                                    ...prev,
                                    [calc.id]: calc.formula,
                                  }));
                                }}
                                onBlur={() => {
                                  // small timeout to allow clicking options before closing
                                  setTimeout(() => {
                                    setActiveSearchCalcId((prev) =>
                                      prev === calc.id ? null : prev
                                    );
                                  }, 250);
                                }}
                                placeholder="Ex: 04-14-08 (opcional)"
                                disabled={isProdutosLivresMode || isSavedFormulaRevision}
                                className={`w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-emerald-500 ${
                                  isProdutosLivresMode
                                    ? 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                                    : 'border-stone-300'
                                }`}
                              />
                              {!isProdutosLivresMode &&
                                !isSavedFormulaRevision &&
                                activeSearchCalcId === calc.id &&
                                (formulaSearchTerm[calc.id] || '').trim() && (
                                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[220px]">
                                    {(() => {
                                      const term = (formulaSearchTerm[calc.id] || '')
                                        .toLowerCase()
                                        .trim();
                                      const filteredProds = produtosFormulados.filter(
                                        (p) =>
                                          p.ativo &&
                                          (p.nome.toLowerCase().includes(term) ||
                                            (p.formula_npk || '').toLowerCase().includes(term))
                                      );
                                      if (filteredProds.length === 0) {
                                        return (
                                          <p className="p-2 text-xs text-stone-400">
                                            Nenhum produto/batida encontrado
                                          </p>
                                        );
                                      }
                                      return filteredProds.map((prod) => (
                                        <button
                                          key={prod.id}
                                          type="button"
                                          onClick={() => {
                                            const formulaName = prod.formula_npk || prod.nome;
                                            updateCalculation(calc.id, 'formula', formulaName);

                                            if (prod.saved_formula_id) {
                                              const savedF = savedFormulas.find(
                                                (sf) => sf.id === prod.saved_formula_id
                                              );
                                              if (savedF) {
                                                // Restore the saved composition while retaining
                                                // current material prices and nutrient metadata.
                                                const updatedMacros = calc.macros.map((m) => {
                                                  const savedM = savedF.macros.find(
                                                    (sm) => sm.id === m.id || sm.name === m.name
                                                  );
                                                  return {
                                                    ...m,
                                                    ...savedM,
                                                    id: m.id,
                                                    name: m.name,
                                                    selected: savedM ? !!savedM.selected : false,
                                                    minQty: savedM ? Number(savedM.minQty || 0) : 0,
                                                    quantity: savedM
                                                      ? Number(savedM.quantity || 0)
                                                      : 0,
                                                    price: m.price,
                                                  };
                                                });
                                                // Map micros
                                                const updatedMicros = calc.micros.map((m) => {
                                                  const savedM = savedF.micros.find(
                                                    (sm) => sm.id === m.id || sm.name === m.name
                                                  );
                                                  return {
                                                    ...m,
                                                    ...savedM,
                                                    id: m.id,
                                                    name: m.name,
                                                    selected: savedM ? !!savedM.selected : false,
                                                    minQty: savedM ? Number(savedM.minQty || 0) : 0,
                                                    quantity: savedM
                                                      ? Number(savedM.quantity || 0)
                                                      : 0,
                                                    price: m.price,
                                                  };
                                                });
                                                setCalculations((prev) =>
                                                  prev.map((c) =>
                                                    c.id === calc.id
                                                      ? {
                                                          ...c,
                                                          savedFormulaId: savedF.id,
                                                          formula: formulaName,
                                                          category: savedF.category ?? 'all',
                                                          targetCa: savedF.targetCa,
                                                          targetS: savedF.targetS,
                                                          macros: updatedMacros,
                                                          micros: updatedMicros,
                                                        }
                                                      : c
                                                  )
                                                );
                                              }
                                            }
                                            setActiveSearchCalcId(null);
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0 text-xs flex flex-col"
                                        >
                                          <span className="font-bold text-stone-800">
                                            {prod.nome}
                                          </span>
                                          <span className="text-[10px] text-emerald-600">
                                            Fórmula: {prod.formula_npk || 'Não especificada'}
                                          </span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                )}
                            </div>
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
                              onChange={(e) =>
                                updateCalculation(calc.id, 'category', e.target.value)
                              }
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
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                              title="Configurar Produtos"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Produtos</span>
                            </button>
                            <button
                              type="button"
                              disabled={disableConditions}
                              onClick={() => {
                                if (!disableConditions) {
                                  setExpandedCalc(expandedCalc === calc.id ? null : calc.id);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400 ${expandedCalc === calc.id ? 'border-indigo-300 bg-indigo-100 text-indigo-800' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                              title={
                                disableConditions
                                  ? 'Defina as condições ao gerar o relatório de preços.'
                                  : 'Fatores e Micronutrientes'
                              }
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${expandedCalc === calc.id ? 'rotate-180' : ''}`}
                              />
                              <span className="hidden xl:inline">Condições</span>
                            </button>
                            <button
                              onClick={() => calculateFormula(calc.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                              title="Calcular esta fórmula"
                            >
                              <CalculatorIcon className="w-3.5 h-3.5" />
                              <span>Calcular</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateCalculation(calc)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100"
                              title="Duplicar fórmula"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Duplicar</span>
                            </button>
                            <button
                              onClick={() => removeTargetFormula(calc.id)}
                              className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50"
                              aria-label={`Remover fórmula ${calcIdx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isProdutosLivresMode && (
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-stone-400 uppercase">
                                Produtos Livres
                              </label>
                              <div className="relative">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                                  <input
                                    type="text"
                                    value={formulaProductSearch[calc.id] || ''}
                                    onChange={(e) => {
                                      setFormulaProductSearch((prev) => ({
                                        ...prev,
                                        [calc.id]: e.target.value,
                                      }));
                                      setActiveProductSearchCalcId(calc.id);
                                    }}
                                    onFocus={() => setActiveProductSearchCalcId(calc.id)}
                                    placeholder="Pesquisar macro ou micro para adicionar..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                  />
                                </div>

                                {(() => {
                                  const productSearchTerm = (
                                    formulaProductSearch[calc.id] || ''
                                  ).trim();
                                  const selectedIds = new Set(
                                    (calc.produtos_livres || []).map((item) => item.productId)
                                  );
                                  const filteredProducts = availableFormulaProducts.filter(
                                    (product) =>
                                      product.name
                                        .toLowerCase()
                                        .includes(productSearchTerm.toLowerCase()) &&
                                      !selectedIds.has(product.id)
                                  );

                                  if (!shouldShowProductDropdown(calc.id, productSearchTerm)) {
                                    return null;
                                  }

                                  return (
                                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-xl max-h-56 overflow-y-auto">
                                      {filteredProducts.length > 0 ? (
                                        filteredProducts.map((product) => (
                                          <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => {
                                              addProdutoLivreToCalculation(calc.id, product.id);
                                              setFormulaProductSearch((prev) => ({
                                                ...prev,
                                                [calc.id]: '',
                                              }));
                                              setActiveProductSearchCalcId(null);
                                            }}
                                            className="w-full px-4 py-2 text-left hover:bg-stone-50 border-b border-stone-100 last:border-b-0"
                                          >
                                            <p className="text-sm font-bold text-stone-800">
                                              {product.name}
                                            </p>
                                            <p className="text-[10px] text-stone-500">
                                              {product.type === 'macro' ? 'Macro' : 'Micro'} ·{' '}
                                              {formatFormulaProductDetails(product)}
                                            </p>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-4 py-3 text-xs text-stone-500">
                                          Nenhum macro ou micro encontrado.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {availableFormulaProducts.length === 0 && (
                                <p className="text-[11px] text-stone-500">
                                  Selecione uma lista de preço com produtos cadastrados para
                                  pesquisar.
                                </p>
                              )}

                              {selectedProdutosLivres.length > 0 && (
                                <div className="space-y-2">
                                  {selectedProdutosLivres.map(
                                    ({ productId, quantity, product }) => (
                                      <div
                                        key={productId}
                                        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-emerald-700 truncate">
                                            {product?.name}
                                          </p>
                                          <p className="text-[11px] text-emerald-800">
                                            {product?.type === 'macro' ? 'NPK' : 'Garantias'} ·{' '}
                                            {formatFormulaProductDetails(product)}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0"
                                            value={quantity === 0 ? '' : quantity}
                                            onChange={(e) =>
                                              updateProdutoLivreQuantity(
                                                calc.id,
                                                productId,
                                                e.target.value === '' ? 0 : Number(e.target.value)
                                              )
                                            }
                                            className="w-24 px-2 py-1 text-sm border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-500"
                                            placeholder="kg"
                                          />
                                          <span className="text-xs font-bold text-emerald-700">
                                            kg
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeProdutoLivreFromCalculation(calc.id, productId)
                                          }
                                          className="text-emerald-500 hover:text-emerald-700"
                                          aria-label={`Remover produto ${product?.name || productId}`}
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Selected Macros and Micros with Min Quantity Adjustments */}
                    {getCalculationMode(calc) !== 'produtos_livres' &&
                      [...calc.macros, ...calc.micros].filter((m) => m.selected).length > 0 && (
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
                                    disabled={protectedMaterialIds.includes(m.id)}
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
                                    disabled={protectedMaterialIds.includes(m.id)}
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
                      <div className="mt-4 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 shadow-inner animate-in fade-in slide-in-from-top-1 md:p-4">
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
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                Fator (×)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={calc.factors.factor}
                                onChange={(e) =>
                                  updateCalculationFactors(
                                    calc.id,
                                    'factor',
                                    Number(e.target.value)
                                  )
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
                                min="0"
                                disabled={!factors.agent?.id}
                                value={calc.factors.commission === 0 ? '' : calc.factors.commission}
                                onChange={(e) =>
                                  updateCalculationFactors(
                                    calc.id,
                                    'commission',
                                    e.target.value === '' ? 0 : Number(e.target.value)
                                  )
                                }
                                className={`w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500 ${!factors.agent?.id ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : ''}`}
                              />
                              {!factors.agent?.id && (
                                <p className="mt-1 text-[10px] font-medium text-amber-600">
                                  Selecione um agente para liberar a comissão.
                                </p>
                              )}
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
                                    updateCalculationFactors(calc.id, 'cotacaoFreteId', '');
                                    updateCalculationFactors(calc.id, 'cotacaoFreteNumero', '');
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${(calc.factors.tipoFrete ?? 'CIF') === 'FOB' ? 'bg-stone-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                                >
                                  FOB
                                </button>
                              </div>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  placeholder={
                                    calc.factors.cotacaoFreteNumero
                                      ? `🔗 ${calc.factors.cotacaoFreteNumero} — editável`
                                      : 'R$/ton — digite ou vincule cotação'
                                  }
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
                              {(() => {
                                const embSelecionada = embalagens.find(
                                  (em) => em.id === calc.factors.embalagem_id
                                );
                                const podeCobrar = embSelecionada?.cobrar ?? false;
                                const podeDescontar =
                                  embSelecionada?.descontar ?? embSelecionada?.desconto ?? false;
                                const mostrarAjuste =
                                  !!embSelecionada && (podeCobrar || podeDescontar);
                                const ajusteAtual =
                                  calc.factors.embalagem_ajuste ||
                                  ((calc.factors.embalagem_valor || 0) > 0
                                    ? 'cobrar'
                                    : (calc.factors.embalagem_valor || 0) < 0
                                      ? 'descontar'
                                      : 'nenhum');

                                const obterValorAjuste = (
                                  emb: Embalagem,
                                  ajuste: 'nenhum' | 'cobrar' | 'descontar'
                                ) => {
                                  if (ajuste === 'cobrar' && emb.cobrar) {
                                    return Number(emb.valor_cobrar ?? emb.valor ?? 0);
                                  }
                                  if (ajuste === 'descontar' && (emb.descontar ?? emb.desconto)) {
                                    return -Number(emb.valor_descontar ?? emb.valor ?? 0);
                                  }
                                  return 0;
                                };

                                return (
                                  <>
                                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                      Embalagem
                                    </label>
                                    <select
                                      value={calc.factors.embalagem_id || ''}
                                      onChange={(e) => {
                                        const emb = embalagens.find(
                                          (em) => em.id === e.target.value
                                        );
                                        if (emb) {
                                          updateCalculationFactors(calc.id, 'embalagem_id', emb.id);
                                          updateCalculationFactors(
                                            calc.id,
                                            'embalagem_nome',
                                            emb.nome
                                          );
                                          updateCalculationFactors(
                                            calc.id,
                                            'embalagem_ajuste',
                                            'nenhum'
                                          );
                                          updateCalculationFactors(calc.id, 'embalagem_valor', 0);
                                        } else {
                                          updateCalculationFactors(calc.id, 'embalagem_id', '');
                                          updateCalculationFactors(calc.id, 'embalagem_nome', '');
                                          updateCalculationFactors(
                                            calc.id,
                                            'embalagem_ajuste',
                                            'nenhum'
                                          );
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

                                    {mostrarAjuste && embSelecionada && (
                                      <div className="mt-2">
                                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                          Aplicar ajuste de embalagem?
                                        </label>
                                        <select
                                          value={ajusteAtual}
                                          onChange={(e) => {
                                            const ajuste = e.target.value as
                                              | 'nenhum'
                                              | 'cobrar'
                                              | 'descontar';
                                            updateCalculationFactors(
                                              calc.id,
                                              'embalagem_ajuste',
                                              ajuste
                                            );
                                            updateCalculationFactors(
                                              calc.id,
                                              'embalagem_valor',
                                              obterValorAjuste(embSelecionada, ajuste)
                                            );
                                          }}
                                          className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500"
                                        >
                                          <option value="nenhum">Nenhum</option>
                                          <option value="cobrar" disabled={!podeCobrar}>
                                            Cobrar
                                          </option>
                                          <option value="descontar" disabled={!podeDescontar}>
                                            Descontar
                                          </option>
                                        </select>
                                      </div>
                                    )}

                                    {calc.factors.embalagem_nome && (
                                      <div className="flex items-center gap-1 mt-1 text-[10px] text-stone-600">
                                        <Package className="w-3 h-3 shrink-0" />
                                        <span>
                                          {calc.factors.embalagem_nome} ·{' '}
                                          {ajusteAtual === 'nenhum'
                                            ? 'Sem ajuste'
                                            : (calc.factors.embalagem_valor || 0) >= 0
                                              ? `Cobrar +R$ ${(calc.factors.embalagem_valor || 0).toFixed(2)}/t`
                                              : `Descontar -R$ ${Math.abs(calc.factors.embalagem_valor || 0).toFixed(2)}/t`}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
                            {/* Payment Condition & Due Date */}
                            <div className="col-span-2 lg:col-span-3">
                              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                Condição de Pagamento
                              </label>
                              <div className="flex gap-4 mb-2">
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-stone-700">
                                  <input
                                    type="radio"
                                    name={`pay-cond-${calc.id}`}
                                    value="vencimento"
                                    checked={
                                      (calc.factors.paymentCondition || 'vencimento') ===
                                      'vencimento'
                                    }
                                    onChange={() => {
                                      updateCalculationFactors(
                                        calc.id,
                                        'paymentCondition',
                                        'vencimento'
                                      );
                                    }}
                                    className="accent-emerald-600"
                                  />
                                  Vencimento Direto
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-stone-700">
                                  <input
                                    type="radio"
                                    name={`pay-cond-${calc.id}`}
                                    value="ddf"
                                    checked={calc.factors.paymentCondition === 'ddf'}
                                    onChange={() => {
                                      updateCalculationFactors(calc.id, 'paymentCondition', 'ddf');
                                      const defaultCarregamento =
                                        calc.factors.dataCarregamento ||
                                        new Date().toISOString().split('T')[0];
                                      const defaultDias = calc.factors.ddfDias || 30;
                                      const calculated = addDaysToDate(
                                        defaultCarregamento,
                                        defaultDias
                                      );
                                      updateCalculationFactors(
                                        calc.id,
                                        'dataCarregamento',
                                        defaultCarregamento
                                      );
                                      updateCalculationFactors(calc.id, 'ddfDias', defaultDias);
                                      updateCalculationFactors(calc.id, 'dueDate', calculated);
                                    }}
                                    className="accent-emerald-600"
                                  />
                                  DDF (Dias Pós Carregamento)
                                </label>
                              </div>

                              {(calc.factors.paymentCondition || 'vencimento') === 'vencimento' ? (
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
                                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                  />
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                      Data Carregamento
                                    </label>
                                    <input
                                      type="date"
                                      value={calc.factors.dataCarregamento || ''}
                                      onChange={(e) => {
                                        const dateVal = e.target.value;
                                        const days = calc.factors.ddfDias || 0;
                                        updateCalculationFactors(
                                          calc.id,
                                          'dataCarregamento',
                                          dateVal
                                        );
                                        updateCalculationFactors(
                                          calc.id,
                                          'dueDate',
                                          addDaysToDate(dateVal, days)
                                        );
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                                      Nro. Dias (DDF)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        calc.factors.ddfDias === 0 ? '' : calc.factors.ddfDias || ''
                                      }
                                      onChange={(e) => {
                                        const daysVal =
                                          e.target.value === '' ? 0 : Number(e.target.value);
                                        const date = calc.factors.dataCarregamento || '';
                                        updateCalculationFactors(calc.id, 'ddfDias', daysVal);
                                        updateCalculationFactors(
                                          calc.id,
                                          'dueDate',
                                          addDaysToDate(date, daysVal)
                                        );
                                      }}
                                      placeholder="Ex: 30"
                                      className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                  </div>
                                  <div className="col-span-2 mt-1">
                                    <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-150">
                                      Vencimento Calculado:{' '}
                                      {calc.factors.dueDate
                                        ? new Date(
                                            calc.factors.dueDate + 'T12:00:00'
                                          ).toLocaleDateString('pt-BR')
                                        : '—'}
                                    </p>
                                  </div>
                                </div>
                              )}
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
                          <p className="text-[8px] text-stone-400 uppercase font-bold">
                            Preço Final
                          </p>
                          <p className="text-xs font-bold text-emerald-600">
                            R$ {calc.summary.finalPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center border-x border-stone-100">
                          <p className="text-[8px] text-stone-400 uppercase font-bold">
                            N-P-K Real
                          </p>
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
                          <p className="text-[8px] text-stone-400 uppercase font-bold">
                            Custo Base
                          </p>
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
              </div>
            </div>
          </div>

          {/* O Modal de configurações substituiu as tabelas de Macros e Micros */}

          {!isSimplified && (
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
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
        <div id="resumo-calculo" className="scroll-mt-24 space-y-6">
          <div className="rounded-xl bg-stone-900 p-4 text-white shadow-lg md:p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="mb-5 border-b border-stone-700 pb-4">
              <h2 className="text-lg font-bold">Resumo da precificação</h2>
              <p className="mt-1 text-xs text-stone-400">
                Valores consolidados e composição das fórmulas calculadas.
              </p>
            </div>

            {pendingIssues.length > 0 && (
              <div className="mb-5 rounded-xl border border-amber-700/60 bg-amber-950/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> Antes de salvar
                </div>
                <ul className="space-y-1 text-xs text-amber-100">
                  {pendingIssues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

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
                        <p className="text-xs text-stone-500 uppercase font-bold">Preço Final</p>
                        <p className="text-2xl font-bold text-white">
                          R$ {calc.summary?.finalPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-stone-500 uppercase font-bold">N-P-K Real</p>
                        <p className="text-lg font-mono text-emerald-400 font-bold">
                          {formatNPK(
                            calc.formula,
                            calc.summary?.resultingN || 0,
                            calc.summary?.resultingP || 0,
                            calc.summary?.resultingK || 0
                          )}
                        </p>
                        {(calc.summary?.resultingCa || 0) > 0 && (
                          <p className="text-xs font-mono text-amber-400 mt-1">
                            CA: {calc.summary!.resultingCa.toFixed(2)}%
                          </p>
                        )}
                        {(calc.summary?.resultingS || 0) > 0 && (
                          <p className="text-xs font-mono text-yellow-500">
                            S: {calc.summary!.resultingS.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-700 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-500">Custo Base:</span>
                        <span className="text-stone-300 font-medium">
                          R$ {calc.summary?.baseCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500 font-bold">Venda Total:</span>
                        <span className="text-emerald-400 font-bold">
                          R${' '}
                          {calc.summary?.totalSaleValue.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Materials List in Summary */}
                    <div className="pt-3 border-t border-stone-700 mt-3">
                      <p className="text-xs text-stone-500 uppercase font-bold mb-2">
                        Composição (kg)
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {[...calc.macros, ...calc.micros]
                          .filter((m) => m.quantity > 0)
                          .map((m) => (
                            <div key={m.id} className="flex justify-between text-xs">
                              <span className="text-stone-400 truncate pr-1">{m.name}</span>
                              <span className="text-emerald-500 font-mono font-medium">
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
              {(currentUser.role === 'master' ||
                currentUser.role === 'admin' ||
                currentUser.role === 'manager' ||
                (currentUser.permissions as any)?.calculator_saveFormula !== false) && (
                <button
                  onClick={saveToFormulasList}
                  disabled={isLocked}
                  className={`w-full py-3 rounded-xl flex items-center justify-center font-bold text-sm transition-colors
                  ${isLocked ? 'hidden' : 'bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 shadow-lg shadow-black/20'}`}
                >
                  <Beaker className="w-4 h-4 mr-2" />
                  Salvar Fórmula/Batida
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:bottom-3 sm:left-1/2 sm:right-auto sm:w-[calc(100%-1.5rem)] sm:max-w-4xl sm:-translate-x-1/2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-xs font-bold ${pendingIssues.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}
              >
                {pendingIssues.length === 0
                  ? 'Todos os dados obrigatórios foram informados.'
                  : pendingIssues[0]}
              </p>
              <p className="text-[11px] text-stone-500">
                {calculations.filter((calc) => calc.selected).length} fórmula(s) selecionada(s)
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:items-center">
              <button
                type="button"
                onClick={() => calculateFormula()}
                disabled={!calculations.some((calc) => calc.selected)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalculatorIcon className="h-4 w-4" /> Calcular selecionadas
              </button>
              {canSavePricing && (
                <button
                  type="button"
                  onClick={savePricing}
                  disabled={isLocked}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  <Save className="h-4 w-4" /> {initialData ? 'Atualizar' : 'Salvar precificação'}
                </button>
              )}
            </div>
          </div>
        </div>
      </>

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
        isMaterialsLoading={isMaterialsLoading}
        hasNoMaterialsInDatabase={hasNoMaterialsInDatabase}
        protectedMaterialIds={protectedMaterialIds}
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
                  {factors.client?.id
                    ? 'Nenhuma cotação aprovada encontrada para este cliente.'
                    : 'Selecione um cliente na precificação para filtrar as cotações.'}
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
