import { useEffect, useRef, useState } from 'react';
import solver from 'javascript-lp-solver';
import {
  RawMaterial,
  PricingFactors,
  PricingRecord,
  PricingSummary,
  Branch,
  PriceList,
  Client,
  Agent,
  User as AppUser,
  PricingHistoryEntry,
  TargetFormula,
  IncompatibilityRule,
  SavedFormula,
} from '../types';
import {
  getClients,
  getAgents,
  getBranches,
  getPriceLists,
  getIncompatibilityRules,
  createPricingRecord,
  updatePricingRecord,
  createSavedFormula,
  getSavedFormulas,
  updateSavedFormula,
  createNotification,
  getUsers,
  getManagersOfUser,
  getCompatibilityCategories,
} from '../services/db';
import { useToast } from '../components/Toast';
import { formatNPK } from '../utils/formatters';
import {
  addProdutoLivre,
  applyCalculationModeChange,
  applyProdutosLivresToMaterials,
  CalculationMode,
  DEFAULT_CALCULATION_MODE,
  getCalculationMode,
  isProdutoLivreAvailable,
  removeProdutoLivre,
  updateProdutoLivre,
} from '../utils/calculationMode';
import { useCalculatorSettings } from './useCalculatorSettings';
import { notifyPricingCreated, notifyPricingEdited } from '../services/notificationService';
import { useConfirm } from './useConfirm';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { LocalCarregamento } from '../types/carregamento';
import {
  createProdutoFormulado,
  getProdutoFormuladoBySavedFormulaId,
} from '../services/produtosFormuladosService';
import { addHistoricoPreco } from '../services/historicoPrecoService';

interface UseCalculatorProps {
  initialData?: PricingRecord | null;
  initialFormulaToLoad?: SavedFormula | null;
  initialBranchId?: string;
  initialPriceListId?: string;
  onClearEditing?: () => void;
  onSaveSuccess?: (record: PricingRecord) => void;
  currentUser: AppUser;
}

const DEFAULT_BRANCH_NAME = 'FERTIGRAN UBERABA';
const DEFAULT_LOCAL_NAME = 'CARREGAMENTO UBERABA';
const PURE_PRODUCT_WEIGHT = 1000;

export function useCalculator({
  initialData,
  initialFormulaToLoad,
  initialBranchId,
  initialPriceListId,
  onClearEditing,
  onSaveSuccess,
  currentUser,
}: UseCalculatorProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  // Prompt dialog state for naming saved formulas
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    defaultValue: string;
    onConfirm: (v: string) => void;
  }>({ isOpen: false, defaultValue: '', onConfirm: () => {} });

  const { isSettingsOpen, activeFormulaId, openSettings, closeSettings } = useCalculatorSettings();
  const [status, setStatus] = useState<'Em Andamento' | 'Fechada' | 'Perdida'>('Em Andamento');

  const [isFertigranPModalOpen, setIsFertigranPModalOpen] = useState(false);
  const [currentComparisonFormula, setCurrentComparisonFormula] = useState<{
    formulaName: string;
    n: number;
    p: number;
    k: number;
  } | null>(null);

  const [isProfitabilityModalOpen, setIsProfitabilityModalOpen] = useState(false);
  const [profitabilityTargetCalc, setProfitabilityTargetCalc] = useState<TargetFormula | null>(
    null
  );
  const [profitabilityTargetIndex, setProfitabilityTargetIndex] = useState<number>(0);
  const [savedPricingId, setSavedPricingId] = useState<string | undefined>(
    initialData?.id || undefined
  );

  const [branches, setBranches] = useState<Branch[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [locaisCarregamento, setLocaisCarregamento] = useState<LocalCarregamento[]>([]);
  const [locaisLoaded, setLocaisLoaded] = useState(false);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);

  const [clientSearch, setClientSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [showAgentResults, setShowAgentResults] = useState(false);

  const [macros, setMacros] = useState<RawMaterial[]>([]);
  const [micros, setMicros] = useState<RawMaterial[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState<boolean>(true);
  const [materialsLoadError, setMaterialsLoadError] = useState<boolean>(false);
  const [incompatibilityRules, setIncompatibilityRules] = useState<IncompatibilityRule[]>([]);
  const [compCategories, setCompCategories] = useState<any[]>([]);

  const isLocked = initialData && initialData.status !== 'Em Andamento';

  const [factors, setFactors] = useState<PricingFactors>({
    targetFormula: '',
    factor: 0.8,
    discount: 0,
    margin: 0,
    freight: 0,
    tipoFrete: 'CIF',
    taxRate: 0,
    commission: 0,
    monthlyInterestRate: 0,
    dueDate: '',
    exemptCurrentMonth: false,
    client: { id: '', code: '', name: '', document: '' },
    agent: { id: '', code: '', name: '', document: '' },
    branchId: '',
    priceListId: '',
    totalTons: 0,
  });

  const [calculations, setCalculations] = useState<TargetFormula[]>([]);
  const [formulaProductSelections, setFormulaProductSelections] = useState<Record<string, string>>(
    {}
  );
  const [formulaProductSnapshots, setFormulaProductSnapshots] = useState<
    Record<string, { formula: string; macros: RawMaterial[]; micros: RawMaterial[] }>
  >({});
  const hasAppliedInitialDefaults = useRef(false);

  const getProductFormulaLabel = (material?: RawMaterial | null) => {
    if (!material) return '';

    if (material.type === 'macro') {
      return `${Number(material.n || 0)}-${Number(material.p || 0)}-${Number(material.k || 0)}`;
    }

    const guarantees = (material.microGuarantees || [])
      .filter((item) => Number(item.value) > 0)
      .map((item) => `${item.name} ${Number(item.value).toFixed(2)}%`);

    return guarantees.length > 0 ? guarantees.join(' + ') : material.name;
  };

  // ─── Effects ──────────────────────────────────────────────

  useEffect(() => {
    if (initialData) {
      setMacros(initialData.macros);
      setMicros(initialData.micros);
      setFactors(initialData.factors);
      const validStatus = (['Em Andamento', 'Fechada', 'Perdida'] as const).includes(
        initialData.status as any
      )
        ? (initialData.status as 'Em Andamento' | 'Fechada' | 'Perdida')
        : 'Em Andamento';
      setStatus(validStatus);
      setClientSearch(initialData.factors.client.name);
      setAgentSearch(initialData.factors.agent.name);
      setCalculations(initialData.calculations || []);
      setFormulaProductSelections({});
      setFormulaProductSnapshots({});
      hasAppliedInitialDefaults.current = true;
    }
  }, [initialData]);

  useEffect(() => {
    if (initialFormulaToLoad) {
      setMacros(initialFormulaToLoad.macros);
      setMicros(initialFormulaToLoad.micros);
      setFactors((prev) => ({
        ...prev,
        targetFormula: initialFormulaToLoad.targetFormula,
        branchId: initialBranchId || prev.branchId,
        priceListId: initialPriceListId || prev.priceListId,
      }));
      setCalculations([
        {
          id: `f_${Date.now()}`,
          formula: initialFormulaToLoad.targetFormula,
          selected: true,
          modo_calculo: DEFAULT_CALCULATION_MODE,
          produtos_livres: [],
          factors: {
            ...factors,
            targetFormula: initialFormulaToLoad.targetFormula,
            branchId: initialBranchId || factors.branchId,
            priceListId: initialPriceListId || factors.priceListId,
          },
          macros: initialFormulaToLoad.macros,
          micros: initialFormulaToLoad.micros,
        },
      ]);
      setFormulaProductSelections({});
      setFormulaProductSnapshots({});
    }
  }, [initialFormulaToLoad, initialBranchId, initialPriceListId]);

  useEffect(() => {
    const loadData = async () => {
      setIsMaterialsLoading(true);
      setMaterialsLoadError(false);
      try {
        const [savedBranches, savedLists, savedClients, savedAgents, savedRules, savedCategories] =
          await Promise.all([
            getBranches(),
            getPriceLists(),
            getClients(),
            getAgents(),
            getIncompatibilityRules(),
            getCompatibilityCategories(),
          ]);
        setBranches(savedBranches);
        setPriceLists(savedLists);
        setAvailableClients(savedClients);
        setAvailableAgents(savedAgents);
        setIncompatibilityRules(savedRules);
        setCompCategories(savedCategories);
      } catch (error) {
        console.error('[useCalculator] Falha ao carregar dados da calculadora:', error);
        showError(
          'Não foi possível carregar filiais, listas de preço e cadastros iniciais da calculadora.'
        );
        setMaterialsLoadError(true);
        setBranches([]);
        setPriceLists([]);
        setAvailableClients([]);
        setAvailableAgents([]);
        setIncompatibilityRules([]);
        setCompCategories([]);
      } finally {
        setIsMaterialsLoading(false);
      }
    };
    loadData();
  }, []);

  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');

  // Load locais de carregamento (all active, independent of branch)
  useEffect(() => {
    getLocaisAtivos()
      .then(setLocaisCarregamento)
      .catch((error) => {
        console.error('[useCalculator] Falha ao carregar locais de carregamento:', error);
        setLocaisCarregamento([]);
        showError(
          'Não foi possível carregar os locais de carregamento. Recarregue a página ou tente novamente.'
        );
      })
      .finally(() => setLocaisLoaded(true));
  }, []);

  useEffect(() => {
    const shouldSkipInitialDefaults =
      !!initialData || hasAppliedInitialDefaults.current || isMaterialsLoading || !locaisLoaded;

    // Defaults are applied only once on the first fresh calculator open.
    if (shouldSkipInitialDefaults) {
      return;
    }

    const defaultBranch = branches.find((branch) => branch.name === DEFAULT_BRANCH_NAME);
    const defaultLocal = locaisCarregamento.find((local) => local.nome === DEFAULT_LOCAL_NAME);
    const latestPriceList = priceLists[0];

    setFactors((prev) => ({
      ...prev,
      branchId: prev.branchId || initialBranchId || defaultBranch?.id || '',
      local_carregamento_id: prev.local_carregamento_id || defaultLocal?.id || undefined,
      priceListId: prev.priceListId || initialPriceListId || latestPriceList?.id || '',
    }));

    hasAppliedInitialDefaults.current = true;
  }, [
    branches,
    initialBranchId,
    initialData,
    initialPriceListId,
    isMaterialsLoading,
    locaisCarregamento,
    locaisLoaded,
    priceLists,
  ]);

  // Update prices when list changes
  useEffect(() => {
    if (factors.priceListId) {
      const selectedList = priceLists.find((l) => l.id === factors.priceListId);
      if (selectedList) {
        // Macros da Linha Diferenciada chegam desmarcadas por padrão
        const newMacros = selectedList.macros.map((m) => ({
          ...m,
          selected: m.isPremiumLine ? false : (m.selected ?? true),
          minQty:
            m.minQuantity !== undefined
              ? m.minQuantity
              : m.type === 'macro' && !m.name.toLowerCase().includes('enchimento')
                ? 50
                : m.minQty || 0,
        }));
        // Micros chegam sempre desmarcados — usuário escolhe quais usar
        const newMicros = selectedList.micros.map((m) => ({
          ...m,
          selected: false,
          minQty: m.minQuantity !== undefined ? m.minQuantity : m.minQty || 0,
        }));

        setMacros(newMacros);
        setMicros(newMicros);
        setCurrency(selectedList.currency || 'BRL');

        setCalculations((prevCalculations) =>
          prevCalculations.map((calc) => {
            if (!calc.selected) return calc;

            const updatedCalcMacros = newMacros.map((newP) => {
              const savedP = calc.macros.find((s) => s.id === newP.id);
              if (savedP) {
                return {
                  ...newP,
                  selected: savedP.selected,
                  quantity: savedP.quantity,
                  minQty: savedP.minQty,
                  maxQty: savedP.maxQty,
                };
              }
              return { ...newP, selected: false, quantity: 0, minQty: 0, maxQty: 0 };
            });

            const updatedCalcMicros = newMicros.map((newP) => {
              const savedP = calc.micros.find((s) => s.id === newP.id);
              if (savedP) {
                return {
                  ...newP,
                  selected: savedP.selected,
                  quantity: savedP.quantity,
                  minQty: savedP.minQty,
                  maxQty: savedP.maxQty,
                };
              }
              return { ...newP, selected: false, quantity: 0, minQty: 0, maxQty: 0 };
            });

            return {
              ...calc,
              macros: updatedCalcMacros,
              micros: updatedCalcMicros,
            };
          })
        );
      }
    }
  }, [factors.priceListId, priceLists]);

  // ─── Handlers ─────────────────────────────────────────────

  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  const [microsInGear, setMicrosInGear] = useState<boolean>(true);
  const hasNoMaterialsInDatabase =
    !isMaterialsLoading &&
    !materialsLoadError &&
    (priceLists.length === 0 ||
      priceLists.every((list) => (list.macros?.length || 0) + (list.micros?.length || 0) === 0));

  const handleMacroChange = (
    id: string,
    field: keyof RawMaterial,
    value: string | number | boolean
  ) => {
    const nextMacros = macros.map((m) => (m.id === id ? { ...m, [field]: value } : m));
    setMacros(nextMacros);

    setCalculations((prev) =>
      prev.map((calc) => {
        const updatedCalcMacros = (calc.macros.length > 0 ? calc.macros : nextMacros).map((m) =>
          m.id === id ? { ...m, [field]: value } : m
        );
        if (hasTargetFormula(calc.formula)) {
          return {
            ...calc,
            macros: updatedCalcMacros,
          };
        }
        return applyFreeCompositionSummary(calc, updatedCalcMacros, calc.micros);
      })
    );
  };

  const handleMicroChange = (
    id: string,
    field: keyof RawMaterial,
    value: string | number | boolean
  ) => {
    const nextMicros = micros.map((m) => (m.id === id ? { ...m, [field]: value } : m));
    setMicros(nextMicros);

    setCalculations((prev) =>
      prev.map((calc) => {
        const updatedCalcMicros = (calc.micros.length > 0 ? calc.micros : nextMicros).map((m) =>
          m.id === id ? { ...m, [field]: value } : m
        );
        if (hasTargetFormula(calc.formula)) {
          return {
            ...calc,
            micros: updatedCalcMicros,
          };
        }
        return applyFreeCompositionSummary(calc, calc.macros, updatedCalcMicros);
      })
    );
  };

  const handleFactorChange = (field: keyof PricingFactors, value: string | number | boolean) => {
    setFactors({ ...factors, [field]: value });
  };

  const addMacro = () => {
    setMacros([
      ...macros,
      {
        id: Date.now().toString(),
        type: 'macro',
        name: '',
        price: 0,
        n: 0,
        p: 0,
        k: 0,
        s: 0,
        ca: 0,
        microGuarantees: [],
        minQty: 50,
        maxQty: 1000,
        selected: true,
        quantity: 0,
      },
    ]);
  };

  const addMicro = () => {
    setMicros([
      ...micros,
      {
        id: Date.now().toString(),
        type: 'micro',
        name: '',
        price: 0,
        n: 0,
        p: 0,
        k: 0,
        s: 0,
        ca: 0,
        microGuarantees: [],
        minQty: 0,
        maxQty: 1000,
        selected: true,
        quantity: 0,
      },
    ]);
  };

  const removeMacro = (id: string) => setMacros(macros.filter((m) => m.id !== id));
  const removeMicro = (id: string) => setMicros(micros.filter((m) => m.id !== id));

  const calculateSummary = (
    currentMacros: RawMaterial[],
    currentMicros: RawMaterial[],
    currentFactors: PricingFactors
  ): PricingSummary => {
    const selectedMacros = currentMacros.filter((m) => m.selected);
    const selectedMicros = currentMicros.filter((m) => m.selected);
    const allSelected = [...selectedMacros, ...selectedMicros];

    let totalWeight = 0;
    let baseCost = 0;
    let totalN_kg = 0;
    let totalP_kg = 0;
    let totalK_kg = 0;
    let totalS_kg = 0;
    let totalCa_kg = 0;
    let resultingMicros: Record<string, number> = {};

    allSelected.forEach((m) => {
      const qty = Number(m.quantity) || 0;
      totalWeight += qty;
      baseCost += (qty / 1000) * (Number(m.price) || 0);

      totalN_kg += qty * ((Number(m.n) || 0) / 100);
      totalP_kg += qty * ((Number(m.p) || 0) / 100);
      totalK_kg += qty * ((Number(m.k) || 0) / 100);
      totalS_kg += qty * ((Number(m.s) || 0) / 100);
      totalCa_kg += qty * ((Number(m.ca) || 0) / 100);

      if (m.microGuarantees) {
        m.microGuarantees.forEach((g) => {
          const micro_kg = qty * ((Number(g.value) || 0) / 100);
          resultingMicros[g.name] = (resultingMicros[g.name] || 0) + micro_kg;
        });
      }
    });

    const resultingN = totalWeight > 0 ? (totalN_kg / totalWeight) * 100 : 0;
    const resultingP = totalWeight > 0 ? (totalP_kg / totalWeight) * 100 : 0;
    const resultingK = totalWeight > 0 ? (totalK_kg / totalWeight) * 100 : 0;
    const resultingS = totalWeight > 0 ? (totalS_kg / totalWeight) * 100 : 0;
    const resultingCa = totalWeight > 0 ? (totalCa_kg / totalWeight) * 100 : 0;

    const finalMicros: Record<string, number> = {};
    Object.keys(resultingMicros).forEach((name) => {
      finalMicros[name] = totalWeight > 0 ? (resultingMicros[name] / totalWeight) * 100 : 0;
    });

    const factoredPrice = baseCost * (Number(currentFactors.factor) || 1);
    const basePrice = factoredPrice - (Number(currentFactors.discount) || 0);

    let days = 0;
    if (currentFactors.dueDate) {
      const due = new Date(currentFactors.dueDate);
      const today = new Date();

      if (currentFactors.exemptCurrentMonth) {
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        if (due > endOfMonth) {
          const diffTime = due.getTime() - endOfMonth.getTime();
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      } else {
        const diffTime = due.getTime() - today.getTime();
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      if (days < 0) days = 0;
    }

    const dailyInterest = (Number(currentFactors.monthlyInterestRate) || 0) / 30;
    const interestValue = basePrice * (dailyInterest / 100) * days;
    const taxValue = basePrice * ((Number(currentFactors.taxRate) || 0) / 100);
    const commissionValue = basePrice * ((Number(currentFactors.commission) || 0) / 100);
    // Explicit CIF/FOB: older records without tipoFrete default to CIF when freight > 0
    const tipoFrete =
      currentFactors.tipoFrete ?? (Number(currentFactors.freight) > 0 ? 'CIF' : 'FOB');
    const freightValue = tipoFrete === 'CIF' ? Number(currentFactors.freight) || 0 : 0;
    const embalagemValor = Number(currentFactors.embalagem_valor || 0);

    const finalPrice =
      basePrice + interestValue + taxValue + commissionValue + freightValue + embalagemValor;
    const totalSaleValue = finalPrice * (Number(currentFactors.totalTons) || 0);

    return {
      totalWeight,
      baseCost,
      basePrice,
      interestValue,
      taxValue,
      commissionValue,
      freightValue,
      finalPrice,
      totalSaleValue,
      resultingN,
      resultingP,
      resultingK,
      resultingS,
      resultingCa,
      resultingMicros: finalMicros,
    };
  };

  const targetFormulaPattern = /(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/;

  const hasTargetFormula = (formula?: string) =>
    !!formula && targetFormulaPattern.test(formula.trim());

  const applyFreeCompositionSummary = (
    calc: TargetFormula,
    currentMacros: RawMaterial[],
    currentMicros: RawMaterial[]
  ): TargetFormula => {
    const nextMacros = currentMacros.map((material) => ({
      ...material,
      quantity: material.selected ? Number(material.minQty || material.quantity || 0) : 0,
    }));
    const nextMicros = currentMicros.map((material) => ({
      ...material,
      quantity: material.selected ? Number(material.minQty || material.quantity || 0) : 0,
    }));

    return {
      ...calc,
      macros: nextMacros,
      micros: nextMicros,
      summary: calculateSummary(nextMacros, nextMicros, calc.factors),
    };
  };

  const calculateFormula = (targetFormulaId?: string) => {
    const formulasToCalculate = targetFormulaId
      ? calculations.filter((c) => c.id === targetFormulaId)
      : calculations.filter((c) => c.selected);

    if (formulasToCalculate.length === 0 && !targetFormulaId) {
      showError('Selecione ao menos uma fórmula para calcular.');
      return;
    }

    const updatedCalculations = [...calculations];

    formulasToCalculate.forEach((calc) => {
      const currentMacros = calc.macros && calc.macros.length > 0 ? calc.macros : macros;
      const currentMicros = microsInGear ? (calc.micros.length > 0 ? calc.micros : micros) : micros;
      const calculationMode = getCalculationMode(calc);

      if (calculationMode === 'produtos_livres') {
        const produtosLivres = (calc.produtos_livres || []).filter(
          (item) => Number(item.quantity) > 0
        );

        if (produtosLivres.length === 0) {
          showError('Adicione ao menos um produto livre com quantidade em kg para calcular.');
          return;
        }

        const unknownProduct = produtosLivres.find(
          (item) =>
            ![...currentMacros, ...currentMicros].some((material) => material.id === item.productId)
        );

        if (unknownProduct) {
          showError(
            `Produto livre (${unknownProduct.productId}) não foi encontrado na lista de preço atual.`
          );
          return;
        }

        const { nextMacros, nextMicros } = applyProdutosLivresToMaterials(
          produtosLivres,
          currentMacros,
          currentMicros
        );
        const calcIndex = updatedCalculations.findIndex((item) => item.id === calc.id);

        if (calcIndex !== -1) {
          const summary = calculateSummary(
            nextMacros,
            nextMicros,
            updatedCalculations[calcIndex].factors
          );
          updatedCalculations[calcIndex] = {
            ...updatedCalculations[calcIndex],
            formula: formatNPK(
              calc.formula || '0-0-0',
              summary.resultingN,
              summary.resultingP,
              summary.resultingK
            ),
            macros: nextMacros,
            micros: nextMicros,
            summary,
          };
        }
        return;
      }

      if (!hasTargetFormula(calc.formula)) {
        const calcIndex = updatedCalculations.findIndex((item) => item.id === calc.id);
        if (calcIndex !== -1) {
          updatedCalculations[calcIndex] = applyFreeCompositionSummary(
            updatedCalculations[calcIndex],
            currentMacros,
            currentMicros
          );
        }
        return;
      }

      const match = calc.formula.match(targetFormulaPattern);
      if (!match) return;

      const targetN = parseFloat(match[1].replace(',', '.'));
      const targetP = parseFloat(match[2].replace(',', '.'));
      const targetK = parseFloat(match[3].replace(',', '.'));

      const reqN = targetN * 10;
      const reqP = targetP * 10;
      const reqK = targetK * 10;

      interface LPModel {
        optimize: string;
        opType: string;
        constraints: Record<string, Record<string, number>>;
        variables: Record<string, Record<string, number>>;
        ints: Record<string, number>;
      }

      const model: LPModel = {
        optimize: 'cost',
        opType: 'min',
        constraints: {
          n_eq: { min: reqN, max: reqN + 9 },
          p_eq: { min: reqP, max: reqP + 9 },
          k_eq: { min: reqK, max: reqK + 9 },

          ...((calc.targetS || 0) > 0
            ? { s_eq: { min: calc.targetS! * 10, max: calc.targetS! * 10 + 9 } }
            : {}),
          ...((calc.targetCa || 0) > 0
            ? { ca_eq: { min: calc.targetCa! * 10, max: calc.targetCa! * 10 + 9 } }
            : {}),
          weight: { equal: 1000 },
        },
        variables: {},
        ints: {},
      };

      let availableMaterials = [...currentMacros, ...currentMicros].filter((m) => m.selected);

      availableMaterials.forEach((m) => {
        const useVar = `use_${m.id}`;
        const minLiner = `link_min_${m.id}`;
        const maxLiner = `link_max_${m.id}`;

        model.variables[m.id] = {
          cost: Number(m.price) || 0,
          n_eq: (Number(m.n) || 0) / 100,
          p_eq: (Number(m.p) || 0) / 100,
          k_eq: (Number(m.k) || 0) / 100,
          s_eq: (Number(m.s) || 0) / 100,
          ca_eq: (Number(m.ca) || 0) / 100,
          weight: 1,
          [minLiner]: 1,
          [maxLiner]: 1,
        };

        model.variables[useVar] = {
          cost: 0.01,
          [minLiner]: -(Number(m.minQty) || 0),
          [maxLiner]: -(Number(m.maxQty) || 1000),
        };
        model.ints[useVar] = 1;

        model.constraints[minLiner] = { min: 0 };
        model.constraints[maxLiner] = { max: 0 };

        // Forçar a entrada na fórmula quando o usuário definir Fixo (mínimo igual ao máximo e > 0)
        if (Number(m.minQty) === Number(m.maxQty) && Number(m.minQty) > 0) {
          model.constraints[`force_${m.id}`] = { equal: Number(m.minQty) };
          model.variables[m.id][`force_${m.id}`] = 1;
        }
      });

      // Constraints de incompatibilidade
      incompatibilityRules.forEach((rule, idx) => {
        const matA = availableMaterials.find((m) => m.id === rule.materialAId);
        const matB = availableMaterials.find((m) => m.id === rule.materialBId);

        if (matA && matB) {
          const constraintName = `incomp_${idx}`;
          model.constraints[constraintName] = { max: 1 };
          if (model.variables[`use_${matA.id}`])
            model.variables[`use_${matA.id}`][constraintName] = 1;
          if (model.variables[`use_${matB.id}`])
            model.variables[`use_${matB.id}`][constraintName] = 1;
        }
      });

      const results = solver.Solve(
        model as unknown as Parameters<typeof solver.Solve>[0]
      ) as unknown as Record<string, number>;

      if (results.feasible) {
        const calcIndex = updatedCalculations.findIndex((c) => c.id === calc.id);
        if (calcIndex !== -1) {
          const newMacros = currentMacros.map((m) => ({
            ...m,
            quantity: m.selected ? results[m.id] || 0 : 0,
          }));
          const newMicros = currentMicros.map((m) => ({
            ...m,
            quantity: m.selected ? results[m.id] || 0 : 0,
          }));

          updatedCalculations[calcIndex] = {
            ...updatedCalculations[calcIndex],
            macros: newMacros,
            micros: newMicros,
            summary: calculateSummary(newMacros, newMicros, updatedCalculations[calcIndex].factors),
          };
        }
      } else {
        showError(
          `A formulação ${calc.formula} não fecha com os produtos selecionados. Verifique as restrições ou adicione enchimento.`
        );
        const calcIndex = updatedCalculations.findIndex((c) => c.id === calc.id);
        if (calcIndex !== -1) {
          updatedCalculations[calcIndex] = {
            ...updatedCalculations[calcIndex],
            summary: calculateSummary(
              updatedCalculations[calcIndex].macros,
              updatedCalculations[calcIndex].micros,
              updatedCalculations[calcIndex].factors
            ),
          };
        }
      }
    });

    setCalculations(updatedCalculations);
  };

  const addTargetFormula = () => {
    const newCalc: TargetFormula = {
      id: Date.now().toString(),
      formula: '',
      selected: true,
      modo_calculo: DEFAULT_CALCULATION_MODE,
      produtos_livres: [],
      factors: { ...factors },
      macros: [...macros],
      micros: [...micros],
    };
    setCalculations([...calculations, newCalc]);
  };

  const removeTargetFormula = (id: string) => {
    setCalculations(calculations.filter((c) => c.id !== id));
  };

  const updateCalculation = (
    id: string,
    field: keyof TargetFormula,
    value: string | number | boolean | RawMaterial[]
  ) => {
    setCalculations(
      calculations.map((c) => {
        if (c.id === id) {
          let updatedFormula = { ...c, [field]: value };

          // Se a mudança for na categoria, vamos auto-selecionar os produtos
          if (field === 'category') {
            const isAll = value === 'all';

            const newMacros = macros.map((m) => {
              const isMatch = isAll ? !m.isPremiumLine : m.categories?.includes(value as string);
              return {
                ...m,
                selected: !!isMatch,
              };
            });

            const newMicros = micros.map((m) => {
              const isMatch = isAll ? false : m.categories?.includes(value as string);
              return {
                ...m,
                selected: !!isMatch,
              };
            });

            updatedFormula.macros = newMacros;
            updatedFormula.micros = newMicros;

            setMacros(newMacros);
            setMicros(newMicros);
          }

          if (!hasTargetFormula(updatedFormula.formula)) {
            return applyFreeCompositionSummary(
              updatedFormula,
              updatedFormula.macros.length > 0 ? updatedFormula.macros : macros,
              updatedFormula.micros.length > 0 ? updatedFormula.micros : micros
            );
          }

          return updatedFormula;
        }
        return c;
      })
    );
  };

  const setCalculationProduct = (calcId: string, productId?: string) => {
    setCalculations((prev) =>
      prev.map((calc) => {
        if (calc.id !== calcId) return calc;

        if (!productId) {
          const snapshot = formulaProductSnapshots[calcId];
          if (!snapshot) return calc;

          return {
            ...calc,
            formula: snapshot.formula,
            macros: snapshot.macros,
            micros: snapshot.micros,
            summary: calculateSummary(snapshot.macros, snapshot.micros, calc.factors),
          };
        }

        const availableMacros = calc.macros.length > 0 ? calc.macros : macros;
        const availableMicros = calc.micros.length > 0 ? calc.micros : micros;
        const selectedProduct = [...availableMacros, ...availableMicros].find(
          (material) => material.id === productId
        );

        if (!selectedProduct) {
          showError(
            'O produto selecionado não está disponível na lista de preço atual. Verifique a lista selecionada ou escolha outro produto.'
          );
          return calc;
        }

        const nextMacros = availableMacros.map((material) => ({
          ...material,
          selected: selectedProduct.type === 'macro' && material.id === selectedProduct.id,
          quantity: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : 0,
          minQty: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : material.minQty,
          maxQty: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : material.maxQty,
        }));

        const nextMicros = availableMicros.map((material) => ({
          ...material,
          selected: selectedProduct.type === 'micro' && material.id === selectedProduct.id,
          quantity: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : 0,
          minQty: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : material.minQty,
          maxQty: material.id === selectedProduct.id ? PURE_PRODUCT_WEIGHT : material.maxQty,
        }));

        return {
          ...calc,
          macros: nextMacros,
          micros: nextMicros,
          summary: calculateSummary(nextMacros, nextMicros, calc.factors),
        };
      })
    );

    if (productId) {
      const currentCalc = calculations.find((calc) => calc.id === calcId);
      if (currentCalc && !formulaProductSelections[calcId]) {
        setFormulaProductSnapshots((prev) => ({
          ...prev,
          [calcId]: {
            formula: currentCalc.formula,
            macros: currentCalc.macros.length > 0 ? currentCalc.macros : macros,
            micros: currentCalc.micros.length > 0 ? currentCalc.micros : micros,
          },
        }));
      }

      setFormulaProductSelections((prev) => ({
        ...prev,
        [calcId]: productId,
      }));
      return;
    }

    setFormulaProductSelections((prev) => {
      const next = { ...prev };
      delete next[calcId];
      return next;
    });
    setFormulaProductSnapshots((prev) => {
      const next = { ...prev };
      delete next[calcId];
      return next;
    });
  };

  const setCalculationMode = (calcId: string, mode: CalculationMode) => {
    setCalculations((prev) =>
      prev.map((calc) => {
        if (calc.id !== calcId) return calc;

        const availableMacros = calc.macros.length > 0 ? calc.macros : macros;
        const availableMicros = calc.micros.length > 0 ? calc.micros : micros;
        const nextCalc = applyCalculationModeChange(calc, mode, availableMacros, availableMicros);

        return {
          ...nextCalc,
          summary: calculateSummary(nextCalc.macros, nextCalc.micros, calc.factors),
        };
      })
    );

    setFormulaProductSelections((prev) => {
      const next = { ...prev };
      delete next[calcId];
      return next;
    });

    setFormulaProductSnapshots((prev) => {
      const next = { ...prev };
      delete next[calcId];
      return next;
    });
  };

  const addProdutoLivreToCalculation = (calcId: string, productId: string) => {
    setCalculations((prev) =>
      prev.map((calc) => {
        if (calc.id !== calcId) return calc;

        const products = calc.produtos_livres || [];
        const availableMaterials = [...(calc.macros || []), ...(calc.micros || [])];
        if (!availableMaterials.some((material) => material.id === productId)) {
          showError('Produto não encontrado na lista de preço atual.');
          return calc;
        }
        if (!isProdutoLivreAvailable(productId, availableMaterials, products)) {
          return calc;
        }

        return {
          ...calc,
          produtos_livres: addProdutoLivre(products, productId),
        };
      })
    );
  };

  const updateProdutoLivreQuantity = (calcId: string, productId: string, quantity: number) => {
    setCalculations((prev) =>
      prev.map((calc) => {
        if (calc.id !== calcId) return calc;
        return {
          ...calc,
          produtos_livres: updateProdutoLivre(calc.produtos_livres || [], productId, quantity),
        };
      })
    );
  };

  const removeProdutoLivreFromCalculation = (calcId: string, productId: string) => {
    setCalculations((prev) =>
      prev.map((calc) => {
        if (calc.id !== calcId) return calc;
        return {
          ...calc,
          produtos_livres: removeProdutoLivre(calc.produtos_livres || [], productId),
        };
      })
    );
  };

  const handleCalcMicroChange = (
    calcId: string,
    microId: string,
    field: keyof RawMaterial,
    value: string | number | boolean
  ) => {
    setCalculations(
      calculations.map((c) => {
        if (c.id === calcId) {
          const updated = {
            ...c,
            micros: c.micros.map((m) => (m.id === microId ? { ...m, [field]: value } : m)),
          };
          if (!hasTargetFormula(updated.formula)) {
            return applyFreeCompositionSummary(updated, updated.macros, updated.micros);
          }
          return updated;
        }
        return c;
      })
    );
  };

  const updateCalculationFactors = (
    id: string,
    field: keyof PricingFactors,
    value: string | number | boolean
  ) => {
    setCalculations((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newFactors = { ...c.factors, [field]: value };
          return {
            ...c,
            factors: newFactors,
            summary: calculateSummary(c.macros, c.micros, newFactors),
          };
        }
        return c;
      })
    );
  };

  const getDetailedFormulaName = (
    formulaName: string,
    macs: RawMaterial[],
    mics: RawMaterial[],
    resultingMicros: Record<string, number>,
    targetCa?: number,
    targetS?: number,
    resultingCa?: number,
    resultingS?: number
  ) => {
    const baseFormula = formulaName.split(' C/')[0].split(' + ')[0];
    const suffixes: string[] = [];
    macs.forEach((m) => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    mics.forEach((m) => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    const caParts: string[] = [];
    if ((targetCa || 0) > 0 && (resultingCa || 0) > 0)
      caParts.push(`CA: ${resultingCa!.toFixed(2)}%`);
    if ((targetS || 0) > 0 && (resultingS || 0) > 0) caParts.push(`S: ${resultingS!.toFixed(2)}%`);

    let caStr = '';
    if (caParts.length > 0) {
      caStr = ` + ${caParts.join(' + ')}`;
    }

    const microParts = Object.entries(resultingMicros || {})
      .filter(([_, val]) => (val as number) > 0)
      .map(([name, val]) => `${name}: ${(val as number).toFixed(2)}%`);

    let microStr = '';
    if (microParts.length > 0) {
      microStr = ` + ${microParts.join(' + ')}`;
    }

    let finalName = baseFormula;

    if (suffixes.length > 0) {
      finalName += ` C/ ${Array.from(new Set(suffixes)).join(' + ')}`;
    }

    if (caStr) {
      finalName += caStr;
    }

    if (microStr) {
      finalName += microStr;
    }

    return finalName;
  };

  // ─── Save functions ───────────────────────────────────────

  const savePricing = async () => {
    if (isLocked) {
      showError('Esta precificação está finalizada e não pode ser alterada.');
      return;
    }
    if (!factors?.client?.id) {
      showError('Não é possível salvar precificação sem cliente.');
      return;
    }

    const historyEntry: PricingHistoryEntry = {
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: initialData ? `Editada - Status: ${status}` : 'Criada',
    };

    const updatedCalculations = calculations.map((c) => {
      const mode = getCalculationMode(c);
      const selectedProduct = formulaProductSelections[c.id]
        ? [...(c.macros || []), ...(c.micros || [])].find(
            (material) => material.id === formulaProductSelections[c.id]
          )
        : undefined;
      const formulaName =
        mode === 'produtos_livres'
          ? formatNPK(
              c.formula || '0-0-0',
              c.summary?.resultingN || 0,
              c.summary?.resultingP || 0,
              c.summary?.resultingK || 0
            )
          : selectedProduct
            ? getProductFormulaLabel(selectedProduct)
            : c.formula;

      return {
        ...c,
        modo_calculo: mode,
        formula: getDetailedFormulaName(
          formulaName,
          c.macros,
          c.micros,
          c.summary?.resultingMicros,
          c.targetCa,
          c.targetS,
          c.summary?.resultingCa,
          c.summary?.resultingS
        ),
      };
    });
    const selectedCalculation =
      updatedCalculations.find((c) => c.selected) || updatedCalculations[0];

    const record: PricingRecord = {
      id: initialData?.id || '',
      modo_calculo: selectedCalculation
        ? getCalculationMode(selectedCalculation)
        : DEFAULT_CALCULATION_MODE,
      userId: currentUser.id,
      userName: currentUser.name,
      userCode: currentUser.nickname,
      date: initialData?.date || new Date().toISOString(),
      status,
      approvalStatus:
        initialData?.approvalStatus === 'Reprovada'
          ? 'Pendente'
          : initialData?.approvalStatus || 'Pendente',
      macros,
      micros,
      factors,
      rejectionObservation:
        initialData?.approvalStatus === 'Reprovada' ? '' : initialData?.rejectionObservation,
      summary: updatedCalculations.find((c) => c.selected)?.summary || {
        totalWeight: 0,
        baseCost: 0,
        basePrice: 0,
        interestValue: 0,
        taxValue: 0,
        commissionValue: 0,
        freightValue: 0,
        finalPrice: 0,
        totalSaleValue: 0,
        resultingN: 0,
        resultingP: 0,
        resultingK: 0,
        resultingS: 0,
        resultingCa: 0,
        resultingMicros: {},
      },
      calculations: updatedCalculations,
      history: [...(initialData?.history || []), historyEntry],
    };

    try {
      let savedRecord: PricingRecord;
      const isNew = !initialData;
      const wasApproved = initialData?.approvalStatus === 'Aprovada';
      const wasRejected = initialData?.approvalStatus === 'Reprovada';

      if (initialData) {
        await updatePricingRecord(initialData.id, record);
        savedRecord = { ...record, id: initialData.id };

        await notifyPricingEdited(savedRecord, currentUser);

        if (wasApproved || wasRejected) {
          const managersList = await getManagersOfUser(currentUser.id);
          const approversList = await getUsers();
          const masterAdmins = approversList.filter(
            (u) =>
              u.role === 'master' ||
              u.role === 'admin' ||
              (u.permissions as any)?.approvals_canApprove === true
          );

          const notifyIds = new Set([
            ...managersList.map((m) => m.id),
            ...masterAdmins.map((a) => a.id),
          ]);

          for (const targetId of notifyIds) {
            await createNotification({
              userId: targetId,
              title: wasApproved
                ? 'Precificação Aprovada Alterada'
                : 'Reenvio de Precificação Reprovada',
              message: wasApproved
                ? `${currentUser.name} alterou a precificação aprovada para ${factors.client.name}. Revisão necessária para nova aprovação.`
                : `${currentUser.name} corrigiu e reenviou a precificação de ${factors.client.name} que havia sido reprovada.`,
              date: new Date().toISOString(),
              read: false,
              type: 'pricing_approval',
              dataId: initialData.id,
            });
          }
        }
      } else {
        savedRecord = await createPricingRecord(record);

        await notifyPricingCreated(savedRecord, currentUser);

        // Record price history for linked produto_formulado
        if (initialFormulaToLoad?.id) {
          try {
            const produto = await getProdutoFormuladoBySavedFormulaId(initialFormulaToLoad.id);
            if (produto) {
              const finalPrice = savedRecord.summary?.finalPrice;
              if (finalPrice != null && finalPrice > 0) {
                await addHistoricoPreco({
                  produto_formulado_id: produto.id,
                  preco_final: finalPrice,
                  pricing_id: savedRecord.id,
                  registrado_por: currentUser.name,
                });
              }
            }
          } catch (histErr) {
            console.warn('[useCalculator] Failed to record historico_preco:', histErr);
          }
        }

        const managersList = await getManagersOfUser(currentUser.id);
        const approversList = await getUsers();
        const masterAdmins = approversList.filter(
          (u) =>
            u.role === 'master' ||
            u.role === 'admin' ||
            (u.permissions as any)?.approvals_canApprove === true
        );

        const notifyIds = new Set([
          ...managersList.map((m) => m.id),
          ...masterAdmins.map((a) => a.id),
        ]);

        for (const targetId of notifyIds) {
          await createNotification({
            userId: targetId,
            title: 'Nova Precificação Pendente',
            message: `${currentUser.name} gerou uma nova precificação para ${factors.client.name} que requer aprovação.`,
            date: new Date().toISOString(),
            read: false,
            type: 'pricing_approval',
            dataId: savedRecord.id,
          });
        }
      }
      showSuccess(
        `Precificação ${wasApproved || wasRejected ? 'atualizada' : 'salva'} com sucesso!${wasApproved || wasRejected ? ' Notificação enviada aos gerentes.' : ''}`
      );
      setClientSearch('');
      setAgentSearch('');
      setSavedPricingId(savedRecord.id);
      if (onClearEditing) onClearEditing();
      if (onSaveSuccess) onSaveSuccess(savedRecord);
    } catch (error) {
      showError('Erro ao salvar precificação.');
      console.error(error);
    }
  };

  const saveToFormulasList = async () => {
    const selectedCalc = calculations.find((c) => c.selected);
    if (!selectedCalc) {
      showError('Calcule e selecione uma fórmula para salvar a batida.');
      return;
    }

    const suffixes: string[] = [];
    selectedCalc.macros.forEach((m) => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    selectedCalc.micros.forEach((m) => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    const microSummary = selectedCalc.summary?.resultingMicros || {};

    const defaultName = getDetailedFormulaName(
      selectedCalc.formula,
      selectedCalc.macros,
      selectedCalc.micros,
      selectedCalc.summary?.resultingMicros
    );

    setPromptState({
      isOpen: true,
      defaultValue: defaultName,
      onConfirm: async (name: string) => {
        setPromptState((prev) => ({ ...prev, isOpen: false }));
        try {
          const existing = await getSavedFormulas();

          const currentSuffixes = Array.from(new Set(suffixes)).sort().join(',');
          const currentFormula = selectedCalc.formula;
          const currentMicros = JSON.stringify(
            Object.entries(microSummary)
              .filter(([_, v]) => (v as number) > 0)
              .sort()
          );

          const duplicate = existing.find((f) => {
            const fSuffixes: string[] = [];
            f.macros.forEach((m) => {
              if (m.quantity > 0 && m.formulaSuffix) {
                const clean = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
                if (clean) fSuffixes.push(clean);
              }
            });
            f.micros.forEach((m) => {
              if (m.quantity > 0 && m.formulaSuffix) {
                const clean = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
                if (clean) fSuffixes.push(clean);
              }
            });
            const fSuffixStr = Array.from(new Set(fSuffixes)).sort().join(',');
            const fSummary = calculateSummary(f.macros, f.micros, factors);
            const fMicrosStr = JSON.stringify(
              Object.entries(fSummary.resultingMicros)
                .filter(([_, v]) => (v as number) > 0)
                .sort()
            );
            return (
              f.targetFormula === currentFormula &&
              fSuffixStr === currentSuffixes &&
              fMicrosStr === currentMicros
            );
          });

          if (duplicate) {
            const ok = await confirm({
              title: 'Batida Duplicada',
              message: `Já existe uma batida salva ("${duplicate.name}") com a mesma composição. Deseja atualizar a batida existente com o novo nome e data?`,
              confirmLabel: 'Atualizar',
              variant: 'warning',
            });
            if (ok) {
              await updateSavedFormula(duplicate.id, {
                name: name.trim(),
                date: new Date().toISOString(),
                targetFormula: selectedCalc.formula,
                macros: selectedCalc.macros || macros,
                micros: selectedCalc.micros || micros,
              });
              showSuccess('Batida existente atualizada com sucesso!');
              return;
            }
          }

          if (
            existing.some(
              (f) =>
                f.userId === currentUser.id &&
                f.name.trim().toLowerCase() === name.trim().toLowerCase()
            )
          ) {
            showError('Você já possui uma fórmula salva com esse nome. Escolha outro nome.');
            return;
          }

          const savedFormula = await createSavedFormula({
            userId: currentUser.id,
            userName: currentUser.name,
            name: name.trim(),
            date: new Date().toISOString(),
            targetFormula: selectedCalc.formula,
            macros: selectedCalc.macros || macros,
            micros: selectedCalc.micros || micros,
          });
          // Also save to produtos_formulados
          try {
            await createProdutoFormulado({
              nome: name.trim(),
              formula_npk: selectedCalc.formula,
              saved_formula_id: savedFormula.id,
              linha_diferenciada: false,
              ativo: true,
              criado_por: currentUser.id,
            });
          } catch (pfError) {
            console.warn('[saveToFormulasList] Failed to create produto_formulado:', pfError);
            showError('Batida salva, mas houve um erro ao registrar em Produtos Formulados.');
          }
          showSuccess('Batida salva com sucesso nas suas Fórmulas!');
        } catch (error: unknown) {
          const e = error as { message?: string; error_description?: string };
          const msg = e?.message || e?.error_description || 'Tente novamente.';
          showError(`Erro ao salvar batida: ${msg}`);
        }
      },
    });
  };

  // ─── Return ───────────────────────────────────────────────

  return {
    // Confirm dialog
    confirmState,
    confirm,
    handleConfirm,
    handleCancel,

    // Prompt dialog
    promptState,
    setPromptState,

    // Calculator settings
    isSettingsOpen,
    activeFormulaId,
    openSettings,
    closeSettings,

    // Status
    status,
    setStatus,

    // Fertigran P modal
    isFertigranPModalOpen,
    setIsFertigranPModalOpen,
    currentComparisonFormula,
    setCurrentComparisonFormula,

    // Profitability modal
    isProfitabilityModalOpen,
    setIsProfitabilityModalOpen,
    profitabilityTargetCalc,
    setProfitabilityTargetCalc,
    profitabilityTargetIndex,
    setProfitabilityTargetIndex,

    // Saved pricing
    savedPricingId,
    setSavedPricingId,

    // Lookup data
    branches,
    priceLists,
    locaisCarregamento,
    availableClients,
    availableAgents,

    // Search
    clientSearch,
    setClientSearch,
    agentSearch,
    setAgentSearch,
    showClientResults,
    setShowClientResults,
    showAgentResults,
    setShowAgentResults,

    // Materials
    macros,
    setMacros,
    micros,
    setMicros,
    incompatibilityRules,
    compCategories,
    isMaterialsLoading,
    hasNoMaterialsInDatabase,

    // Locked state
    isLocked,

    // Factors
    factors,
    setFactors,

    // Calculations
    calculations,
    setCalculations,
    formulaProductSelections,

    // Currency
    currency,

    // Expanded calc / micros gear
    expandedCalc,
    setExpandedCalc,
    microsInGear,
    setMicrosInGear,

    // Handlers
    handleMacroChange,
    handleMicroChange,
    handleFactorChange,
    addMacro,
    addMicro,
    removeMacro,
    removeMicro,
    calculateFormula,
    calculateSummary,
    addTargetFormula,
    removeTargetFormula,
    updateCalculation,
    setCalculationMode,
    setCalculationProduct,
    addProdutoLivreToCalculation,
    updateProdutoLivreQuantity,
    removeProdutoLivreFromCalculation,
    handleCalcMicroChange,
    updateCalculationFactors,
    getDetailedFormulaName,

    // Save functions
    savePricing,
    saveToFormulasList,
  };
}
