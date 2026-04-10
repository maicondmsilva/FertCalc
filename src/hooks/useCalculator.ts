import { useState, useEffect } from 'react';
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
import { useCalculatorSettings } from './useCalculatorSettings';
import { notifyPricingCreated, notifyPricingEdited } from '../services/notificationService';
import { useConfirm } from './useConfirm';

const defaultMacros: RawMaterial[] = [
  {
    id: 'm1',
    type: 'macro',
    name: 'Ureia',
    price: 2500,
    n: 45,
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
  {
    id: 'm2',
    type: 'macro',
    name: 'MAP',
    price: 3200,
    n: 11,
    p: 52,
    k: 0,
    s: 0,
    ca: 0,
    microGuarantees: [],
    minQty: 50,
    maxQty: 1000,
    selected: true,
    quantity: 0,
  },
  {
    id: 'm3',
    type: 'macro',
    name: 'KCL',
    price: 2800,
    n: 0,
    p: 0,
    k: 60,
    s: 0,
    ca: 0,
    microGuarantees: [],
    minQty: 50,
    maxQty: 1000,
    selected: true,
    quantity: 0,
  },
  {
    id: 'm4',
    type: 'macro',
    name: 'Enchimento (Areia/Calcário)',
    price: 100,
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
];

const defaultMicros: RawMaterial[] = [
  {
    id: 'mi1',
    type: 'micro',
    name: 'Zinco Sulfato',
    price: 5000,
    n: 0,
    p: 0,
    k: 0,
    s: 10,
    ca: 0,
    microGuarantees: [{ name: 'Zn', value: 20 }],
    minQty: 0,
    maxQty: 1000,
    selected: true,
    quantity: 0,
  },
  {
    id: 'mi2',
    type: 'micro',
    name: 'Boro',
    price: 6000,
    n: 0,
    p: 0,
    k: 0,
    s: 0,
    ca: 0,
    microGuarantees: [{ name: 'B', value: 10 }],
    minQty: 0,
    maxQty: 1000,
    selected: true,
    quantity: 0,
  },
];

interface UseCalculatorProps {
  initialData?: PricingRecord | null;
  initialFormulaToLoad?: SavedFormula | null;
  initialBranchId?: string;
  initialPriceListId?: string;
  onClearEditing?: () => void;
  onSaveSuccess?: (record: PricingRecord) => void;
  currentUser: AppUser;
}

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
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);

  const [clientSearch, setClientSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [showAgentResults, setShowAgentResults] = useState(false);

  const [macros, setMacros] = useState<RawMaterial[]>(defaultMacros);
  const [micros, setMicros] = useState<RawMaterial[]>(defaultMicros);
  const [incompatibilityRules, setIncompatibilityRules] = useState<IncompatibilityRule[]>([]);
  const [compCategories, setCompCategories] = useState<any[]>([]);

  const isLocked = initialData && initialData.status !== 'Em Andamento';

  const [factors, setFactors] = useState<PricingFactors>({
    targetFormula: '',
    factor: 0.8,
    discount: 0,
    margin: 0,
    freight: 0,
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
    }
  }, [initialFormulaToLoad, initialBranchId, initialPriceListId]);

  useEffect(() => {
    const loadData = async () => {
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

      if (savedBranches.length > 0 && !factors.branchId) {
        const firstBranch = savedBranches[0];
        const branchLists = savedLists.filter((l: PriceList) => l.branchId === firstBranch.id);
        const lastList = branchLists.length > 0 ? branchLists[0] : null;
        setFactors((prev) => ({
          ...prev,
          branchId: firstBranch.id,
          priceListId: lastList ? lastList.id : '',
        }));
      }
    };
    loadData();
  }, []);

  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');

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

  const handleMacroChange = (id: string, field: keyof RawMaterial, value: any) => {
    const nextMacros = macros.map((m) => (m.id === id ? { ...m, [field]: value } : m));
    setMacros(nextMacros);

    setCalculations(
      calculations.map((calc) => {
        const updatedCalcMacros = (calc.macros.length > 0 ? calc.macros : macros).map((m) =>
          m.id === id ? { ...m, [field]: value } : m
        );
        return {
          ...calc,
          macros: updatedCalcMacros,
        };
      })
    );
  };

  const handleMicroChange = (id: string, field: keyof RawMaterial, value: any) => {
    const nextMicros = micros.map((m) => (m.id === id ? { ...m, [field]: value } : m));
    setMicros(nextMicros);

    setCalculations(
      calculations.map((calc) => {
        const updatedCalcMicros = (calc.micros.length > 0 ? calc.micros : micros).map((m) =>
          m.id === id ? { ...m, [field]: value } : m
        );
        return {
          ...calc,
          micros: updatedCalcMicros,
        };
      })
    );
  };

  const handleFactorChange = (field: keyof PricingFactors, value: any) => {
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
    const freightValue = Number(currentFactors.freight) || 0;

    const finalPrice = basePrice + interestValue + taxValue + commissionValue + freightValue;
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

      const match = calc.formula.match(
        /(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/
      );
      if (!match) return;

      const targetN = parseFloat(match[1].replace(',', '.'));
      const targetP = parseFloat(match[2].replace(',', '.'));
      const targetK = parseFloat(match[3].replace(',', '.'));

      const reqN = targetN * 10;
      const reqP = targetP * 10;
      const reqK = targetK * 10;

      const model: any = {
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

      const results: any = solver.Solve(model);

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
      factors: { ...factors },
      macros: [...macros],
      micros: [...micros],
    };
    setCalculations([...calculations, newCalc]);
  };

  const removeTargetFormula = (id: string) => {
    setCalculations(calculations.filter((c) => c.id !== id));
  };

  const updateCalculation = (id: string, field: keyof TargetFormula, value: any) => {
    setCalculations(
      calculations.map((c) => {
        if (c.id === id) {
          let updatedFormula = { ...c, [field]: value };

          // Se a mudança for na categoria, vamos auto-selecionar os produtos
          if (field === 'category') {
            const isAll = value === 'all';

            const newMacros = macros.map((m) => {
              const isMatch = isAll ? !m.isPremiumLine : m.categories?.includes(value);
              return {
                ...m,
                selected: !!isMatch,
              };
            });

            const newMicros = micros.map((m) => {
              const isMatch = isAll ? false : m.categories?.includes(value);
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

          return updatedFormula;
        }
        return c;
      })
    );
  };

  const handleCalcMicroChange = (
    calcId: string,
    microId: string,
    field: keyof RawMaterial,
    value: any
  ) => {
    setCalculations(
      calculations.map((c) => {
        if (c.id === calcId) {
          return {
            ...c,
            micros: c.micros.map((m) => (m.id === microId ? { ...m, [field]: value } : m)),
          };
        }
        return c;
      })
    );
  };

  const updateCalculationFactors = (id: string, field: keyof PricingFactors, value: any) => {
    setCalculations(
      calculations.map((c) => {
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
    resultingMicros: any,
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

    const updatedCalculations = calculations.map((c) => ({
      ...c,
      formula: getDetailedFormulaName(
        c.formula,
        c.macros,
        c.micros,
        c.summary?.resultingMicros,
        c.targetCa,
        c.targetS,
        c.summary?.resultingCa,
        c.summary?.resultingS
      ),
    }));

    const record: PricingRecord = {
      id: initialData?.id || '',
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

          await createSavedFormula({
            userId: currentUser.id,
            userName: currentUser.name,
            name: name.trim(),
            date: new Date().toISOString(),
            targetFormula: selectedCalc.formula,
            macros: selectedCalc.macros || macros,
            micros: selectedCalc.micros || micros,
          });
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

    // Locked state
    isLocked,

    // Factors
    factors,
    setFactors,

    // Calculations
    calculations,
    setCalculations,

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
    handleCalcMicroChange,
    updateCalculationFactors,
    getDetailedFormulaName,

    // Save functions
    savePricing,
    saveToFormulasList,
  };
}
