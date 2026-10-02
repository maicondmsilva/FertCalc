import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Calculator,
  Check,
  ArrowRight,
  Save,
  Info,
  TriangleAlert as AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import {
  getFertigranPFormulas,
  saveComparisonHistory,
  getCompatibilityCategories,
} from '../services/db';
import { closeModalOnBackdrop } from '../utils/modalUtils';
import {
  FertigranPFormula,
  User as AppUser,
  RawMaterial,
  TargetFormula,
  CompatibilityCategory,
  IncompatibilityRule,
} from '../types';
import { useToast } from './Toast';
import { calculateTargetFormula } from '../domain/pricing-engine';
import { formatNPK } from '../utils/formatters';
import {
  buildComparisonMaterials,
  buildAppliedComparisonCalculation,
  buildFormulaComparisonAlternatives,
  buildReducedComparisonFormula,
  calculateComparisonDose,
  isFixedComparisonMaterial,
} from '../utils/formulaComparison';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceCalculation: TargetFormula;
  currentUser: AppUser;
  macros: RawMaterial[];
  micros: RawMaterial[];
  incompatibilityRules: IncompatibilityRule[];
  onApplyFertigranP: (calculation: Omit<TargetFormula, 'id'>) => void;
}

export function FertigranPComparisonModal({
  isOpen,
  onClose,
  sourceCalculation,
  currentUser,
  macros,
  micros,
  incompatibilityRules,
  onApplyFertigranP,
}: Props) {
  const { showError } = useToast();
  const originalFormulaName = sourceCalculation.formula;
  const originalN = sourceCalculation.summary?.resultingN || sourceCalculation.targetN || 0;
  const originalP = sourceCalculation.summary?.resultingP || sourceCalculation.targetP || 0;
  const originalK = sourceCalculation.summary?.resultingK || sourceCalculation.targetK || 0;
  const comparisonCurrency = sourceCalculation.factors.priceListCurrency === 'USD' ? 'US$' : 'R$';
  const [hectares, setHectares] = useState<number>(0);
  const [dose, setDose] = useState<number>(0);

  const [reductionN, setReductionN] = useState<number>(0);
  const [reductionP, setReductionP] = useState<number>(0);
  const [reductionK, setReductionK] = useState<number>(0);

  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [localMacros, setLocalMacros] = useState<RawMaterial[]>(
    macros.map((m) => ({ ...m, selected: false }))
  );
  const [localMicros, setLocalMicros] = useState<RawMaterial[]>(
    micros.map((m) => ({ ...m, selected: false }))
  );
  const [commercialFactors, setCommercialFactors] = useState({
    factor: 0.8,
    margin: 0,
    discount: 0,
    freight: 0,
    commission: 0,
  });

  const [formulas, setFormulas] = useState<FertigranPFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');

  const [compCategories, setCompCategories] = useState<CompatibilityCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [comparisonIssue, setComparisonIssue] = useState<string>('');
  const [alternativeSort, setAlternativeSort] = useState<'cost' | 'deviation' | 'category'>('cost');

  const [isSaving, setIsSaving] = useState(false);
  const [applyingAlternativeId, setApplyingAlternativeId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [optimizedDose, setOptimizedDose] = useState<number>(0);
  const [optimizedFormulaTarget, setOptimizedFormulaTarget] = useState<string>('0-0-0');
  const [optimizedComposition, setOptimizedComposition] = useState<
    { material: RawMaterial; qtd: number }[]
  >([]);
  const [resultingGuarantees, setResultingGuarantees] = useState<{
    s: number;
    ca: number;
    micros: { name: string; value: number }[];
  }>({ s: 0, ca: 0, micros: [] });

  useEffect(() => {
    if (isOpen) {
      loadFormulas();
      loadCategories();
      setSaveSuccess(false);
      setSelectedCategoryIds([]);
      setComparisonIssue('');
      setLocalMacros(
        buildComparisonMaterials({ available: macros, source: sourceCalculation.macros })
      );
      setLocalMicros(
        buildComparisonMaterials({ available: micros, source: sourceCalculation.micros })
      );
      setCommercialFactors({
        factor: sourceCalculation.factors.factor,
        margin: sourceCalculation.factors.margin,
        discount: sourceCalculation.factors.discount,
        freight: sourceCalculation.factors.freight,
        commission: sourceCalculation.factors.commission,
      });
    }
  }, [isOpen, macros, micros, sourceCalculation]);

  const toggleCategory = (categoryId: string) => {
    const nextCategoryIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    setSelectedCategoryIds(nextCategoryIds);
    setLocalMacros(
      buildComparisonMaterials({
        available: macros,
        source: sourceCalculation.macros,
        categoryIds: nextCategoryIds,
        includeCategoryCandidates: true,
      })
    );
  };

  const loadCategories = async () => {
    try {
      const data = await getCompatibilityCategories();
      setCompCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadFormulas = async () => {
    try {
      const data = await getFertigranPFormulas();
      setFormulas(data);
    } catch (err) {
      console.error('Error loading formulas:', err);
    }
  };

  const selectedFormula = useMemo(
    () => formulas.find((f) => f.id === selectedFormulaId),
    [formulas, selectedFormulaId]
  );

  // Calculations
  const originalQuantityTons = (hectares * dose) / 1000;

  // Nutrients supplied per HA by original
  const suppliedN = dose * (originalN / 100);
  const suppliedP = dose * (originalP / 100);
  const suppliedK = dose * (originalK / 100);

  // Target nutrients per HA after reduction
  const targetN = suppliedN * (1 - reductionN / 100);
  const targetP = suppliedP * (1 - reductionP / 100);
  const targetK = suppliedK * (1 - reductionK / 100);

  let newDoseValue = 0;
  let newQuantityTons = 0;
  let simulatedProvidedN = 0;
  let simulatedProvidedP = 0;
  let simulatedProvidedK = 0;

  let idealNewN = 0;
  let idealNewP = 0;
  let idealNewK = 0;

  if (dose > 0) {
    idealNewN = (targetN / dose) * 100;
    idealNewP = (targetP / dose) * 100;
    idealNewK = (targetK / dose) * 100;
  }

  const comparisonAlternatives = useMemo(() => {
    const alternatives = buildFormulaComparisonAlternatives({
      sourceCalculation,
      availableMacros: macros,
      availableMicros: micros,
      categories: compCategories,
      selectedCategoryIds,
      reductions: { n: reductionN, p: reductionP, k: reductionK },
      incompatibilityRules,
    });
    return alternatives.sort((left, right) => {
      if (left.feasible !== right.feasible) return left.feasible ? -1 : 1;
      if (alternativeSort === 'category') {
        return left.categoryName.localeCompare(right.categoryName, 'pt-BR');
      }
      if (alternativeSort === 'deviation') return left.deviationScore - right.deviationScore;
      return (
        (left.calculation.summary?.baseCost ?? Number.POSITIVE_INFINITY) -
        (right.calculation.summary?.baseCost ?? Number.POSITIVE_INFINITY)
      );
    });
  }, [
    alternativeSort,
    compCategories,
    incompatibilityRules,
    macros,
    micros,
    reductionK,
    reductionN,
    reductionP,
    selectedCategoryIds,
    sourceCalculation,
  ]);

  // The comparison uses the same orchestration/optimization engine as the calculator.
  useEffect(() => {
    if (!selectedFormulaId && dose > 0 && (targetN > 0 || targetP > 0 || targetK > 0)) {
      const targetFormula = buildReducedComparisonFormula(sourceCalculation, {
        n: reductionN,
        p: reductionP,
        k: reductionK,
      });
      const result = calculateTargetFormula({
        calculation: {
          ...sourceCalculation,
          id: `${sourceCalculation.id}-comparison`,
          formula: targetFormula,
          selected: true,
          modo_calculo: 'formulacao',
          produtos_livres: [],
          macros: localMacros,
          micros: localMicros,
        },
        defaultMacros: localMacros,
        defaultMicros: localMicros,
        microsInGear: true,
        incompatibilityRules,
      });

      if (!result.issue && result.calculation.summary) {
        const summary = result.calculation.summary;
        const comparisonDose = calculateComparisonDose(
          dose,
          { n: targetN, p: targetP, k: targetK },
          { n: summary.resultingN, p: summary.resultingP, k: summary.resultingK }
        );
        const composition = [...result.calculation.macros, ...result.calculation.micros]
          .filter((material) => material.quantity > 0)
          .map((material) => ({ material, qtd: material.quantity }));

        setComparisonIssue('');
        setOptimizedDose(comparisonDose);
        setOptimizedComposition(composition);
        setOptimizedFormulaTarget(
          formatNPK(targetFormula, summary.resultingN, summary.resultingP, summary.resultingK)
        );
        setResultingGuarantees({
          s: summary.resultingS,
          ca: summary.resultingCa,
          micros: Object.entries(summary.resultingMicros).map(([name, value]) => ({
            name,
            value,
          })),
        });
      } else {
        const issue = result.issue;
        setComparisonIssue(
          issue?.code === 'MISSING_MICRO_TARGET_SOURCE'
            ? `Não há fonte selecionada para: ${issue.micronutrients.join(', ')}.`
            : 'A fórmula não fecha com as categorias, mínimos, máximos e produtos fixos selecionados.'
        );
        setOptimizedDose(0);
        setOptimizedComposition([]);
        setResultingGuarantees({ s: 0, ca: 0, micros: [] });
      }
    } else {
      // If a pre-defined formula is selected, we just adjust the dose based on P
      if (selectedFormula && targetP > 0 && selectedFormula.npk_p > 0) {
        setComparisonIssue('');
        const fixedNewDose = targetP / (selectedFormula.npk_p / 100);
        setOptimizedDose(fixedNewDose);
        setOptimizedFormulaTarget(selectedFormula.nome);
        setResultingGuarantees({
          s: selectedFormula.s || 0,
          ca: selectedFormula.ca || 0,
          micros: [],
        });
      } else {
        setComparisonIssue('');
        setOptimizedDose(0);
        setOptimizedComposition([]);
        setResultingGuarantees({ s: 0, ca: 0, micros: [] });
      }
    }
  }, [
    dose,
    incompatibilityRules,
    localMacros,
    localMicros,
    reductionK,
    reductionN,
    reductionP,
    selectedFormula,
    selectedFormulaId,
    sourceCalculation,
    targetK,
    targetN,
    targetP,
  ]);

  if (optimizedDose > 0) {
    newDoseValue = optimizedDose;
    newQuantityTons = (newDoseValue * hectares) / 1000;

    if (selectedFormula) {
      simulatedProvidedN = newDoseValue * (selectedFormula.npk_n / 100);
      simulatedProvidedP = newDoseValue * (selectedFormula.npk_p / 100);
      simulatedProvidedK = newDoseValue * (selectedFormula.npk_k / 100);
    } else {
      simulatedProvidedN = targetN;
      simulatedProvidedP = targetP;
      simulatedProvidedK = targetK;
    }
  }

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveComparisonHistory({
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name,
        formula_original: originalFormulaName || `${originalN}-${originalP}-${originalK}`,
        formula_nova: selectedFormula
          ? selectedFormula.nome
          : `${idealNewN.toFixed(1)}-${idealNewP.toFixed(1)}-${idealNewK.toFixed(1)}`,
        hectares,
        dose_original: dose,
        dose_nova: newDoseValue > 0 ? newDoseValue : dose,
        reducoes_aplicadas: {
          n: reductionN,
          p: reductionP,
          k: reductionK,
          fatores_comerciais: commercialFactors,
          incluir_pdf: includeInPdf,
          composicao: optimizedComposition.map((c) => ({ material: c.material.name, qtd: c.qtd })),
          garantias_finais: resultingGuarantees,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Error saving history:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Erro ao salvar histórico de comparação.';
      showError(`Erro ao salvar histórico: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyAlternative = async (alternative: (typeof comparisonAlternatives)[number]) => {
    if (applyingAlternativeId) return;
    const appliedCalculation = buildAppliedComparisonCalculation({
      alternative,
      hectares,
      sourceDose: dose,
      targetNutrientsPerHectare: { n: targetN, p: targetP, k: targetK },
    });
    if (!appliedCalculation) {
      showError(alternative.issueMessage || 'Esta alternativa não possui uma composição viável.');
      return;
    }

    setApplyingAlternativeId(alternative.categoryId);
    try {
      const summary = alternative.calculation.summary!;
      const alternativeDose = calculateComparisonDose(
        dose,
        { n: targetN, p: targetP, k: targetK },
        { n: summary.resultingN, p: summary.resultingP, k: summary.resultingK }
      );
      await saveComparisonHistory({
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name,
        formula_original: originalFormulaName || `${originalN}-${originalP}-${originalK}`,
        formula_nova: alternative.calculation.formula,
        hectares,
        dose_original: dose,
        dose_nova: alternativeDose > 0 ? alternativeDose : dose,
        reducoes_aplicadas: {
          n: reductionN,
          p: reductionP,
          k: reductionK,
          categoria: alternative.categoryName,
          fatores_comerciais: alternative.calculation.factors,
          incluir_pdf: true,
          composicao: [...alternative.calculation.macros, ...alternative.calculation.micros]
            .filter((material) => material.quantity > 0)
            .map((material) => ({ material: material.name, qtd: material.quantity })),
          garantias_finais: {
            s: summary.resultingS,
            ca: summary.resultingCa,
            micros: Object.entries(summary.resultingMicros).map(([name, value]) => ({
              name,
              value,
            })),
          },
        },
      });
      onApplyFertigranP(appliedCalculation);
      onClose();
    } catch (error) {
      console.error('Erro ao aplicar alternativa comparada:', error);
      showError('Não foi possível registrar e aplicar a alternativa. Tente novamente.');
    } finally {
      setApplyingAlternativeId(null);
    }
  };

  const handleSendToPricing = async () => {
    if (isSaving) return;

    if (optimizedDose <= 0) {
      showError(
        'Nenhum cálculo válido para enviar. A dose resultante deve ser maior que zero. Verifique se o cálculo foi concluído com sucesso.'
      );
      return;
    }

    if (dose === 0 || hectares === 0) {
      showError('Preencha a área (hectares) e a dose original antes de enviar.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await handleSave();

      if (!selectedFormulaId) {
        const matchedFormula = optimizedFormulaTarget.match(
          /(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/
        );
        let nNum = 0,
          pNum = 0,
          kNum = 0;
        if (matchedFormula) {
          nNum = parseFloat(matchedFormula[1].replace(',', '.'));
          pNum = parseFloat(matchedFormula[2].replace(',', '.'));
          kNum = parseFloat(matchedFormula[3].replace(',', '.'));
        }

        const optimizedById = new Map(
          optimizedComposition.map(({ material, qtd }) => [material.id, qtd])
        );
        const applyOptimizedQuantity = (material: RawMaterial): RawMaterial => ({
          ...material,
          selected: optimizedById.has(material.id),
          quantity: optimizedById.get(material.id) || 0,
        });
        const mappedMacros = localMacros.map(applyOptimizedQuantity);
        const mappedMicros = localMicros.map(applyOptimizedQuantity);

        onApplyFertigranP({
          formula: optimizedFormulaTarget,
          selected: includeInPdf,
          targetN: nNum,
          targetP: pNum,
          targetK: kNum,
          targetS: resultingGuarantees.s,
          targetCa: resultingGuarantees.ca,
          targetMicros: sourceCalculation.targetMicros,
          category: sourceCalculation.category,
          macros: mappedMacros,
          micros: mappedMicros,
          factors: {
            ...sourceCalculation.factors,
            targetFormula: optimizedFormulaTarget,
            factor: commercialFactors.factor,
            discount: commercialFactors.discount,
            margin: commercialFactors.margin,
            freight: commercialFactors.freight,
            commission: commercialFactors.commission,
            totalTons: newQuantityTons > 0 ? newQuantityTons : 1000,
          },
        });
      } else if (selectedFormula) {
        onApplyFertigranP({
          formula: selectedFormula.nome,
          selected: includeInPdf,
          targetN: selectedFormula.npk_n,
          targetP: selectedFormula.npk_p,
          targetK: selectedFormula.npk_k,
          targetCa: selectedFormula.ca,
          targetS: selectedFormula.s,
          targetMicros: sourceCalculation.targetMicros,
          category: sourceCalculation.category,
          macros: localMacros,
          micros: localMicros,
          factors: {
            ...sourceCalculation.factors,
            targetFormula: selectedFormula.nome,
            factor: commercialFactors.factor,
            discount: commercialFactors.discount,
            margin: commercialFactors.margin,
            freight: commercialFactors.freight,
            commission: commercialFactors.commission,
            totalTons: newQuantityTons > 0 ? newQuantityTons : 1000,
          },
        });
      } else {
        showError('Fórmula selecionada não encontrada.');
        setIsSaving(false);
        return;
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error('Erro ao enviar para precificação:', err);
      showError('Ocorreu um erro ao enviar os dados para a calculadora.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, isSaving)}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-stone-800">Comparador de Fórmulas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Application Data */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-500 uppercase flex items-center gap-2">
              <span className="bg-stone-200 text-stone-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                1
              </span>
              Dados de Aplicação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="col-span-1 md:col-span-2">
                <p className="text-xs text-stone-500 font-bold mb-1">Fórmula Original</p>
                <div className="px-3 py-2 bg-white border border-stone-300 rounded-lg font-bold text-stone-700">
                  {originalFormulaName || `${originalN}-${originalP}-${originalK}`}
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 font-bold mb-1">
                  Área (Hectares)
                </label>
                <input
                  type="number"
                  value={hectares === 0 ? '' : hectares}
                  onChange={(e) => setHectares(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 font-bold mb-1">
                  Dose Original (kg/ha)
                </label>
                <input
                  type="number"
                  value={dose === 0 ? '' : dose}
                  onChange={(e) => setDose(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <span className="text-sm font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                Volume Original:{' '}
                <span className="text-emerald-700">
                  {originalQuantityTons.toFixed(2)} Toneladas
                </span>
              </span>
            </div>
          </div>

          {/* Section 2: Reductions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-600 uppercase flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                2
              </span>
              Parâmetros de Redução
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
              {/* N */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">
                  Redução Nitrogênio (N) %
                </label>
                <input
                  type="number"
                  value={reductionN === 0 ? '' : reductionN}
                  onChange={(e) => setReductionN(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 10"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>
                    Original:{' '}
                    <strong className="text-stone-700">{suppliedN.toFixed(1)} kg/ha</strong>
                  </p>
                  <p>
                    Alvo: <strong className="text-emerald-700">{targetN.toFixed(1)} kg/ha</strong>
                  </p>
                </div>
              </div>
              {/* P */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">
                  Redução Fósforo (P) %
                </label>
                <input
                  type="number"
                  value={reductionP === 0 ? '' : reductionP}
                  onChange={(e) => setReductionP(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 30"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>
                    Original:{' '}
                    <strong className="text-stone-700">{suppliedP.toFixed(1)} kg/ha</strong>
                  </p>
                  <p>
                    Alvo: <strong className="text-emerald-700">{targetP.toFixed(1)} kg/ha</strong>
                  </p>
                </div>
              </div>
              {/* K */}
              <div>
                <label className="block text-xs text-emerald-700 font-bold mb-1">
                  Redução Potássio (K) %
                </label>
                <input
                  type="number"
                  value={reductionK === 0 ? '' : reductionK}
                  onChange={(e) => setReductionK(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 20"
                />
                <div className="mt-2 text-[10px] text-stone-500">
                  <p>
                    Original:{' '}
                    <strong className="text-stone-700">{suppliedK.toFixed(1)} kg/ha</strong>
                  </p>
                  <p>
                    Alvo: <strong className="text-emerald-700">{targetK.toFixed(1)} kg/ha</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Micro Selection (NEW) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-600 uppercase flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                3
              </span>
              Seleção de Matérias-Primas
            </h3>
            <div className="p-4 bg-amber-50/30 rounded-lg border border-amber-100">
              <p className="text-[10px] text-stone-500 mb-3 font-medium">
                Selecione e informe quantidades (opcional) para a formulação:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {localMacros.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-1 p-2 bg-white border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.selected}
                        disabled={isFixedComparisonMaterial(m)}
                        onChange={(e) => {
                          setLocalMacros((prev) =>
                            prev.map((p) =>
                              p.id === m.id ? { ...p, selected: e.target.checked } : p
                            )
                          );
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-stone-700">
                        {m.name}
                      </span>
                      {isFixedComparisonMaterial(m) && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[8px] font-black text-indigo-700">
                          FIXO
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Qtd. fixa (kg/t)"
                        value={isFixedComparisonMaterial(m) ? m.minQty : ''}
                        onChange={(e) => {
                          const fixedQuantity = Number(e.target.value) || 0;
                          const baseline =
                            sourceCalculation.macros.find(({ id }) => id === m.id) ||
                            macros.find(({ id }) => id === m.id);
                          setLocalMacros((prev) =>
                            prev.map((mm) =>
                              mm.id === m.id
                                ? {
                                    ...mm,
                                    selected: fixedQuantity > 0 || mm.selected,
                                    quantity: fixedQuantity,
                                    minQty:
                                      fixedQuantity > 0 ? fixedQuantity : baseline?.minQty || 0,
                                    maxQty:
                                      fixedQuantity > 0 ? fixedQuantity : baseline?.maxQty || 1000,
                                  }
                                : mm
                            )
                          );
                        }}
                        className="w-full px-2 py-1 text-xs border border-indigo-200 rounded bg-indigo-50 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-[8px] font-mono text-stone-400 shrink-0">
                        {m.n}-{m.p}-{m.k}
                      </span>
                    </div>
                  </div>
                ))}
                {localMicros.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-1 p-2 bg-white border border-amber-100 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.selected}
                        disabled={isFixedComparisonMaterial(m)}
                        onChange={() => {
                          setLocalMicros((prev) =>
                            prev.map((mm) =>
                              mm.id === m.id ? { ...mm, selected: !mm.selected } : mm
                            )
                          );
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-stone-700">
                        {m.name}
                      </span>
                      {isFixedComparisonMaterial(m) && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-700">
                          FIXO
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      placeholder="Qtd. fixa (kg/t)"
                      value={isFixedComparisonMaterial(m) ? m.minQty : ''}
                      onChange={(e) => {
                        const fixedQuantity = Number(e.target.value) || 0;
                        const baseline =
                          sourceCalculation.micros.find(({ id }) => id === m.id) ||
                          micros.find(({ id }) => id === m.id);
                        setLocalMicros((prev) =>
                          prev.map((mm) =>
                            mm.id === m.id
                              ? {
                                  ...mm,
                                  selected: fixedQuantity > 0 || mm.selected,
                                  quantity: fixedQuantity,
                                  minQty: fixedQuantity > 0 ? fixedQuantity : baseline?.minQty || 0,
                                  maxQty:
                                    fixedQuantity > 0 ? fixedQuantity : baseline?.maxQty || 1000,
                                }
                              : mm
                          )
                        );
                      }}
                      className="w-full px-2 py-1 text-xs border border-amber-200 rounded bg-amber-50 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Commercial Factors (NEW) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                4
              </span>
              Fatores Comerciais Personalizados
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">
                  Fator (Ex: 0.8)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={commercialFactors.factor}
                  onChange={(e) =>
                    setCommercialFactors({ ...commercialFactors, factor: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Margem %</label>
                <input
                  type="number"
                  value={commercialFactors.margin}
                  onChange={(e) =>
                    setCommercialFactors({ ...commercialFactors, margin: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Desconto %</label>
                <input
                  type="number"
                  value={commercialFactors.discount}
                  onChange={(e) =>
                    setCommercialFactors({ ...commercialFactors, discount: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">
                  Frete (R$/Ton)
                </label>
                <input
                  type="number"
                  value={commercialFactors.freight}
                  onChange={(e) =>
                    setCommercialFactors({ ...commercialFactors, freight: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 font-bold mb-1">Comissão %</label>
                <input
                  type="number"
                  value={commercialFactors.commission}
                  onChange={(e) =>
                    setCommercialFactors({
                      ...commercialFactors,
                      commission: Number(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Fertigran Selection & Results (was 3) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-600 uppercase flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                5
              </span>
              Resultado e Formulação Final
            </h3>

            <div className="p-4 bg-indigo-50/30 rounded-lg border border-indigo-100 space-y-4">
              {comparisonIssue && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{comparisonIssue}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-xs text-indigo-700 font-bold mb-2">
                    Selecione uma fórmula padrão existente:
                  </label>
                  <select
                    value={selectedFormulaId}
                    onChange={(e) => setSelectedFormulaId(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Fórmula Customizada (Baseada nas reduções e Solver)</option>
                    {formulas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} (N:{f.npk_n} P:{f.npk_p} K:{f.npk_k})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[300px]">
                  <label className="block text-xs text-indigo-700 font-bold mb-2">
                    Categorias candidatas para comparação:
                  </label>
                  <div className="flex min-h-10 flex-wrap gap-2 rounded-lg border border-indigo-200 bg-white p-2">
                    {compCategories.map((cat) => {
                      const active = selectedCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleCategory(cat.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                            active
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          {cat.nome}
                        </button>
                      );
                    })}
                    {compCategories.length === 0 && (
                      <span className="text-xs text-stone-400">Nenhuma categoria cadastrada.</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-stone-500">
                    Produtos já selecionados, micros e quantidades fixas permanecem incluídos.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="includeInPdf"
                    checked={includeInPdf}
                    onChange={(e) => setIncludeInPdf(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <label
                    htmlFor="includeInPdf"
                    className="text-xs font-bold text-stone-700 cursor-pointer"
                  >
                    Aparecer no PDF / Comparativo
                  </label>
                </div>
              </div>

              {!selectedFormulaId && selectedCategoryIds.length > 0 && (
                <div className="space-y-3 rounded-xl border border-indigo-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-indigo-800">
                        Alternativas por categoria
                      </h4>
                      <p className="text-[10px] text-stone-500">
                        Cada categoria é calculada separadamente com os mesmos micros e produtos
                        fixos.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-stone-600">
                      <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
                      <select
                        value={alternativeSort}
                        onChange={(event) =>
                          setAlternativeSort(
                            event.target.value as 'cost' | 'deviation' | 'category'
                          )
                        }
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                      >
                        <option value="cost">Menor custo</option>
                        <option value="deviation">Menor desvio</option>
                        <option value="category">Categoria</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {comparisonAlternatives.map((alternative) => {
                      const summary = alternative.calculation.summary;
                      const composition = [
                        ...alternative.calculation.macros,
                        ...alternative.calculation.micros,
                      ].filter((material) => material.quantity > 0);
                      const costDifference =
                        summary && sourceCalculation.summary
                          ? summary.baseCost - sourceCalculation.summary.baseCost
                          : 0;
                      return (
                        <article
                          key={alternative.categoryId}
                          className={`rounded-xl border p-3 ${
                            alternative.feasible
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-amber-300 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-black text-stone-800">
                                {alternative.categoryName}
                              </h5>
                              <span
                                className={`text-[9px] font-black uppercase ${
                                  alternative.feasible ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {alternative.feasible ? 'Alternativa viável' : 'Inviável'}
                              </span>
                            </div>
                            {summary && (
                              <div className="text-right">
                                <div className="text-sm font-black text-stone-900">
                                  {comparisonCurrency} {summary.baseCost.toFixed(2)}/t
                                </div>
                                <div
                                  className={`text-[9px] font-bold ${
                                    costDifference <= 0 ? 'text-emerald-700' : 'text-red-600'
                                  }`}
                                >
                                  {costDifference >= 0 ? '+' : ''}
                                  {comparisonCurrency} {costDifference.toFixed(2)} vs. original
                                </div>
                              </div>
                            )}
                          </div>

                          {alternative.feasible && summary ? (
                            <>
                              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                                <div className="rounded bg-white p-1">
                                  N <strong>{summary.resultingN.toFixed(2)}%</strong>
                                </div>
                                <div className="rounded bg-white p-1">
                                  P <strong>{summary.resultingP.toFixed(2)}%</strong>
                                </div>
                                <div className="rounded bg-white p-1">
                                  K <strong>{summary.resultingK.toFixed(2)}%</strong>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {Object.entries(summary.resultingMicros).map(([name, value]) => (
                                  <span
                                    key={name}
                                    className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-800"
                                  >
                                    {name}: {value.toFixed(2)}%
                                  </span>
                                ))}
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold text-stone-600">
                                  Desvio: {alternative.deviationScore.toFixed(3)}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 border-t border-emerald-100 pt-2">
                                {composition.slice(0, 5).map((material) => (
                                  <div
                                    key={material.id}
                                    className="flex justify-between text-[10px] text-stone-600"
                                  >
                                    <span className="truncate pr-2">{material.name}</span>
                                    <strong>{material.quantity.toFixed(2)} kg</strong>
                                  </div>
                                ))}
                                {composition.length > 5 && (
                                  <div className="text-[9px] text-stone-400">
                                    + {composition.length - 5} produto(s)
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleApplyAlternative(alternative)}
                                disabled={Boolean(applyingAlternativeId)}
                                className="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {applyingAlternativeId === alternative.categoryId
                                  ? 'Criando cartão…'
                                  : 'Criar novo cartão com esta alternativa'}
                              </button>
                            </>
                          ) : (
                            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 p-2 text-[10px] font-semibold text-amber-900">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {alternative.issueMessage || 'Não foi possível calcular.'}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Result Block */}
                <div className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm">
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-3 text-center">
                    Resultado Reformulado
                  </h4>

                  {selectedFormulaId ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-2xl font-black text-indigo-700">
                          {selectedFormula?.nome}
                        </span>
                        <p className="text-[10px] text-stone-500 mt-1">
                          N:{selectedFormula?.npk_n} P:{selectedFormula?.npk_p} K:
                          {selectedFormula?.npk_k}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <span className="text-sm text-stone-500 font-medium">Nova Dose:</span>
                        <span className="text-lg font-bold text-indigo-700">
                          {newDoseValue.toFixed(1)} kg/ha
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500 font-medium">
                          Novo Volume Mínimo:
                        </span>
                        <span className="text-lg font-bold text-emerald-600">
                          {newQuantityTons.toFixed(2)} Tons
                        </span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded text-xs text-stone-600 space-y-1">
                        <p>
                          <strong>P fornecido:</strong> {simulatedProvidedP.toFixed(1)} kg/ha{' '}
                          <span className="text-[10px]">(Exatamente o alvo)</span>
                        </p>
                        <p>
                          <strong>N fornecido:</strong> {simulatedProvidedN.toFixed(1)} kg/ha{' '}
                          <span className="text-[10px]">
                            ({((simulatedProvidedN / targetN || 1) * 100).toFixed(0)}% do alvo)
                          </span>
                        </p>
                        <p>
                          <strong>K fornecido:</strong> {simulatedProvidedK.toFixed(1)} kg/ha{' '}
                          <span className="text-[10px]">
                            ({((simulatedProvidedK / targetK || 1) * 100).toFixed(0)}% do alvo)
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-2xl font-black text-indigo-700">
                          {dose > 0 ? optimizedFormulaTarget : '0-0-0'}
                        </span>
                        <p className="text-[10px] text-stone-500 mt-1">
                          Fórmula otimizada pelas categorias selecionadas
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <span className="text-sm text-stone-500 font-medium">
                          Nova Dose Otimizada:
                        </span>
                        <span className="text-lg font-bold text-indigo-700">
                          {dose > 0 ? optimizedDose.toFixed(1) : 0} kg/ha
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500 font-medium">
                          Novo Volume Mínimo:
                        </span>
                        <span className="text-lg font-bold text-emerald-600">
                          {newQuantityTons.toFixed(2)} Tons
                        </span>
                      </div>

                      {optimizedComposition.length > 0 && (
                        <div className="mt-3 space-y-3">
                          <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                            <p className="text-[10px] uppercase font-bold text-stone-500 mb-2">
                              Composição da Batida (1.000 kg):
                            </p>
                            <div className="space-y-1">
                              {optimizedComposition.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-xs text-stone-600"
                                >
                                  <span>{item.material.name}</span>
                                  <span className="font-mono text-emerald-600 font-bold">
                                    {item.qtd.toFixed(2)} kg
                                  </span>
                                </div>
                              ))}
                              <div className="pt-1 mt-1 border-t border-stone-200 flex justify-between text-[10px] font-bold text-stone-700">
                                <span>TOTAL BATIDA</span>
                                <span>1.000 kg</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                            <p className="text-[10px] uppercase font-bold text-indigo-500 mb-2">
                              Garantias Resultantes:
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">N Total:</span>
                                <span className="font-bold text-indigo-700">
                                  {((targetN / optimizedDose) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">P₂O₅ Sol. CNA+água:</span>
                                <span className="font-bold text-indigo-700">
                                  {((targetP / optimizedDose) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">K₂O Sol. água:</span>
                                <span className="font-bold text-indigo-700">
                                  {((targetK / optimizedDose) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">S Total:</span>
                                <span className="font-bold text-amber-600">
                                  {resultingGuarantees.s.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-stone-500">Ca Total:</span>
                                <span className="font-bold text-amber-600">
                                  {resultingGuarantees.ca.toFixed(1)}%
                                </span>
                              </div>
                              {resultingGuarantees.micros.map((m, idx) => (
                                <div key={idx} className="flex justify-between text-[10px]">
                                  <span className="text-stone-500">{m.name}:</span>
                                  <span className="font-bold text-emerald-600">
                                    {m.value.toFixed(3)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Comparison Block */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200 shadow-sm flex flex-col justify-center">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase mb-4 text-center">
                    Ganhos de Eficiência
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-600">Redução de Volume:</span>
                      <span className="text-md font-bold text-emerald-700">
                        {newQuantityTons > 0 ? (
                          <>
                            {(originalQuantityTons - newQuantityTons).toFixed(2)} Tons
                            <span className="text-xs ml-1">
                              ({((1 - newQuantityTons / originalQuantityTons) * 100).toFixed(1)}%)
                            </span>
                          </>
                        ) : (
                          '0 Tons (0%)'
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-600">Economia Logística:</span>
                      <span className="text-md font-bold text-emerald-700 text-right">
                        Menos frete, armazenamento
                        <br className="visible md:hidden" /> e paradas na plantadeira
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-stone-50 rounded-b-xl">
          <div>
            {saveSuccess && (
              <span className="text-sm font-bold text-emerald-600 flex items-center">
                <Check className="w-4 h-4 mr-1" /> Histórico Salvo!
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleSendToPricing}
              disabled={isSaving || dose === 0 || hectares === 0}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                'Processando...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Enviar para Precificação
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
