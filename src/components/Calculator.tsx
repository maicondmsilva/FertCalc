import React, { useState, useMemo, useEffect } from 'react';
import solver from 'javascript-lp-solver';
import { Plus, Trash2, Save, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Calculator as CalculatorIcon, Building2, Database, Search, User, UserCheck, Tag, LayoutDashboard, Settings, X, Beaker } from 'lucide-react';
import { RawMaterial, PricingFactors, PricingRecord, PricingSummary, Branch, PriceList, Client, Agent, User as AppUser, PricingHistoryEntry, TargetFormula, IncompatibilityRule, SavedFormula } from '../types';
import { getClients, getAgents, getBranches, getPriceLists, getIncompatibilityRules, createPricingRecord, updatePricingRecord, createSavedFormula, getSavedFormulas, updateSavedFormula, createNotification, getUsers, getManagersOfUser, getCompatibilityCategories } from '../services/db';
import { useToast } from './Toast';
import { formatNPK } from '../utils/formatters';
import { FertigranPComparisonModal } from './FertigranPComparisonModal';

const defaultMacros: RawMaterial[] = [
  { id: 'm1', type: 'macro', name: 'Ureia', price: 2500, n: 45, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [], minQty: 50, maxQty: 1000, selected: true, quantity: 0 },
  { id: 'm2', type: 'macro', name: 'MAP', price: 3200, n: 11, p: 52, k: 0, s: 0, ca: 0, microGuarantees: [], minQty: 50, maxQty: 1000, selected: true, quantity: 0 },
  { id: 'm3', type: 'macro', name: 'KCL', price: 2800, n: 0, p: 0, k: 60, s: 0, ca: 0, microGuarantees: [], minQty: 50, maxQty: 1000, selected: true, quantity: 0 },
  { id: 'm4', type: 'macro', name: 'Enchimento (Areia/Calcário)', price: 100, n: 0, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [], minQty: 0, maxQty: 1000, selected: true, quantity: 0 },
];

const defaultMicros: RawMaterial[] = [
  { id: 'mi1', type: 'micro', name: 'Zinco Sulfato', price: 5000, n: 0, p: 0, k: 0, s: 10, ca: 0, microGuarantees: [{ name: 'Zn', value: 20 }], minQty: 0, maxQty: 1000, selected: true, quantity: 0 },
  { id: 'mi2', type: 'micro', name: 'Boro', price: 6000, n: 0, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [{ name: 'B', value: 10 }], minQty: 0, maxQty: 1000, selected: true, quantity: 0 },
];

interface CalculatorProps {
  initialData?: PricingRecord | null;
  initialFormulaToLoad?: SavedFormula | null;
  initialBranchId?: string;
  initialPriceListId?: string;
  onClearEditing?: () => void;
  onSaveSuccess?: (record: PricingRecord) => void;
  currentUser: AppUser;
}

const getAutoWidth = (val: any) => {
  const str = (val ?? '').toString();
  return { width: `${Math.max(str.length + 2, 8)}ch` };
};

export default function Calculator({ initialData, initialFormulaToLoad, initialBranchId, initialPriceListId, onClearEditing, onSaveSuccess, currentUser }: CalculatorProps) {
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<'Em Andamento' | 'Fechada' | 'Perdida'>('Em Andamento');

  const [isFertigranPModalOpen, setIsFertigranPModalOpen] = useState(false);
  const [currentComparisonFormula, setCurrentComparisonFormula] = useState<{formulaName: string, n: number, p: number, k: number} | null>(null);

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
    totalTons: 0
  });

  const [calculations, setCalculations] = useState<TargetFormula[]>([]);

  useEffect(() => {
    if (initialData) {
      setMacros(initialData.macros);
      setMicros(initialData.micros);
      setFactors(initialData.factors);
      const validStatus = (['Em Andamento', 'Fechada', 'Perdida'] as const).includes(initialData.status as any)
        ? initialData.status as 'Em Andamento' | 'Fechada' | 'Perdida'
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
      setFactors(prev => ({
        ...prev,
        targetFormula: initialFormulaToLoad.targetFormula,
        branchId: initialBranchId || prev.branchId,
        priceListId: initialPriceListId || prev.priceListId
      }));
      setCalculations([{
        id: `f_${Date.now()}`,
        formula: initialFormulaToLoad.targetFormula,
        selected: true,
        factors: {
          ...factors,
          targetFormula: initialFormulaToLoad.targetFormula,
          branchId: initialBranchId || factors.branchId,
          priceListId: initialPriceListId || factors.priceListId
        },
        macros: initialFormulaToLoad.macros,
        micros: initialFormulaToLoad.micros
      }]);
    }
  }, [initialFormulaToLoad, initialBranchId, initialPriceListId]);

  useEffect(() => {
    const loadData = async () => {
      const [savedBranches, savedLists, savedClients, savedAgents, savedRules, savedCategories] = await Promise.all([
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
        setFactors(prev => ({
          ...prev,
          branchId: firstBranch.id,
          priceListId: lastList ? lastList.id : ''
        }));
      }
    };
    loadData();
  }, []);

  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');


  // Update prices when list changes
  useEffect(() => {
    if (factors.priceListId) {
      const selectedList = priceLists.find(l => l.id === factors.priceListId);
      if (selectedList) {
        // Macros da Linha Diferenciada chegam desmarcadas por padrão
        setMacros(selectedList.macros.map(m => ({
          ...m,
          selected: m.isPremiumLine ? false : (m.selected ?? true),
          minQty: m.type === 'macro' && !m.name.toLowerCase().includes('enchimento') ? 50 : (m.minQty || 0)
        })));
        // Micros chegam sempre desmarcados — usuário escolhe quais usar
        setMicros(selectedList.micros.map(m => ({ ...m, selected: false, minQty: 0 })));
        setCurrency(selectedList.currency || 'BRL');
      }
    }
  }, [factors.priceListId, priceLists]);

  const handleMacroChange = (id: string, field: keyof RawMaterial, value: any) => {
    const nextMacros = macros.map(m => m.id === id ? { ...m, [field]: value } : m);
    setMacros(nextMacros);
    
    // Sincronizar seleção manual com as fórmulas em andamento para refletir as alterações na calculadora
    setCalculations(calculations.map(calc => {
      // Create new macros array for this calculation, with the updated field for the specific ID
      const updatedCalcMacros = (calc.macros.length > 0 ? calc.macros : macros).map(m => 
        m.id === id ? { ...m, [field]: value } : m
      );
      return {
        ...calc,
        macros: updatedCalcMacros,
        macros: updatedCalcMacros
      };
    }));
  };

  const handleMicroChange = (id: string, field: keyof RawMaterial, value: any) => {
    const nextMicros = micros.map(m => m.id === id ? { ...m, [field]: value } : m);
    setMicros(nextMicros);
    
    // Sincronizar seleção manual com as fórmulas em andamento para refletir as alterações na calculadora
    setCalculations(calculations.map(calc => {
      // Create new micros array for this calculation, with the updated field for the specific ID
      const updatedCalcMicros = (calc.micros.length > 0 ? calc.micros : micros).map(m => 
        m.id === id ? { ...m, [field]: value } : m
      );
      return {
        ...calc,
        micros: updatedCalcMicros,
        micros: updatedCalcMicros
      };
    }));
  };

  const handleFactorChange = (field: keyof PricingFactors, value: any) => {
    // If value is empty string, keep it as empty string in state to allow clearing the input
    // but the calculations should treat it as 0
    setFactors({ ...factors, [field]: value });
  };

  const addMacro = () => {
    setMacros([...macros, { id: Date.now().toString(), type: 'macro', name: '', price: 0, n: 0, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [], minQty: 50, maxQty: 1000, selected: true, quantity: 0 }]);
  };

  const addMicro = () => {
    setMicros([...micros, { id: Date.now().toString(), type: 'micro', name: '', price: 0, n: 0, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [], minQty: 0, maxQty: 1000, selected: true, quantity: 0 }]);
  };

  const removeMacro = (id: string) => setMacros(macros.filter(m => m.id !== id));
  const removeMicro = (id: string) => setMicros(micros.filter(m => m.id !== id));

  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  const [microsInGear, setMicrosInGear] = useState<boolean>(true);

  const calculateFormula = (targetFormulaId?: string) => {
    const formulasToCalculate = targetFormulaId
      ? calculations.filter(c => c.id === targetFormulaId)
      : calculations.filter(c => c.selected);

    if (formulasToCalculate.length === 0 && !targetFormulaId) {
      alert("Selecione ao menos uma fórmula para calcular.");
      return;
    }

    const updatedCalculations = [...calculations];

    formulasToCalculate.forEach(calc => {
      // Usar macros/micros específicos da fórmula se disponíveis (para respeitar seleções por categoria)
      const currentMacros = (calc.macros && calc.macros.length > 0) ? calc.macros : macros;
      const currentMicros = microsInGear ? (calc.micros.length > 0 ? calc.micros : micros) : micros;

      const match = calc.formula.match(/(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/);
      if (!match) return;

      const targetN = parseFloat(match[1].replace(',', '.'));
      const targetP = parseFloat(match[2].replace(',', '.'));
      const targetK = parseFloat(match[3].replace(',', '.'));

      const reqN = targetN * 10;
      const reqP = targetP * 10;
      const reqK = targetK * 10;

      const model: any = {
        optimize: "cost",
        opType: "min",
        constraints: {
          n_eq: { min: reqN, max: reqN + 9 },
          p_eq: { min: reqP, max: reqP + 9 },
          k_eq: { min: reqK, max: reqK + 9 },

          // CA/S targets from the formula's own state fields
          ...(((calc.targetS || 0) > 0) ? { s_eq: { min: (calc.targetS! * 10), max: (calc.targetS! * 10) + 9 } } : {}),
          ...(((calc.targetCa || 0) > 0) ? { ca_eq: { min: (calc.targetCa! * 10), max: (calc.targetCa! * 10) + 9 } } : {}),
          weight: { equal: 1000 },
        },
        variables: {},
        ints: {}
      };

      let availableMaterials = [...currentMacros, ...currentMicros].filter(m => m.selected);

      availableMaterials.forEach(m => {
        const useVar = `use_${m.id}`;
        const minLiner = `link_min_${m.id}`;
        const maxLiner = `link_max_${m.id}`;
        const forcedQty = Number(m.quantity) || 0;
        const isForced = forcedQty > 0;

        model.variables[m.id] = {
          cost: Number(m.price) || 0,
          n_eq: (Number(m.n) || 0) / 100,
          p_eq: (Number(m.p) || 0) / 100,
          k_eq: (Number(m.k) || 0) / 100,
          s_eq: (Number(m.s) || 0) / 100,
          ca_eq: (Number(m.ca) || 0) / 100,
          weight: 1,
          [minLiner]: 1,
          [maxLiner]: 1
        };

        // Se estiver forçado, o solver PRECISA usar exatamente essa quantidade
        if (isForced) {
          model.variables[useVar] = {
            cost: 0,
            [minLiner]: -forcedQty,
            [maxLiner]: -forcedQty,
            [useVar]: 1
          };
          model.constraints[useVar] = { equal: 1 };
        } else {
          // Variável binária normal para controlar se o produto entra ou não (respeitando minQty)
          model.variables[useVar] = {
            cost: 0.01,
            [minLiner]: -(Number(m.minQty) || 0),
            [maxLiner]: -(Number(m.maxQty) || 1000)
          };
          model.ints[useVar] = 1;
        }

        model.ints[useVar] = 1;
        model.constraints[minLiner] = { min: 0 };
        model.constraints[maxLiner] = { max: 0 };
      });

      // Constraints de incompatibilidade (usando as variáveis binárias já definidas)
      incompatibilityRules.forEach((rule, idx) => {
        const matA = availableMaterials.find(m => m.id === rule.materialAId);
        const matB = availableMaterials.find(m => m.id === rule.materialBId);

        if (matA && matB) {
          const constraintName = `incomp_${idx}`;
          model.constraints[constraintName] = { max: 1 };
          if (model.variables[`use_${matA.id}`]) model.variables[`use_${matA.id}`][constraintName] = 1;
          if (model.variables[`use_${matB.id}`]) model.variables[`use_${matB.id}`][constraintName] = 1;
        }
      });

      const results: any = solver.Solve(model);

      if (results.feasible) {
        const calcIndex = updatedCalculations.findIndex(c => c.id === calc.id);
        if (calcIndex !== -1) {
          const newMacros = currentMacros.map(m => ({
            ...m,
            quantity: m.selected ? (results[m.id] || 0) : 0
          }));
          const newMicros = currentMicros.map(m => ({
            ...m,
            quantity: m.selected ? (results[m.id] || 0) : 0
          }));

          updatedCalculations[calcIndex] = {
            ...updatedCalculations[calcIndex],
            macros: newMacros,
            micros: newMicros,
            summary: calculateSummary(newMacros, newMicros, updatedCalculations[calcIndex].factors)
          };
        }
      } else {
        showError(`A formulação ${calc.formula} não fecha com os produtos selecionados. Verifique as restrições ou adicione enchimento.`);
        // Even if not feasible, we keep the previous state but update summary to show what we have
        const calcIndex = updatedCalculations.findIndex(c => c.id === calc.id);
        if (calcIndex !== -1) {
          updatedCalculations[calcIndex] = {
            ...updatedCalculations[calcIndex],
            summary: calculateSummary(updatedCalculations[calcIndex].macros, updatedCalculations[calcIndex].micros, updatedCalculations[calcIndex].factors)
          };
        }
      }
    });

    setCalculations(updatedCalculations);
  };

  const calculateSummary = (currentMacros: RawMaterial[], currentMicros: RawMaterial[], currentFactors: PricingFactors) => {
    const selectedMacros = currentMacros.filter(m => m.selected);
    const selectedMicros = currentMicros.filter(m => m.selected);
    const allSelected = [...selectedMacros, ...selectedMicros];

    let totalWeight = 0;
    let baseCost = 0;
    let totalN_kg = 0;
    let totalP_kg = 0;
    let totalK_kg = 0;
    let totalS_kg = 0;
    let totalCa_kg = 0;
    let resultingMicros: Record<string, number> = {};

    allSelected.forEach(m => {
      const qty = Number(m.quantity) || 0;
      totalWeight += qty;
      baseCost += (qty / 1000) * (Number(m.price) || 0);

      totalN_kg += qty * ((Number(m.n) || 0) / 100);
      totalP_kg += qty * ((Number(m.p) || 0) / 100);
      totalK_kg += qty * ((Number(m.k) || 0) / 100);
      totalS_kg += qty * ((Number(m.s) || 0) / 100);
      totalCa_kg += qty * ((Number(m.ca) || 0) / 100);

      if (m.microGuarantees) {
        m.microGuarantees.forEach(g => {
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
    Object.keys(resultingMicros).forEach(name => {
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

  const addTargetFormula = () => {
    const newCalc: TargetFormula = {
      id: Date.now().toString(),
      formula: '',
      selected: true,
      factors: { ...factors },
      macros: [...macros],
      micros: [...micros]
    };
    setCalculations([...calculations, newCalc]);
  };

  const removeTargetFormula = (id: string) => {
    setCalculations(calculations.filter(c => c.id !== id));
  };

  const updateCalculation = (id: string, field: keyof TargetFormula, value: any) => {
    setCalculations(calculations.map(c => {
      if (c.id === id) {
        let updatedFormula = { ...c, [field]: value };
        
        // Se a mudança for na categoria, vamos auto-selecionar os produtos
        if (field === 'category') {
            const isAll = value === 'all';
            
            // Usamos os macros e micros GLOBAIS como base para garantir que estamos filtrando os dados mais recentes
            const newMacros = macros.map(m => {
                const isMatch = isAll ? !m.isPremiumLine : m.categories?.includes(value);
                return {
                    ...m,
                    selected: !!isMatch
                };
            });
            
            const newMicros = micros.map(m => {
                const isMatch = isAll ? false : m.categories?.includes(value);
                return {
                    ...m,
                    selected: !!isMatch
                };
            });
            
            updatedFormula.macros = newMacros;
            updatedFormula.micros = newMicros;

            // Sincroniza com os estados globais para o usuário ver o feedback visual nas tabelas principais
            setMacros(newMacros);
            setMicros(newMicros);
        }
        
        return updatedFormula;
      }
      return c;
    }));
  };

  const handleCalcMicroChange = (calcId: string, microId: string, field: keyof RawMaterial, value: any) => {
    setCalculations(calculations.map(c => {
      if (c.id === calcId) {
        return {
          ...c,
          micros: c.micros.map(m => m.id === microId ? { ...m, [field]: value } : m)
        };
      }
      return c;
    }));
  };

  const updateCalculationFactors = (id: string, field: keyof PricingFactors, value: any) => {
    setCalculations(calculations.map(c => {
      if (c.id === id) {
        const newFactors = { ...c.factors, [field]: value };
        return {
          ...c,
          factors: newFactors,
          summary: calculateSummary(c.macros, c.micros, newFactors)
        };
      }
      return c;
    }));
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
    macs.forEach(m => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    mics.forEach(m => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    const caParts: string[] = [];
    if ((targetCa || 0) > 0 && (resultingCa || 0) > 0) caParts.push(`CA: ${(resultingCa!).toFixed(2)}%`);
    if ((targetS || 0) > 0 && (resultingS || 0) > 0) caParts.push(`S: ${(resultingS!).toFixed(2)}%`);

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
      action: initialData ? `Editada - Status: ${status}` : 'Criada'
    };

    const updatedCalculations = calculations.map(c => ({
      ...c,
      formula: getDetailedFormulaName(c.formula, c.macros, c.micros, c.summary?.resultingMicros, c.targetCa, c.targetS, c.summary?.resultingCa, c.summary?.resultingS)
    }));

    const record: PricingRecord = {
      id: initialData?.id || '',
      userId: currentUser.id,
      userName: currentUser.name,
      userCode: currentUser.customCode,
      date: initialData?.date || new Date().toISOString(),
      status,
      approvalStatus: initialData?.approvalStatus === 'Reprovada' ? 'Pendente' : (initialData?.approvalStatus || 'Pendente'),
      macros,
      micros,
      factors,
      rejectionObservation: initialData?.approvalStatus === 'Reprovada' ? '' : initialData?.rejectionObservation,
      summary: updatedCalculations.find(c => c.selected)?.summary || {
        totalWeight: 0, baseCost: 0, basePrice: 0, interestValue: 0,
        taxValue: 0, commissionValue: 0, freightValue: 0, finalPrice: 0,
        totalSaleValue: 0, resultingN: 0, resultingP: 0, resultingK: 0,
        resultingS: 0, resultingCa: 0, resultingMicros: {}
      },
      calculations: updatedCalculations,
      history: [...(initialData?.history || []), historyEntry]
    };

    try {
      let savedRecord: PricingRecord;
      const isNew = !initialData;
      const wasApproved = initialData?.approvalStatus === 'Aprovada';
      const wasRejected = initialData?.approvalStatus === 'Reprovada';

      if (initialData) {
        await updatePricingRecord(initialData.id, record);
        savedRecord = { ...record, id: initialData.id };

        if (wasApproved || wasRejected) {
          const managersList = await getManagersOfUser(currentUser.id);
          const approversList = await getUsers();
          const masterAdmins = approversList.filter(u => u.role === 'master' || u.role === 'admin' || (u.permissions as any)?.approvals_canApprove === true);

          const notifyIds = new Set([...managersList.map(m => m.id), ...masterAdmins.map(a => a.id)]);

          for (const targetId of notifyIds) {
            await createNotification({
              userId: targetId,
              title: wasApproved ? 'Precificação Aprovada Alterada' : 'Reenvio de Precificação Reprovada',
              message: wasApproved 
                ? `${currentUser.name} alterou a precificação aprovada para ${factors.client.name}. Revisão necessária para nova aprovação.`
                : `${currentUser.name} corrigiu e reenviou a precificação de ${factors.client.name} que havia sido reprovada.`,
              date: new Date().toISOString(),
              read: false,
              type: 'pricing_approval',
              dataId: initialData.id
            });
          }
        }
      } else {
        savedRecord = await createPricingRecord(record);
        const managersList = await getManagersOfUser(currentUser.id);
        const approversList = await getUsers();
        const masterAdmins = approversList.filter(u => u.role === 'master' || u.role === 'admin' || (u.permissions as any)?.approvals_canApprove === true);

        const notifyIds = new Set([...managersList.map(m => m.id), ...masterAdmins.map(a => a.id)]);

        for (const targetId of notifyIds) {
          await createNotification({
            userId: targetId,
            title: 'Nova Precificação Pendente',
            message: `${currentUser.name} gerou uma nova precificação para ${factors.client.name} que requer aprovação.`,
            date: new Date().toISOString(),
            read: false,
            type: 'pricing_approval',
            dataId: savedRecord.id
          });
        }
      }
      showSuccess(`Precificação ${(wasApproved || wasRejected) ? 'atualizada' : 'salva'} com sucesso!${(wasApproved || wasRejected) ? ' Notificação enviada aos gerentes.' : ''}`);
      setClientSearch('');
      setAgentSearch('');
      if (onClearEditing) onClearEditing();
      if (onSaveSuccess) onSaveSuccess(savedRecord);
    } catch (error) {
      showError('Erro ao salvar precificação.');
      console.error(error);
    }
  };

  const saveToFormulasList = async () => {
    const selectedCalc = calculations.find(c => c.selected);
    if (!selectedCalc) {
      showError('Calcule e selecione uma fórmula para salvar a batida.');
      return;
    }

    const suffixes: string[] = [];
    selectedCalc.macros.forEach(m => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    selectedCalc.micros.forEach(m => {
      if (m.quantity > 0 && m.formulaSuffix) {
        const cleanSuffix = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
        if (cleanSuffix) suffixes.push(cleanSuffix);
      }
    });
    const microSummary = selectedCalc.summary?.resultingMicros || {};

    const defaultName = getDetailedFormulaName(selectedCalc.formula, selectedCalc.macros, selectedCalc.micros, selectedCalc.summary?.resultingMicros);

    const name = prompt('Dê um nome para esta Batida Salva:', defaultName);
    if (!name?.trim()) return;

    try {
      const existing = await getSavedFormulas();

      // Duplication check by NPK + Suffixes + Micros
      const currentSuffixes = Array.from(new Set(suffixes)).sort().join(',');
      const currentFormula = selectedCalc.formula;
      const currentMicros = JSON.stringify(Object.entries(microSummary).filter(([_, v]) => (v as number) > 0).sort());

      const duplicate = existing.find(f => {
        const fSuffixes: string[] = [];
        f.macros.forEach(m => {
          if (m.quantity > 0 && m.formulaSuffix) {
            const clean = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
            if (clean) fSuffixes.push(clean);
          }
        });
        f.micros.forEach(m => {
          if (m.quantity > 0 && m.formulaSuffix) {
            const clean = m.formulaSuffix.replace(/^[Cc]\/\s*/, '').trim();
            if (clean) fSuffixes.push(clean);
          }
        });
        const fSuffixStr = Array.from(new Set(fSuffixes)).sort().join(',');

        const fSummary = calculateSummary(f.macros, f.micros, factors);
        const fMicrosStr = JSON.stringify(Object.entries(fSummary.resultingMicros).filter(([_, v]) => (v as number) > 0).sort());

        return f.targetFormula === currentFormula && fSuffixStr === currentSuffixes && fMicrosStr === currentMicros;
      });

      if (duplicate) {
        if (confirm(`Já existe uma batida salva ("${duplicate.name}") com a mesma composição. Deseja atualizar a batida existente com o novo nome e data?`)) {
          await updateSavedFormula(duplicate.id, {
            name: name.trim(),
            date: new Date().toISOString(),
            targetFormula: selectedCalc.formula,
            macros: selectedCalc.macros || macros,
            micros: selectedCalc.micros || micros
          });
          showSuccess('Batida existente atualizada com sucesso!');
          return;
        }
      }

      // Check for name duplicate separately as it's a constraint in the current prompt logic too
      if (existing.some(f => f.userId === currentUser.id && f.name.trim().toLowerCase() === name.trim().toLowerCase())) {
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
        micros: selectedCalc.micros || micros
      });
      showSuccess('Batida salva com sucesso nas suas Fórmulas!');
    } catch (error: any) {
      console.error('[saveToFormulasList] Erro completo:', error);
      const msg = error?.message || error?.error_description || JSON.stringify(error) || 'Tente novamente.';
      showError(`Erro ao salvar batida: ${msg}`);
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
                  Nova Cotação (Limpar)
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Selection */}
            <div className="md:col-span-2 bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-stone-400" />
                <span className="text-sm font-bold text-stone-600 uppercase">Status da Precificação</span>
              </div>
              <select
                value={status}
                disabled={isLocked}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 focus:ring-2 focus:ring-stone-500 outline-none transition-all ${status === 'Fechada' ? 'bg-emerald-100 border-emerald-200 text-emerald-800' :
                  status === 'Perdida' ? 'bg-red-100 border-red-200 text-red-800' :
                    'bg-blue-100 border-blue-200 text-blue-800'
                  } ${isLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <option value="Em Andamento">Em Andamento</option>
                <option value="Fechada">Fechada</option>
                <option value="Perdida">Perdida</option>
              </select>
            </div>

            {/* Client Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Seleção do Cliente</h3>
              <div className="relative">
                <label className="block text-xs font-medium text-stone-600 mb-1">Buscar Cliente (Nome ou Código)</label>
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
                      .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.code.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(c => (
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
                          <p className="text-[10px] text-stone-500">{c.code} | {c.document}</p>
                        </button>
                      ))}
                  </div>
                )}
                {factors.client.name && (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{factors.client.name}</p>
                      <p className="text-[10px] text-emerald-600">Cód: {factors.client.code} | Doc: {factors.client.document}</p>
                    </div>
                    <button
                      disabled={isLocked}
                      onClick={() => {
                        setFactors({ ...factors, client: { id: '', code: '', name: '', document: '' } });
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
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Seleção do Agente</h3>
              <div className="relative">
                <label className="block text-xs font-medium text-stone-600 mb-1">Buscar Agente (Nome ou Código)</label>
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
                      .filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase()) || a.code.toLowerCase().includes(agentSearch.toLowerCase()))
                      .map(a => (
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
                          <p className="text-[10px] text-stone-500">{a.code} | {a.document}</p>
                        </button>
                      ))}
                  </div>
                )}
                {factors.agent.name && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-blue-800">{factors.agent.name}</p>
                      <p className="text-[10px] text-blue-600">Cód: {factors.agent.code} | Doc: {factors.agent.document}</p>
                    </div>
                    <button
                      disabled={isLocked}
                      onClick={() => {
                        setFactors({ ...factors, agent: { id: '', code: '', name: '', document: '' } });
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-stone-100">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
                <Building2 className="w-4 h-4 mr-1" /> Filial
              </label>
              <select
                value={factors.branchId}
                onChange={(e) => setFactors({ ...factors, branchId: e.target.value, priceListId: '' })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione uma filial</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
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
                {priceLists.filter(l => l.branchId === factors.branchId).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status da Precifica\u00e7\u00e3o \u2014 full-width */}
          <div className="mt-6 pt-6 border-t border-stone-100">
            <label className="block text-sm font-medium text-stone-600 mb-1">Status da Precificação</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="Em Andamento">Em Andamento</option>
              <option value="Fechada">Fechada</option>
              <option value="Perdida">Perdida</option>
            </select>
          </div>

          {/* F\u00f3rmulas Alvo \u2014 full-width below status */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <label className="block text-sm font-medium text-stone-600 mb-2">Fórmulas Alvo</label>
            <div className="space-y-3">
              {calculations.map((calc) => (
                <div key={calc.id} className="relative p-2 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
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
                        onChange={(e) => updateCalculation(calc.id, 'targetCa', e.target.value === '' ? 0 : Number(e.target.value))}
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
                        onChange={(e) => updateCalculation(calc.id, 'targetS', e.target.value === '' ? 0 : Number(e.target.value))}
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
                      {compCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nome}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setExpandedCalc(expandedCalc === calc.id ? null : calc.id)}
                      className={`p-1.5 rounded transition-colors ${expandedCalc === calc.id ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
                      title="Fatores e Micronutrientes"
                    >
                      <Settings className="w-3.5 h-3.5" />
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

                  {/* Expanded Gear Panel \u2014 absolute, extends right toward summary */}
                  {expandedCalc === calc.id && (
                    <div
                      className="absolute left-0 z-40 p-3 bg-white rounded-lg border border-stone-300 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-1"
                      style={{ top: '100%', width: 'min(800px, calc(100vw - 2rem))', marginTop: '4px' }}
                    >
                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <div className="flex items-center gap-4">
                          <h4 className="text-xs font-bold text-stone-500 uppercase">⚙ {calc.formula || 'Fórmula'}</h4>
                          {calc.summary && (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager' || (currentUser.permissions as any)?.calculator_fertigranP !== false) && (
                            <button
                              onClick={() => {
                                setCurrentComparisonFormula({
                                  formulaName: calc.formula,
                                  n: calc.summary!.resultingN,
                                  p: calc.summary!.resultingP,
                                  k: calc.summary!.resultingK
                                });
                                setIsFertigranPModalOpen(true);
                              }}
                              className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition-colors flex items-center"
                            >
                              Comparar com Fertigran P
                            </button>
                          )}
                        </div>
                        <button onClick={() => setExpandedCalc(null)} className="text-stone-400 hover:text-stone-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Fatores Comerciais */}
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Fatores Comerciais</p>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Fator (×)</label>
                            <input type="number" step="0.01" value={calc.factors.factor}
                              onChange={(e) => updateCalculationFactors(calc.id, 'factor', Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Desconto (R$/t)</label>
                            <input type="number" value={calc.factors.discount === 0 ? '' : calc.factors.discount}
                              onChange={(e) => updateCalculationFactors(calc.id, 'discount', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Alíquota (%)</label>
                            <input type="number" step="0.1" value={calc.factors.taxRate === 0 ? '' : calc.factors.taxRate}
                              onChange={(e) => updateCalculationFactors(calc.id, 'taxRate', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Comissão (%)</label>
                            <input type="number" step="0.1" value={calc.factors.commission === 0 ? '' : calc.factors.commission}
                              onChange={(e) => updateCalculationFactors(calc.id, 'commission', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Frete (R$/t)</label>
                            <input type="number" value={calc.factors.freight === 0 ? '' : calc.factors.freight}
                              onChange={(e) => updateCalculationFactors(calc.id, 'freight', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Juros Mensal (%)</label>
                            <input type="number" step="0.01" value={calc.factors.monthlyInterestRate === 0 ? '' : calc.factors.monthlyInterestRate}
                              onChange={(e) => updateCalculationFactors(calc.id, 'monthlyInterestRate', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Qtd Total (Tons)</label>
                            <input type="number" step="0.01" value={calc.factors.totalTons === 0 ? '' : calc.factors.totalTons}
                              onChange={(e) => updateCalculationFactors(calc.id, 'totalTons', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Vencimento</label>
                            <input type="date" value={calc.factors.dueDate || ''}
                              onChange={(e) => updateCalculationFactors(calc.id, 'dueDate', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div className="flex items-center pt-4">
                            <input type="checkbox" id={`exempt-${calc.id}`} checked={calc.factors.exemptCurrentMonth}
                              onChange={(e) => updateCalculationFactors(calc.id, 'exemptCurrentMonth', e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 mr-2" />
                            <label htmlFor={`exempt-${calc.id}`} className="text-[10px] font-bold text-stone-500 uppercase">Isentar juros mês atual</label>
                          </div>
                        </div>
                      </div>

                      {/* Resultado Real */}
                      {calc.summary && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Resultado Real</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                              N-P-K: {formatNPK(calc.formula, calc.summary.resultingN, calc.summary.resultingP, calc.summary.resultingK)}
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
                          </div>
                        </div>
                      )}

                      {/* Matérias-Primas Utilizadas */}
                      {calc.summary && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Matérias-Primas Utilizadas</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                            {[...calc.macros, ...calc.micros].filter(m => m.quantity > 0).map(m => (
                              <div key={m.id} className="flex justify-between text-[11px] bg-stone-50 px-2 py-1 rounded">
                                <span className="text-stone-600 font-medium truncate pr-1">{m.name}</span>
                                <span className="text-emerald-600 font-bold shrink-0">{m.quantity.toFixed(1)} kg</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Micro Guarantees */}
                      {calc.summary?.resultingMicros && Object.keys(calc.summary.resultingMicros).length > 0 && (
                        <div className="pt-2 border-t border-stone-100">
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Garantias de Micros</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(calc.summary.resultingMicros).map(([name, val]) => (
                              <div key={name} className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                <span className="text-[10px] font-bold text-stone-600">{name}:</span>
                                <span className="text-[10px] font-bold text-blue-600">{(val as number).toFixed(3)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Micronutrients Table IN GEAR */}
                      {microsInGear && calc.micros.length > 0 && (
                        <div className="pt-4 border-t border-stone-200 mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[12px] font-bold text-stone-700 flex items-center">
                              <Building2 className="w-4 h-4 mr-1 text-stone-500" />
                              Micronutrientes da Fórmula
                            </p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-stone-600">
                              <thead className="bg-stone-50 text-stone-500">
                                <tr>
                                  <th className="px-2 py-2 w-16">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={calc.micros.length > 0 && calc.micros.every(m => m.selected)}
                                        onChange={(e) => updateCalculation(calc.id, 'micros', calc.micros.map(m => ({ ...m, selected: e.target.checked })))}
                                        className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`}
                                      />
                                      <span>Usar</span>
                                    </div>
                                  </th>
                                  <th className="px-2 py-2 min-w-[120px]">M. Prima</th>
                                  <th className="px-2 py-2 w-20">Preço ({currency === 'BRL' ? 'R$' : 'US$'})</th>
                                  <th className="px-2 py-2">Garantias Micros</th>
                                  <th className="px-1 py-1 w-16">Min(kg)</th>
                                  <th className="px-1 py-1 w-16">Max(kg)</th>
                                  <th className="px-2 py-2 w-20">Qtd(kg)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {calc.micros.map((m) => (
                                  <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                                    <td className="px-2 py-1">
                                      <input type="checkbox" checked={m.selected} disabled={isLocked} onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'selected', e.target.checked)} className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`} />
                                    </td>
                                    <td className="px-2 py-1"><input type="text" value={m.name || ''} disabled={isLocked} onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'name', e.target.value)} className={`w-full border-stone-200 rounded px-1 py-1 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`} /></td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={m.price === 0 ? '' : m.price}
                                        placeholder="0"
                                        disabled={isLocked}
                                        onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                                        className={`w-full border-stone-200 rounded px-1 py-1 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <div className="space-y-1">
                                        {m.microGuarantees.map((g, idx) => (
                                          <div key={idx} className="flex gap-1 items-center">
                                            <input
                                              type="text"
                                              value={g.name || ''}
                                              disabled={isLocked}
                                              onChange={(e) => {
                                                const newG = [...m.microGuarantees];
                                                newG[idx].name = e.target.value;
                                                handleCalcMicroChange(calc.id, m.id, 'microGuarantees', newG);
                                              }}
                                              style={getAutoWidth(g.name)}
                                              className={`border-stone-200 rounded px-1 py-0.5 text-[10px] ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                              placeholder="Nome"
                                            />
                                            <input
                                              type="number"
                                              value={g.value === 0 ? '' : g.value}
                                              disabled={isLocked}
                                              onChange={(e) => {
                                                const newG = [...m.microGuarantees];
                                                newG[idx].value = e.target.value === '' ? 0 : Number(e.target.value);
                                                handleCalcMicroChange(calc.id, m.id, 'microGuarantees', newG);
                                              }}
                                              style={getAutoWidth(g.value)}
                                              className={`border-stone-200 rounded px-1 py-0.5 text-[10px] ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                              placeholder="%"
                                            />
                                            {!isLocked && (
                                              <button
                                                onClick={() => {
                                                  const newG = m.microGuarantees.filter((_, i) => i !== idx);
                                                  handleCalcMicroChange(calc.id, m.id, 'microGuarantees', newG);
                                                }}
                                                className="text-red-400 hover:text-red-600"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        {!isLocked && (
                                          <button
                                            onClick={() => {
                                              const newG = [...m.microGuarantees, { name: '', value: 0 }];
                                              handleCalcMicroChange(calc.id, m.id, 'microGuarantees', newG);
                                            }}
                                            className="text-[9px] text-emerald-600 hover:underline flex items-center"
                                          >
                                            <Plus className="w-2 h-2 mr-0.5" /> Adicionar
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={m.minQty === 0 ? '' : m.minQty}
                                        placeholder="0"
                                        disabled={isLocked}
                                        onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'minQty', e.target.value === '' ? 0 : Number(e.target.value))}
                                        className={`w-full border-stone-200 rounded px-1 py-1 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={m.maxQty === 0 ? '' : m.maxQty}
                                        placeholder="0"
                                        disabled={isLocked}
                                        onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'maxQty', e.target.value === '' ? 0 : Number(e.target.value))}
                                        className={`w-full border-stone-200 rounded px-1 py-1 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={m.quantity === 0 ? '' : m.quantity}
                                        placeholder="0"
                                        disabled={isLocked}
                                        onChange={(e) => handleCalcMicroChange(calc.id, m.id, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                                        className={`w-full border-emerald-300 rounded px-1 py-1 text-xs focus:ring-emerald-500 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                        <p className="text-xs font-bold text-emerald-600">R$ {calc.summary.finalPrice.toFixed(2)}</p>
                      </div>
                      <div className="text-center border-x border-stone-100">
                        <p className="text-[8px] text-stone-400 uppercase font-bold">N-P-K Real</p>
                        <p className="text-xs font-bold text-indigo-600">
                          {formatNPK(calc.formula, calc.summary.resultingN, calc.summary.resultingP, calc.summary.resultingK)}
                        </p>
                        {((calc.summary.resultingCa || 0) > 0 || (calc.summary.resultingS || 0) > 0) && (
                          <p className="text-[9px] text-stone-500">
                            {(calc.summary.resultingCa || 0) > 0 && `CA:${calc.summary.resultingCa.toFixed(1)}%`}
                            {(calc.summary.resultingCa || 0) > 0 && (calc.summary.resultingS || 0) > 0 && ' '}
                            {(calc.summary.resultingS || 0) > 0 && `S:${calc.summary.resultingS.toFixed(1)}%`}
                          </p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] text-stone-400 uppercase font-bold">Custo Base</p>
                        <p className="text-xs font-bold text-stone-700">R$ {calc.summary.baseCost.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={addTargetFormula}
                className="w-full py-2 border-2 border-dashed border-stone-300 rounded-lg text-stone-500 hover:border-emerald-500 hover:text-emerald-600 transition-all text-xs font-bold flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar Fórmula Alvo
              </button>
              {(calculations.some(c => c.selected) || macros.some(m => m.selected) || micros.some(m => m.selected)) && (
                <button
                  onClick={() => calculateFormula()}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                >
                  Calcular Selecionadas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Macronutrients */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-stone-800 mb-3">Macronutrientes</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMicrosInGear(v => !v)}
                title={microsInGear ? 'Micros na engrenagem (clique para tabela separada)' : 'Micros em tabela separada (clique para mover para engrenagem)'}
                className={`text-xs px-2 py-1 rounded border font-bold transition-colors flex items-center gap-1 ${microsInGear
                  ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                  : 'bg-stone-100 border-stone-300 text-stone-600 hover:bg-stone-200'
                  }`}
              >
                <Settings className="w-3 h-3" />
                {microsInGear ? 'Micros: ⚙' : 'Micros: tabela'}
              </button>
              {!isLocked && (
                <button onClick={addMacro} className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 flex items-center">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </button>
              )}
            </div>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-stone-500 uppercase bg-stone-50">
              <tr>
                <th className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={macros.length > 0 && macros.every(m => m.selected)}
                      onChange={(e) => setMacros(macros.map(m => ({ ...m, selected: e.target.checked })))}
                      className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`}
                    />
                    <span>Usar</span>
                  </div>
                </th>
                <th className="px-2 py-2 min-w-[150px]">M. Prima</th>
                <th className="px-2 py-2 w-20">Preço ({currency === 'BRL' ? 'R$' : 'US$'})</th>
                <th className="px-1 py-2 w-16">N%</th>
                <th className="px-1 py-2 w-16">P%</th>
                <th className="px-1 py-2 w-16">K%</th>
                <th className="px-1 py-2 w-16">S%</th>
                <th className="px-1 py-2 w-16">Ca%</th>
                <th className="px-1 py-2 w-20">Min(kg)</th>
                <th className="px-1 py-2 w-20">Max(kg)</th>
                <th className="px-2 py-2 w-24">Qtd(kg)</th>
                <th className="px-1 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {[
                ...macros.filter(m => !m.isPremiumLine).map(m => ({ m, itemType: 'normal' })),
                ...(macros.some(m => m.isPremiumLine) ? [{ itemType: 'header', id: 'premium-header' } as any] : []),
                ...macros.filter(m => m.isPremiumLine).map(m => ({ m, itemType: 'premium' }))
              ].map((row: any) => {
                if (row.itemType === 'header') {
                  return (
                    <tr key="premium-header"><td colSpan={12} className="px-3 py-1.5 bg-amber-50 border-t border-amber-200">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">⭐ Linha Diferenciada / Premium</span>
                    </td></tr>
                  );
                }
                const m = row.m as RawMaterial;
                return (
                  <tr key={m.id} className={`border-b border-stone-100 ${row.itemType === 'premium' ? 'bg-amber-50/40' : 'hover:bg-stone-50/50'}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={m.selected} disabled={isLocked} onChange={(e) => handleMacroChange(m.id, 'selected', e.target.checked)} className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`} />
                  </td>
                  <td className="px-3 py-2"><input type="text" value={m.name || ''} disabled={isLocked} onChange={(e) => handleMacroChange(m.id, 'name', e.target.value)} className={`w-full border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`} /></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.price === 0 ? '' : m.price}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.price)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.n === 0 ? '' : m.n}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'n', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.n)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.p === 0 ? '' : m.p}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'p', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.p)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.k === 0 ? '' : m.k}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'k', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.k)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.s === 0 ? '' : m.s}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 's', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.s)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.ca === 0 ? '' : m.ca}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'ca', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.ca)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.minQty === 0 ? '' : m.minQty}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'minQty', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.minQty)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.maxQty === 0 ? '' : m.maxQty}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'maxQty', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.maxQty)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.quantity === 0 ? '' : m.quantity}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMacroChange(m.id, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.quantity)}
                      className={`border-emerald-300 rounded px-2 py-1 focus:ring-emerald-500 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!isLocked && (
                      <button onClick={() => removeMacro(m.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Micronutrients */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-stone-800 mb-3">Micronutrientes</h2>
            {!isLocked && (
              <button onClick={addMicro} className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 flex items-center">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </button>
            )}
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-stone-500 uppercase bg-stone-50">
              <tr>
                <th className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={micros.length > 0 && micros.every(m => m.selected)}
                      onChange={(e) => setMicros(micros.map(m => ({ ...m, selected: e.target.checked })))}
                      className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`}
                    />
                    <span>Usar</span>
                  </div>
                </th>
                <th className="px-2 py-2 min-w-[150px]">M. Prima</th>
                <th className="px-2 py-2 w-20">Preço ({currency === 'BRL' ? 'R$' : 'US$'})</th>
                <th className="px-2 py-2">Garantias Micros</th>
                <th className="px-1 py-1 w-20">Min(kg)</th>
                <th className="px-1 py-1 w-20">Max(kg)</th>
                <th className="px-2 py-2 w-24">Qtd(kg)</th>
                <th className="px-1 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {micros.map((m) => (
                <tr key={m.id} className="border-b border-stone-100">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={m.selected} disabled={isLocked} onChange={(e) => handleMicroChange(m.id, 'selected', e.target.checked)} className={`rounded text-emerald-600 focus:ring-emerald-500 ${isLocked ? 'cursor-not-allowed' : ''}`} />
                  </td>
                  <td className="px-3 py-2"><input type="text" value={m.name || ''} disabled={isLocked} onChange={(e) => handleMicroChange(m.id, 'name', e.target.value)} className={`w-full border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`} /></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.price === 0 ? '' : m.price}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMicroChange(m.id, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.price)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {m.microGuarantees.map((g, idx) => (
                        <div key={idx} className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={g.name || ''}
                            disabled={isLocked}
                            onChange={(e) => {
                              const newG = [...m.microGuarantees];
                              newG[idx].name = e.target.value;
                              handleMicroChange(m.id, 'microGuarantees', newG);
                            }}
                            style={getAutoWidth(g.name)}
                            className={`border-stone-200 rounded px-1 py-0.5 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                            placeholder="Nome"
                          />
                          <input
                            type="number"
                            value={g.value === 0 ? '' : g.value}
                            disabled={isLocked}
                            onChange={(e) => {
                              const newG = [...m.microGuarantees];
                              newG[idx].value = e.target.value === '' ? 0 : Number(e.target.value);
                              handleMicroChange(m.id, 'microGuarantees', newG);
                            }}
                            style={getAutoWidth(g.value)}
                            className={`border-stone-200 rounded px-1 py-0.5 text-xs ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                            placeholder="%"
                          />
                          {!isLocked && (
                            <button
                              onClick={() => {
                                const newG = m.microGuarantees.filter((_, i) => i !== idx);
                                handleMicroChange(m.id, 'microGuarantees', newG);
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {!isLocked && (
                        <button
                          onClick={() => {
                            const newG = [...m.microGuarantees, { name: '', value: 0 }];
                            handleMicroChange(m.id, 'microGuarantees', newG);
                          }}
                          className="text-[10px] text-emerald-600 hover:underline flex items-center"
                        >
                          <Plus className="w-3 h-3 mr-0.5" /> Add Garantia
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.minQty === 0 ? '' : m.minQty}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMicroChange(m.id, 'minQty', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.minQty)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.maxQty === 0 ? '' : m.maxQty}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMicroChange(m.id, 'maxQty', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.maxQty)}
                      className={`border-stone-200 rounded px-2 py-1 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={m.quantity === 0 ? '' : m.quantity}
                      placeholder="0"
                      disabled={isLocked}
                      onChange={(e) => handleMicroChange(m.id, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))}
                      style={getAutoWidth(m.quantity)}
                      className={`border-emerald-300 rounded px-2 py-1 focus:ring-emerald-500 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!isLocked && (
                      <button onClick={() => removeMicro(m.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Observação Comercial (para PDF)</h2>
          <textarea
            value={factors.commercialObservation || ''}
            disabled={isLocked}
            onChange={(e) => handleFactorChange('commercialObservation', e.target.value)}
            className={`w-full px-3 py-2 border border-stone-300 rounded-lg h-24 ${isLocked ? 'bg-stone-50 cursor-not-allowed' : ''}`}
            placeholder="Ex: Condições de pagamento especiais..."
          />
        </div>
      </div>

      {/* Summary Panel */}
      <div className="space-y-6">
        <div className="bg-stone-900 text-white p-6 rounded-xl shadow-lg sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <h2 className="text-xl font-bold mb-6 border-b border-stone-700 pb-4">Resumo das Fórmulas</h2>

          <div className="space-y-6">
            {calculations.filter(c => c.summary).map((calc) => (
              <div key={calc.id} className="p-4 bg-stone-800 rounded-xl border border-stone-700 space-y-4">
                <div className="flex justify-between items-center border-b border-stone-700 pb-2">
                  <span className="text-emerald-400 font-bold">{calc.formula}</span>
                  <span className="text-xs text-stone-500">#{calc.id.slice(-4)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase font-bold">Preço Final</p>
                    <p className="text-lg font-bold text-white">R$ {calc.summary?.finalPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-stone-500 uppercase font-bold">N-P-K Real</p>
                    <p className="text-sm font-mono text-emerald-400">
                      {formatNPK(calc.formula, calc.summary?.resultingN || 0, calc.summary?.resultingP || 0, calc.summary?.resultingK || 0)}
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
                    <span className="text-stone-300">R$ {calc.summary?.totalSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Materials List in Summary */}
                <div className="pt-2 border-t border-stone-700">
                  <p className="text-[9px] text-stone-500 uppercase font-bold mb-1">Composição (kg)</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {[...calc.macros, ...calc.micros].filter(m => m.quantity > 0).map(m => (
                      <div key={m.id} className="flex justify-between text-[9px]">
                        <span className="text-stone-400 truncate pr-1">{m.name}</span>
                        <span className="text-emerald-500 font-mono">{m.quantity.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {calculations.filter(c => c.summary).length === 0 && (
              <div className="py-8 text-center text-stone-500 italic text-sm">
                Nenhum cálculo realizado ainda.
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-stone-700">
            {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.calculator_savePricing !== false) && (
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
            {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.calculator_saveFormula !== false) && (
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
                id: `f_${Date.now()}` 
              }
            ]);
            showSuccess('Receita Fertigran adicionada na Precificação!');
          }}
        />
      )}
    </div>
  );
}
