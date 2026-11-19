import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  Calculator as CalculatorIcon,
  Database,
  FlaskConical,
  MapPin,
  Plus,
} from 'lucide-react';
import type { Embalagem, SavedFormula, TargetFormula, User as AppUser } from '../../types';
import { useCalculator } from '../../hooks/useCalculator';
import { useToast } from '../Toast';
import { CalculatorSettingsModal } from '../CalculatorSettingsModal';
import { FertigranPComparisonModal } from '../FertigranPComparisonModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import { getEmbalagens } from '../../services/embalagensService';
import { getSavedFormulas } from '../../services/db';
import {
  getProdutosFormulados,
  type ProdutoFormulado,
} from '../../services/produtosFormuladosService';
import { isValidExchangeRate } from '../../utils/priceListCurrency';
import {
  buildAppliedComparisonCalculation,
  buildFormulaComparisonAlternatives,
  type FormulaComparisonAlternative,
} from '../../utils/formulaComparison';
import BetaFormulaCard from './BetaFormulaCard';

interface SimplifiedCalculatorBetaProps {
  currentUser: AppUser;
}

/**
 * Página de teste do novo layout da Calculadora Simplificada.
 * Usa o mesmo motor e as mesmas regras da página oficial (hook useCalculator),
 * mas com a interface redesenhada. Não salva precificação, somente batidas.
 */
export default function SimplifiedCalculatorBeta({ currentUser }: SimplifiedCalculatorBetaProps) {
  const { showSuccess, showError } = useToast();
  const calculator = useCalculator({ currentUser });
  const {
    confirmState,
    handleConfirm,
    handleCancel,
    promptState,
    setPromptState,
    isSettingsOpen,
    activeFormulaId,
    closeSettings,
    isFertigranPModalOpen,
    setIsFertigranPModalOpen,
    currentComparisonFormula,
    setCurrentComparisonFormula,
    priceLists,
    locaisCarregamento,
    macros,
    micros,
    compCategories,
    incompatibilityRules,
    isMaterialsLoading,
    hasNoMaterialsInDatabase,
    factors,
    setFactors,
    calculations,
    setCalculations,
    handleFactorChange,
    calculateFormula,
    addTargetFormula,
    isSavingFormula,
    saveToFormulasList,
  } = calculator;

  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [produtosFormulados, setProdutosFormulados] = useState<ProdutoFormulado[]>([]);
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>([]);
  const [exchangeRateInput, setExchangeRateInput] = useState('');
  const [comparisonSelections, setComparisonSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getEmbalagens(true)
      .then(setEmbalagens)
      .catch(() => {});
    getProdutosFormulados()
      .then(setProdutosFormulados)
      .catch(() => {});
    getSavedFormulas()
      .then(setSavedFormulas)
      .catch(() => {});
  }, []);

  const permissions = (currentUser.permissions || {}) as Record<string, unknown>;
  const isManagerOrAbove =
    currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager';
  const canCompareFormulas = isManagerOrAbove || permissions.calculator_fertigranP !== false;
  const canSaveFormula = isManagerOrAbove || permissions.calculator_saveFormula !== false;

  const isUsdPriceList = factors.priceListCurrency === 'USD';
  const hasValidExchangeRate = !isUsdPriceList || isValidExchangeRate(factors.appliedExchangeRate);
  const selectedPriceList = priceLists.find((list) => list.id === factors.priceListId);

  useEffect(() => {
    setExchangeRateInput(
      String(factors.appliedExchangeRate ?? factors.priceListExchangeRate ?? '').replace('.', ',')
    );
    // Mesma regra da calculadora oficial: o campo acompanha a lista selecionada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factors.priceListCurrency, factors.priceListExchangeRate, factors.priceListId]);

  const updateAppliedExchangeRate = (rawValue: string, source: 'list' | 'manual') => {
    setExchangeRateInput(rawValue);
    const parsedValue = Number(rawValue.replace(',', '.'));
    const appliedExchangeRate = isValidExchangeRate(parsedValue) ? parsedValue : undefined;
    setFactors((previous) => ({
      ...previous,
      appliedExchangeRate,
      exchangeRateSource: appliedExchangeRate ? source : undefined,
    }));
    setCalculations((previous) =>
      previous.map((calculation) => ({
        ...calculation,
        factors: {
          ...calculation.factors,
          appliedExchangeRate,
          exchangeRateSource: appliedExchangeRate ? source : undefined,
        },
        summary: undefined,
      }))
    );
  };

  const pendingIssues = [
    !factors.priceListId ? 'Selecione a lista de preço' : '',
    !hasValidExchangeRate ? 'Informe um câmbio válido para a lista em dólar' : '',
    calculations.length === 0 ? 'Adicione ao menos uma fórmula' : '',
  ].filter(Boolean);

  const comparisonAlternatives = useMemo(() => {
    const alternatives: Record<string, FormulaComparisonAlternative[]> = {};
    calculations.forEach((calculation) => {
      const selectedCategoryIds = comparisonSelections[calculation.id] || [];
      if (!calculation.summary || selectedCategoryIds.length === 0) return;
      alternatives[calculation.id] = buildFormulaComparisonAlternatives({
        sourceCalculation: calculation,
        availableMacros: macros,
        availableMicros: micros,
        categories: compCategories,
        selectedCategoryIds,
        reductions: { n: 0, p: 0, k: 0 },
        incompatibilityRules,
      }).sort((left, right) => {
        if (left.feasible !== right.feasible) return left.feasible ? -1 : 1;
        return (
          (left.calculation.summary?.baseCost ?? Number.POSITIVE_INFINITY) -
          (right.calculation.summary?.baseCost ?? Number.POSITIVE_INFINITY)
        );
      });
    });
    return alternatives;
  }, [calculations, compCategories, comparisonSelections, incompatibilityRules, macros, micros]);

  const toggleComparisonCategory = (calculationId: string, categoryId: string) => {
    setComparisonSelections((current) => {
      const selected = current[calculationId] || [];
      return {
        ...current,
        [calculationId]: selected.includes(categoryId)
          ? selected.filter((id) => id !== categoryId)
          : [...selected, categoryId],
      };
    });
  };

  const applyComparisonAlternative = (
    sourceCalculationId: string,
    alternative: FormulaComparisonAlternative
  ) => {
    const comparisonCalculation = buildAppliedComparisonCalculation({
      alternative,
      hectares: 0,
      sourceDose: 0,
      targetNutrientsPerHectare: { n: 0, p: 0, k: 0 },
    });
    if (!comparisonCalculation) {
      showError('Esta categoria não possui uma composição viável para ser aplicada.');
      return;
    }
    const sourceCalculation = calculations.find(({ id }) => id === sourceCalculationId);
    setCalculations((current) => [
      ...current,
      {
        ...comparisonCalculation,
        id: `f_${Date.now()}`,
        selected: true,
        factors: {
          ...comparisonCalculation.factors,
          totalTons:
            sourceCalculation?.factors.totalTons ?? comparisonCalculation.factors.totalTons,
        },
      },
    ]);
    showSuccess(`Alternativa ${alternative.categoryName} adicionada como nova fórmula.`);
  };

  const duplicateCalculation = (calculation: TargetFormula) => {
    setCalculations((current) => [
      ...current,
      {
        ...calculation,
        id: `f_${Date.now()}`,
        selected: true,
        summary: undefined,
        approximation: undefined,
        profitabilityAnalysis: undefined,
        macros: calculation.macros.map((material) => ({ ...material, quantity: 0 })),
        micros: calculation.micros.map((material) => ({ ...material, quantity: 0 })),
        produtos_livres: calculation.produtos_livres?.map((product) => ({ ...product })),
        factors: { ...calculation.factors },
      },
    ]);
  };

  const selectedCount = calculations.filter((calculation) => calculation.selected).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-black text-violet-950">
              Calculadora Simplificada · página de teste
            </p>
            <p className="text-sm text-violet-800">
              Novo layout em avaliação. Usa as mesmas regras e preços da calculadora oficial.
            </p>
          </div>
        </div>
        <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 sm:self-center">
          Mg segue a regra de Ca e S
        </span>
      </div>

      {/* Dados da batida */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
              <MapPin className="h-4 w-4" /> Local de carregamento
            </span>
            <select
              value={factors.local_carregamento_id || ''}
              onChange={(event) => {
                const localId = event.target.value;
                const matchingList = priceLists
                  .filter((list) => list.local_carregamento_id === localId)
                  .slice()
                  .sort(
                    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
                  )[0];
                setFactors((previous) => ({
                  ...previous,
                  local_carregamento_id: localId || undefined,
                }));
                handleFactorChange('priceListId', matchingList?.id || '');
              }}
              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Todos os locais —</option>
              {locaisCarregamento.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                  {local.cidade
                    ? ` — ${local.cidade}${local.estado ? `/${local.estado}` : ''}`
                    : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
              <Database className="h-4 w-4" /> Lista de preço
            </span>
            <select
              value={factors.priceListId}
              onChange={(event) => handleFactorChange('priceListId', event.target.value)}
              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione uma lista</option>
              {(factors.local_carregamento_id
                ? priceLists.filter(
                    (list) => list.local_carregamento_id === factors.local_carregamento_id
                  )
                : priceLists
              ).map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isUsdPriceList && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-blue-900">Lista em dólar (USD)</p>
              <p className="mt-1 text-sm text-blue-700">
                Câmbio da lista:{' '}
                <strong>
                  {isValidExchangeRate(factors.priceListExchangeRate)
                    ? Number(factors.priceListExchangeRate).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })
                    : 'não informado'}
                </strong>
                {selectedPriceList ? ` · ${selectedPriceList.name}` : ''}
              </p>
              {factors.exchangeRateSource === 'manual' &&
                isValidExchangeRate(factors.priceListExchangeRate) && (
                  <button
                    type="button"
                    onClick={() =>
                      updateAppliedExchangeRate(String(factors.priceListExchangeRate), 'list')
                    }
                    className="mt-1 text-sm font-bold text-blue-800 underline"
                  >
                    Restaurar câmbio da lista
                  </button>
                )}
            </div>
            <label className="block w-full sm:w-56">
              <span className="mb-1 block text-xs font-bold text-blue-900">
                Câmbio utilizado (R$/US$)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={exchangeRateInput}
                onChange={(event) => updateAppliedExchangeRate(event.target.value, 'manual')}
                placeholder="Ex.: 5,18"
                className={`h-11 w-full rounded-xl border px-3 text-[15px] font-bold focus:outline-none focus:ring-2 ${
                  hasValidExchangeRate
                    ? 'border-blue-300 bg-white text-blue-950 focus:ring-blue-400'
                    : 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400'
                }`}
              />
            </label>
          </div>
        )}

        {pendingIssues.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pendingIssues.join(' · ')}</span>
          </div>
        )}
      </section>

      {isMaterialsLoading && (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Carregando matérias-primas cadastradas…
        </p>
      )}
      {!isMaterialsLoading && hasNoMaterialsInDatabase && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Nenhuma matéria-prima cadastrada. Acesse o cadastro de produtos para adicionar.
        </p>
      )}

      {/* Fórmulas */}
      <div className="space-y-5">
        {calculations.map((calculation, index) => (
          <BetaFormulaCard
            key={calculation.id}
            calculation={calculation}
            index={index}
            calculator={calculator}
            embalagens={embalagens}
            produtosFormulados={produtosFormulados}
            savedFormulas={savedFormulas}
            canCompareFormulas={canCompareFormulas}
            comparisonCategoryIds={comparisonSelections[calculation.id] || []}
            comparisonAlternatives={comparisonAlternatives[calculation.id] || []}
            onToggleComparisonCategory={(categoryId) =>
              toggleComparisonCategory(calculation.id, categoryId)
            }
            onApplyComparisonAlternative={(alternative) =>
              applyComparisonAlternative(calculation.id, alternative)
            }
            onOpenReductionSimulation={() => {
              setCurrentComparisonFormula(calculation);
              setIsFertigranPModalOpen(true);
            }}
            onDuplicate={() => duplicateCalculation(calculation)}
          />
        ))}
        {calculations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-[15px] text-stone-500">
            Nenhuma fórmula ainda. Use <strong>Adicionar fórmula</strong> para começar.
          </div>
        )}
      </div>

      {/* Barra de ações da página */}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={addTargetFormula}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
        >
          <Plus className="h-4 w-4" /> Adicionar fórmula
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => calculateFormula()}
            disabled={selectedCount === 0}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <CalculatorIcon className="h-4 w-4" /> Calcular selecionadas ({selectedCount})
          </button>
          {canSaveFormula && (
            <button
              type="button"
              onClick={saveToFormulasList}
              disabled={isSavingFormula || promptState.isOpen}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Beaker className="h-4 w-4" />
              {isSavingFormula ? 'Salvando batida…' : 'Salvar nova batida'}
            </button>
          )}
        </div>
      </div>

      {currentComparisonFormula && (
        <FertigranPComparisonModal
          isOpen={isFertigranPModalOpen}
          onClose={() => setIsFertigranPModalOpen(false)}
          sourceCalculation={currentComparisonFormula}
          currentUser={currentUser}
          macros={macros}
          micros={micros}
          incompatibilityRules={incompatibilityRules}
          onApplyFertigranP={(newFormula) => {
            setCalculations((current) => [...current, { ...newFormula, id: `f_${Date.now()}` }]);
            showSuccess('Alternativa comparada adicionada como nova fórmula.');
          }}
        />
      )}
      <CalculatorSettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        formula={calculations.find((calculation) => calculation.id === activeFormulaId) || null}
        globalMacros={macros}
        globalMicros={micros}
        isMaterialsLoading={isMaterialsLoading}
        hasNoMaterialsInDatabase={hasNoMaterialsInDatabase}
        protectedMaterialIds={[]}
        currency={factors.priceListCurrency ?? 'BRL'}
        onConfirm={(updatedFormula) => {
          setCalculations((current) =>
            current.map((calculation) =>
              calculation.id === updatedFormula.id ? updatedFormula : calculation
            )
          );
        }}
      />
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <PromptDialog
        isOpen={promptState.isOpen}
        title={promptState.title || 'Salvar Batida'}
        message={promptState.message || 'Dê um nome para esta Batida Salva:'}
        defaultValue={promptState.defaultValue}
        placeholder={promptState.placeholder}
        confirmLabel={promptState.confirmLabel || 'Salvar'}
        onConfirm={promptState.onConfirm}
        onCancel={() => setPromptState((previous) => ({ ...previous, isOpen: false }))}
      />
    </div>
  );
}

export type BetaCalculator = ReturnType<typeof useCalculator>;
