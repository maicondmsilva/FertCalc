import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Calculator as CalculatorIcon,
  Check,
  CheckCircle2,
  Copy,
  FlaskConical,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  TrendingUp,
} from 'lucide-react';
import type { Embalagem, SavedFormula, TargetFormula } from '../../types';
import type { ProdutoFormulado } from '../../services/produtosFormuladosService';
import type { FormulaComparisonAlternative } from '../../utils/formulaComparison';
import { getCalculationMode } from '../../utils/calculationMode';
import { formatGuarantee } from '../../utils/formatters';
import { NPK_UPPER_TOLERANCE, SECONDARY_UPPER_TOLERANCE } from '../../domain/pricing-engine';
import {
  formatMicronutrientLabel,
  getCalculatedMicronutrientValue,
  getCatalogMicronutrientNames,
  getMicronutrientTargetStatus,
  getMissingSelectedMicronutrientSources,
  isMagnesiumGuarantee,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
} from '../../utils/micronutrients';
import {
  applyMagnesiumTarget,
  applySavedFormulaToCalculation,
  buildCompositionTable,
  composeFormulaTarget,
  findProductsMatchingNpk,
  formatKg,
  formatMoney,
  formatPercent,
  getFormulaMagnesiumTarget,
  getNutrientStatus,
  isSameFormulaTarget,
  isValidNutrientInput,
  splitFormulaTarget,
  type NpkDraft,
  type NutrientStatus,
} from './betaCalculatorModel';
import BetaConditionsPanel from './BetaConditionsPanel';
import GuaranteeSumStrip from './GuaranteeSumStrip';
import { isZeroText } from '../ui/NumericInput';
import { buildGuaranteeBreakdown, type GuaranteeRow } from '../../utils/guaranteeBreakdown';
import type { BetaCalculator } from './SimplifiedCalculatorBeta';

type Panel = 'conditions' | 'micros' | 'compare' | null;

interface BetaFormulaCardProps {
  calculation: TargetFormula;
  index: number;
  calculator: BetaCalculator;
  embalagens: Embalagem[];
  produtosFormulados: ProdutoFormulado[];
  savedFormulas: SavedFormula[];
  canCompareFormulas: boolean;
  comparisonCategoryIds: string[];
  comparisonAlternatives: FormulaComparisonAlternative[];
  onToggleComparisonCategory: (categoryId: string) => void;
  onApplyComparisonAlternative: (alternative: FormulaComparisonAlternative) => void;
  onOpenReductionSimulation: () => void;
  onDuplicate: () => void;
  /** Abre a análise de rentabilidade; ausente quando o usuário não tem permissão. */
  onOpenProfitability?: () => void;
}

const NUTRIENT_STYLES = {
  N: { label: 'Nitrogênio', text: 'text-blue-700', box: 'border-blue-200 bg-blue-50' },
  P: { label: 'Fósforo', text: 'text-orange-700', box: 'border-orange-200 bg-orange-50' },
  K: { label: 'Potássio', text: 'text-violet-700', box: 'border-violet-200 bg-violet-50' },
  Ca: { label: 'Cálcio', text: 'text-amber-700', box: 'border-amber-300 bg-amber-50' },
  S: { label: 'Enxofre', text: 'text-yellow-700', box: 'border-yellow-300 bg-yellow-50' },
  Mg: { label: 'Magnésio', text: 'text-teal-700', box: 'border-teal-200 bg-teal-50' },
} as const;

type NutrientKey = keyof typeof NUTRIENT_STYLES;

const STATUS_BADGE: Record<NutrientStatus, { text: string; className: string } | null> = {
  none: null,
  pending: null,
  met: { text: 'no alvo', className: 'text-emerald-700' },
  above: { text: 'acima', className: 'text-amber-700' },
  below: { text: 'abaixo', className: 'text-red-700' },
};

function RailButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  tone = 'default',
  badge,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  badge?: number;
  disabled?: boolean;
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700'
      : tone === 'danger'
        ? 'text-red-700 hover:bg-red-50'
        : active
          ? 'border-stone-300 bg-white text-stone-900 shadow-sm'
          : 'text-stone-600 hover:bg-white hover:text-stone-900';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={tone === 'default' ? active : undefined}
      className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1 py-2 text-center text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-tight">{label}</span>
      {Boolean(badge) && (
        <span className="absolute right-2 top-1.5 rounded-full bg-cyan-700 px-1.5 text-[11px] leading-4 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function GuaranteeTile({
  nutrient,
  obtained,
  target,
  large = false,
}: {
  nutrient: NutrientKey;
  obtained?: number;
  target?: number;
  large?: boolean;
}) {
  const style = NUTRIENT_STYLES[nutrient];
  // N-P-K aceitam até 0,98 acima do alvo; Ca, S e Mg até 0,9.
  const status = getNutrientStatus(
    target,
    obtained,
    large ? NPK_UPPER_TOLERANCE : SECONDARY_UPPER_TOLERANCE
  );
  const badge = STATUS_BADGE[status];
  return (
    <div
      className={`rounded-xl border px-2.5 py-1.5 ${large ? style.box : 'border-stone-200 bg-white'}`}
      title={style.label}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-black ${style.text}`}>{nutrient}</span>
        {badge && (
          <span className={`flex items-center gap-0.5 text-[11px] font-bold ${badge.className}`}>
            {status === 'met' && <Check className="h-3 w-3" />}
            <span className="hidden @2xl:inline">{badge.text}</span>
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-black tabular-nums text-stone-900">
          {obtained === undefined ? '—' : formatGuarantee(obtained)}
          <span className="ml-0.5 text-xs font-bold text-stone-400">%</span>
        </p>
        <span className="truncate text-[11px] text-stone-500">
          {Number(target) > 0 ? `alvo ${formatGuarantee(target)}` : 'sem alvo'}
        </span>
      </div>
    </div>
  );
}

/**
 * Micro da batida: cartão menor que os macros, só com a sigla. Aparece o que
 * entrou na batida e também o que tem alvo e ficou zerado.
 */
function MicroTile({ row }: { row: GuaranteeRow }) {
  const hasTarget = row.target > 0;
  const status = hasTarget ? getMicronutrientTargetStatus(row.target, row.obtained) : null;
  const tone =
    status === 'met'
      ? 'border-emerald-200 bg-emerald-50'
      : !hasTarget
        ? 'border-cyan-100 bg-cyan-50/60'
        : row.obtained > 0
          ? 'border-amber-200 bg-amber-50'
          : 'border-red-200 bg-red-50';
  return (
    <div
      className={`rounded-lg border px-2 py-1 ${tone}`}
      title={row.obtained > 0 ? undefined : 'Tem alvo, mas nenhum produto da batida tem este micro'}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] font-black text-cyan-800">{row.label}</span>
        <span className="text-sm font-black tabular-nums text-stone-900">
          {formatGuarantee(row.obtained)}
          <span className="ml-0.5 text-[10px] font-bold text-stone-400">%</span>
        </span>
      </div>
      <p className="flex items-center justify-end gap-0.5 text-[10px] leading-tight text-stone-500">
        {status === 'met' && (
          <Check className="h-2.5 w-2.5 text-emerald-700" aria-label="no alvo" />
        )}
        {hasTarget ? `alvo ${formatGuarantee(row.target)}` : 'sem alvo'}
      </p>
    </div>
  );
}

export default function BetaFormulaCard({
  calculation,
  index,
  calculator,
  embalagens,
  produtosFormulados,
  savedFormulas,
  canCompareFormulas,
  comparisonCategoryIds,
  comparisonAlternatives,
  onToggleComparisonCategory,
  onApplyComparisonAlternative,
  onOpenReductionSimulation,
  onDuplicate,
  onOpenProfitability,
}: BetaFormulaCardProps) {
  const {
    macros,
    micros,
    catalogMacros,
    catalogMicros,
    compCategories,
    setCalculations,
    updateCalculation,
    setCalculationMode,
    calculateFormula,
    removeTargetFormula,
    openSettings,
    applyFormulaApproximation,
    addProdutoLivreToCalculation,
    updateProdutoLivreQuantity,
    removeProdutoLivreFromCalculation,
  } = calculator;

  const [panel, setPanel] = useState<Panel>(null);
  const [npkDraft, setNpkDraft] = useState<NpkDraft>(() => splitFormulaTarget(calculation.formula));
  const [loadSearch, setLoadSearch] = useState('');
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [microInputs, setMicroInputs] = useState<Record<string, string>>({});
  const [secondaryInputs, setSecondaryInputs] = useState<Record<string, string>>({});
  const [productSearch, setProductSearch] = useState('');

  const isFreeProducts = getCalculationMode(calculation) === 'produtos_livres';
  const summary = calculation.summary;
  const currency = summary?.currency ?? calculation.factors?.priceListCurrency ?? 'BRL';
  const magnesiumTarget = getFormulaMagnesiumTarget(calculation);

  // Mantém os campos N-P-K em sincronia quando a fórmula muda por fora
  // (batida carregada, sugestão aplicada, troca de modo).
  useEffect(() => {
    // Compara pelo valor numérico para não apagar uma vírgula ainda sem decimais ("4,").
    setNpkDraft((current) =>
      isSameFormulaTarget(current, calculation.formula)
        ? current
        : splitFormulaTarget(calculation.formula)
    );
  }, [calculation.formula]);

  const composition = useMemo(() => buildCompositionTable(calculation), [calculation]);

  const availableProducts = useMemo(
    () =>
      [
        ...(calculation.macros.length > 0 ? calculation.macros : macros),
        ...(calculation.micros.length > 0 ? calculation.micros : micros),
      ]
        .filter((material) => material.name)
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [calculation.macros, calculation.micros, macros, micros]
  );
  const enabledProducts = availableProducts.filter((material) => material.selected);

  const microTargetNames = useMemo(() => {
    const names = new Map(
      getCatalogMicronutrientNames([...catalogMacros, ...catalogMicros])
        .filter((name) => !isMagnesiumGuarantee(name))
        .map((name) => [normalizeMicronutrientKey(name), name])
    );
    Object.keys(calculation.targetMicros || {}).forEach((name) => {
      const key = normalizeMicronutrientKey(name);
      if (
        key &&
        !isSecondaryNutrientGuarantee(name) &&
        !isMagnesiumGuarantee(name) &&
        !names.has(key)
      ) {
        names.set(key, formatMicronutrientLabel(name));
      }
    });
    return Array.from(names.values()).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [calculation.targetMicros, catalogMacros, catalogMicros]);

  const getMicroTarget = (name: string) => {
    const key = normalizeMicronutrientKey(name);
    return Object.entries(calculation.targetMicros || {}).find(
      ([currentName]) => normalizeMicronutrientKey(currentName) === key
    )?.[1];
  };

  const activeMicroTargets = microTargetNames.filter((name) => Number(getMicroTarget(name)) > 0);

  /** Atualiza campos de meta de uma vez (evita perder alterações seguidas). */
  const patchTargets = (patch: Partial<TargetFormula>) => {
    setCalculations((current) =>
      current.map((item) =>
        item.id === calculation.id
          ? {
              ...item,
              ...patch,
              summary: undefined,
              approximation: undefined,
              notClosed: undefined,
            }
          : item
      )
    );
  };

  const updateNpk = (field: keyof NpkDraft, raw: string) => {
    if (!isValidNutrientInput(raw)) return;
    const next = { ...npkDraft, [field]: raw };
    setNpkDraft(next);
    updateCalculation(calculation.id, 'formula', composeFormulaTarget(next));
  };

  const secondaryValue = (nutrient: 'Ca' | 'S' | 'Mg') => {
    if (secondaryInputs[nutrient] !== undefined) return secondaryInputs[nutrient];
    const value =
      nutrient === 'Ca'
        ? calculation.targetCa
        : nutrient === 'S'
          ? calculation.targetS
          : magnesiumTarget;
    return Number(value) > 0 ? String(value).replace('.', ',') : '';
  };

  const updateSecondary = (nutrient: 'Ca' | 'S' | 'Mg', raw: string) => {
    if (!isValidNutrientInput(raw)) return;
    setSecondaryInputs((current) => ({ ...current, [nutrient]: raw }));
    const value = Number(raw.replace(',', '.')) || 0;
    if (nutrient === 'Ca') patchTargets({ targetCa: value });
    else if (nutrient === 'S') patchTargets({ targetS: value });
    else patchTargets(applyMagnesiumTarget(calculation, value));
  };

  const updateMicroTarget = (name: string, raw: string) => {
    if (!/^\d*(?:[.,]\d*)?$/.test(raw)) return;
    setMicroInputs((current) => ({ ...current, [name]: raw }));
    const value = Number(raw.replace(',', '.'));
    const key = normalizeMicronutrientKey(name);
    const next = Object.fromEntries(
      Object.entries(calculation.targetMicros || {}).filter(
        ([currentName]) => normalizeMicronutrientKey(currentName) !== key
      )
    );
    if (raw !== '' && value > 0) next[formatMicronutrientLabel(name)] = value;
    patchTargets({ targetMicros: next });
  };

  const loadProduct = (product: ProdutoFormulado) => {
    const formulaName = product.formula_npk || product.nome;
    const saved = product.saved_formula_id
      ? savedFormulas.find((formula) => formula.id === product.saved_formula_id)
      : undefined;
    setCalculations((current) =>
      current.map((item) =>
        item.id !== calculation.id
          ? item
          : saved
            ? applySavedFormulaToCalculation(item, saved, formulaName)
            : {
                ...item,
                formula: formulaName,
                summary: undefined,
                approximation: undefined,
                notClosed: undefined,
              }
      )
    );
    setSecondaryInputs({});
    setMicroInputs({});
    setLoadSearch('');
    setIsLoadOpen(false);
  };

  const loadResults = useMemo(() => {
    const term = loadSearch.trim().toLowerCase();
    if (!term) return [];
    return produtosFormulados
      .filter(
        (product) =>
          product.ativo &&
          !product.arquivado_em &&
          (product.nome.toLowerCase().includes(term) ||
            (product.formula_npk || '').toLowerCase().includes(term))
      )
      .slice(0, 12);
  }, [loadSearch, produtosFormulados]);

  const npkMatches = useMemo(
    () => findProductsMatchingNpk(produtosFormulados, npkDraft),
    [npkDraft, produtosFormulados]
  );
  const isSearchingByText = loadSearch.trim().length > 0;
  const suggestions = isSearchingByText ? loadResults : npkMatches;
  const showSuggestions = isLoadOpen && (isSearchingByText || npkMatches.length > 0);
  const closeSuggestionsLater = () => setTimeout(() => setIsLoadOpen(false), 200);

  const togglePanel = (next: Exclude<Panel, null>) =>
    setPanel((current) => (current === next ? null : next));

  const statusLabel = calculation.notClosed
    ? { text: 'Não fecha', className: 'bg-red-100 text-red-800' }
    : summary
      ? { text: 'Calculada', className: 'bg-emerald-100 text-emerald-800' }
      : calculation.formula || isFreeProducts
        ? { text: 'Pronta para calcular', className: 'bg-blue-100 text-blue-800' }
        : { text: 'Defina a fórmula', className: 'bg-amber-100 text-amber-800' };

  const target = {
    N: Number(npkDraft.n.replace(',', '.')) || 0,
    P: Number(npkDraft.p.replace(',', '.')) || 0,
    K: Number(npkDraft.k.replace(',', '.')) || 0,
  };

  // Soma de cada garantia na batida (inclusive micros sem meta) e a origem de cada uma.
  const guaranteeBreakdown = useMemo(
    () =>
      buildGuaranteeBreakdown([...(calculation.macros || []), ...(calculation.micros || [])], {
        n: target.N,
        p: target.P,
        k: target.K,
        s: Number(calculation.targetS) || 0,
        ca: Number(calculation.targetCa) || 0,
        mg: magnesiumTarget,
        micros: calculation.targetMicros || {},
      }),
    [
      calculation.macros,
      calculation.micros,
      calculation.targetS,
      calculation.targetCa,
      calculation.targetMicros,
      target.N,
      target.P,
      target.K,
      magnesiumTarget,
    ]
  );
  /**
   * Ca, S e Mg só aparecem se entraram na batida (ou se têm alvo, para
   * mostrar que ficaram zerados).
   */
  const secondaryTiles = (
    [
      { nutrient: 'Ca', obtained: summary?.resultingCa, target: Number(calculation.targetCa) || 0 },
      { nutrient: 'S', obtained: summary?.resultingS, target: Number(calculation.targetS) || 0 },
      { nutrient: 'Mg', obtained: summary?.resultingMg, target: magnesiumTarget },
    ] as const
  ).filter((tile) => Number(tile.obtained) > 0.0001 || tile.target > 0);

  /** Micros que entraram na batida e os que têm alvo (mesmo zerados), nos cartões menores. */
  const microsInBatch = guaranteeBreakdown.filter(
    (row) => row.kind === 'micro' && (row.obtained > 0 || row.target > 0)
  );

  const unpricedProducts = composition.rows.filter((row) => row.isUnpriced);
  const manualPriceProducts = composition.rows.filter(
    (row) => row.isManualPrice && !row.isUnpriced && !row.isCustom
  );
  const customProducts = composition.rows.filter((row) => row.isCustom);
  const margin = summary ? summary.finalPrice - summary.baseCost : 0;
  const marginPercent = summary && summary.baseCost > 0 ? (margin / summary.baseCost) * 100 : 0;

  const freeProducts = (calculation.produtos_livres || [])
    .map((item) => ({
      ...item,
      product: availableProducts.find((product) => product.id === item.productId),
    }))
    .filter((item) => item.product);
  const freeProductResults = productSearch.trim()
    ? availableProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(productSearch.trim().toLowerCase()) &&
          !(calculation.produtos_livres || []).some((item) => item.productId === product.id)
      )
    : [];

  const rail = (
    <>
      <RailButton
        icon={CalculatorIcon}
        label="Calcular"
        tone="primary"
        onClick={() => calculateFormula(calculation.id)}
      />
      <RailButton icon={Package} label="Produtos" onClick={() => openSettings(calculation.id)} />
      <RailButton
        icon={SlidersHorizontal}
        label="Condições"
        active={panel === 'conditions'}
        onClick={() => togglePanel('conditions')}
      />
      {!isFreeProducts && (
        <RailButton
          icon={FlaskConical}
          label="Micros alvo"
          active={panel === 'micros'}
          badge={activeMicroTargets.length}
          onClick={() => togglePanel('micros')}
        />
      )}
      {!isFreeProducts && canCompareFormulas && (
        <RailButton
          icon={ArrowRightLeft}
          label="Comparar"
          active={panel === 'compare'}
          badge={comparisonCategoryIds.length}
          onClick={() => togglePanel('compare')}
        />
      )}
      {onOpenProfitability && (
        <RailButton
          icon={TrendingUp}
          label="Rentabilidade"
          disabled={!summary}
          onClick={onOpenProfitability}
        />
      )}
      <RailButton icon={Copy} label="Duplicar" onClick={onDuplicate} />
      <RailButton
        icon={Trash2}
        label="Remover"
        tone="danger"
        onClick={() => removeTargetFormula(calculation.id)}
      />
    </>
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition @3xl:grid @3xl:grid-cols-[104px_minmax(0,1fr)] ${
        calculation.selected ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-stone-200'
      }`}
    >
      {/* Ações na lateral (computador) */}
      <nav
        aria-label={`Ações da fórmula ${index + 1}`}
        className="hidden flex-col gap-1.5 border-r border-stone-200 bg-stone-50 p-2.5 @3xl:flex"
      >
        {rail}
      </nav>

      <div className="min-w-0 space-y-5 p-4 @3xl:p-5">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={calculation.selected}
              onChange={(event) =>
                updateCalculation(calculation.id, 'selected', event.target.checked)
              }
              className="h-5 w-5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              aria-label={`Selecionar fórmula ${index + 1}`}
            />
            <span className="text-lg font-black text-stone-900">Fórmula {index + 1}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusLabel.className}`}
            >
              {statusLabel.text}
            </span>
          </label>
          <div className="inline-flex rounded-xl bg-stone-100 p-1">
            {(
              [
                ['formulacao', 'Formulação'],
                ['produtos_livres', 'Produtos livres'],
              ] as const
            ).map(([mode, label]) => {
              const active = getCalculationMode(calculation) === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalculationMode(calculation.id, mode)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                    active
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Alvos na mesma linha: N-P-K, secundários, categoria e busca */}
        {!isFreeProducts && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  Fórmula alvo (N-P-K)
                </p>
                <div className="flex items-center gap-1.5">
                  {(['n', 'p', 'k'] as const).map((field, position) => {
                    const nutrient = field.toUpperCase() as 'N' | 'P' | 'K';
                    const style = NUTRIENT_STYLES[nutrient];
                    return (
                      <React.Fragment key={field}>
                        {position > 0 && <span className="font-bold text-stone-300">–</span>}
                        <label
                          className={`flex h-10 w-[82px] items-center gap-1 rounded-lg border px-2 ${style.box}`}
                        >
                          <span className={`text-xs font-black ${style.text}`}>{nutrient}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={npkDraft[field]}
                            onChange={(event) => {
                              updateNpk(field, event.target.value);
                              setIsLoadOpen(true);
                            }}
                            onFocus={() => {
                              setIsLoadOpen(true);
                              // "00" some ao clicar para digitar direto (a fórmula não muda).
                              if (isZeroText(npkDraft[field]))
                                setNpkDraft((current) => ({ ...current, [field]: '' }));
                            }}
                            onBlur={() => {
                              closeSuggestionsLater();
                              setNpkDraft((current) =>
                                current[field].trim() === ''
                                  ? splitFormulaTarget(calculation.formula)
                                  : current
                              );
                            }}
                            placeholder="00"
                            aria-label={`${style.label} alvo`}
                            className={`w-full min-w-0 bg-transparent text-right text-lg font-black tabular-nums placeholder:text-stone-300 focus:outline-none ${style.text}`}
                          />
                        </label>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  {(['Ca', 'S', 'Mg'] as const).map((nutrient) => {
                    const style = NUTRIENT_STYLES[nutrient];
                    return (
                      <label
                        key={nutrient}
                        className={`flex h-10 w-[78px] items-center gap-1 rounded-lg border px-2 ${style.box}`}
                      >
                        <span className={`text-xs font-black ${style.text}`}>{nutrient}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={secondaryValue(nutrient)}
                          onChange={(event) => updateSecondary(nutrient, event.target.value)}
                          onBlur={() =>
                            setSecondaryInputs((current) => {
                              const next = { ...current };
                              delete next[nutrient];
                              return next;
                            })
                          }
                          placeholder="0"
                          aria-label={`${style.label} alvo em porcentagem`}
                          className="w-full min-w-0 bg-transparent text-right text-[15px] font-bold tabular-nums text-stone-900 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-stone-400">%</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <select
                value={calculation.category || 'all'}
                onChange={(event) =>
                  updateCalculation(calculation.id, 'category', event.target.value)
                }
                className="h-10 rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Categoria da fórmula"
              >
                <option value="all">Categoria: Todas</option>
                {compCategories.map((category: { id: string; nome: string }) => (
                  <option key={category.id} value={category.id}>
                    {category.nome}
                  </option>
                ))}
              </select>
              <div className="relative w-full min-w-[150px] sm:w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={loadSearch}
                  onChange={(event) => {
                    setLoadSearch(event.target.value);
                    setIsLoadOpen(true);
                  }}
                  onFocus={() => setIsLoadOpen(true)}
                  onBlur={closeSuggestionsLater}
                  placeholder="Buscar batida ou produto"
                  aria-label="Carregar batida ou produto formulado"
                  className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {showSuggestions && (
                  <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full min-w-[300px] overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
                    {!isSearchingByText && (
                      <p className="border-b border-stone-100 bg-stone-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                        Sugestões pelo N-P-K digitado
                      </p>
                    )}
                    {suggestions.length === 0 ? (
                      <p className="p-3 text-sm text-stone-500">Nenhuma batida encontrada.</p>
                    ) : (
                      suggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => loadProduct(product)}
                          className="block w-full border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"
                        >
                          <span className="block text-sm font-bold text-stone-800">
                            {product.nome}
                          </span>
                          <span className="text-xs text-emerald-700">
                            {product.formula_npk || 'Fórmula não informada'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            {calculation.formula && !composeFormulaTarget(npkDraft) && (
              <p className="mt-1.5 text-sm text-stone-600">
                Produto carregado: <strong>{calculation.formula}</strong>
              </p>
            )}
          </div>
        )}

        {/* Produtos livres: entrada das quantidades */}
        {isFreeProducts && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Pesquisar macro ou micro para adicionar…"
                className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {freeProductResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
                  {freeProductResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        addProdutoLivreToCalculation(calculation.id, product.id);
                        setProductSearch('');
                      }}
                      className="block w-full border-b border-stone-100 px-3 py-2 text-left text-sm font-bold text-stone-800 last:border-0 hover:bg-stone-50"
                    >
                      {product.name}
                      <span className="ml-2 text-xs font-medium text-stone-500">
                        {product.type === 'macro' ? 'Macro' : 'Micro'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {freeProducts.length > 0 && (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {freeProducts.map(({ productId, quantity, product }) => (
                  <li key={productId} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-stone-800">
                      {product?.name}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={quantity === 0 ? '' : quantity}
                      onChange={(event) =>
                        updateProdutoLivreQuantity(
                          calculation.id,
                          productId,
                          event.target.value === '' ? 0 : Number(event.target.value)
                        )
                      }
                      placeholder="0"
                      className="h-10 w-28 rounded-lg border border-stone-300 px-2 text-right text-[15px] font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Quantidade de ${product?.name} em kg`}
                    />
                    <span className="text-sm font-bold text-stone-500">kg</span>
                    <button
                      type="button"
                      onClick={() => removeProdutoLivreFromCalculation(calculation.id, productId)}
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"
                      aria-label={`Remover ${product?.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Painéis abertos pelas ações */}
        {panel === 'conditions' && (
          <BetaConditionsPanel
            calculation={calculation}
            calculator={calculator}
            embalagens={embalagens}
            canSimulateReduction={canCompareFormulas && Boolean(summary)}
            onSimulateReduction={onOpenReductionSimulation}
            onClose={() => setPanel(null)}
          />
        )}

        {panel === 'micros' && !isFreeProducts && (
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-cyan-950">Micros alvo</h3>
                <p className="text-sm text-cyan-800">
                  Garantia mínima de cada micronutriente. O Mg fica junto de Ca e S.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-lg p-1.5 text-cyan-700 hover:bg-cyan-100"
                aria-label="Fechar micros alvo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {microTargetNames.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cyan-200 bg-white px-3 py-2 text-sm text-stone-500">
                Nenhum micronutriente encontrado nos produtos ativos.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3 @4xl:grid-cols-5">
                {microTargetNames.map((name) => {
                  const targetValue = Number(getMicroTarget(name) || 0);
                  const missingSource =
                    targetValue > 0 &&
                    getMissingSelectedMicronutrientSources({ [name]: targetValue }, [
                      ...calculation.macros,
                      ...calculation.micros,
                    ]).length > 0;
                  const calculated = getCalculatedMicronutrientValue(
                    summary?.resultingMicros,
                    name
                  );
                  const status = getMicronutrientTargetStatus(targetValue, calculated);
                  return (
                    <label
                      key={name}
                      className={`rounded-xl border bg-white p-2.5 ${
                        missingSource ? 'border-red-300' : 'border-cyan-200'
                      }`}
                    >
                      <span className="flex items-center justify-between text-sm font-black text-cyan-900">
                        {name}
                        {missingSource && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {status === 'met' && !missingSource && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            microInputs[name] ??
                            (targetValue > 0 ? String(targetValue).replace('.', ',') : '')
                          }
                          onChange={(event) => updateMicroTarget(name, event.target.value)}
                          onBlur={() =>
                            setMicroInputs((current) => {
                              const next = { ...current };
                              delete next[name];
                              return next;
                            })
                          }
                          placeholder="0,00"
                          aria-label={`${name} alvo em porcentagem`}
                          className="h-10 w-full rounded-lg border border-cyan-200 bg-cyan-50 px-2 text-right text-[15px] font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <span className="text-sm font-bold text-stone-400">%</span>
                      </span>
                      {targetValue > 0 && (
                        <span
                          className={`mt-1 block text-xs font-semibold ${
                            missingSource
                              ? 'text-red-600'
                              : status === 'met'
                                ? 'text-emerald-700'
                                : status === 'divergent'
                                  ? 'text-amber-700'
                                  : 'text-stone-500'
                          }`}
                        >
                          {missingSource
                            ? 'Sem produto fonte selecionado'
                            : status === 'pending'
                              ? 'Aguardando cálculo'
                              : `Obtido ${formatGuarantee(calculated)} %`}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {panel === 'compare' && !isFreeProducts && (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-violet-950">Comparar categorias</h3>
                <p className="text-sm text-violet-800">
                  {summary
                    ? 'Escolha as categorias para refazer esta fórmula com outros produtos.'
                    : 'Calcule a fórmula primeiro para comparar.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-lg p-1.5 text-violet-700 hover:bg-violet-100"
                aria-label="Fechar comparação"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {compCategories.map((category: { id: string; nome: string }) => {
                const checked = comparisonCategoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onToggleComparisonCategory(category.id)}
                    aria-pressed={checked}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
                      checked
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-violet-200 bg-white text-violet-800 hover:bg-violet-100'
                    }`}
                  >
                    {category.nome}
                  </button>
                );
              })}
              {compCategories.length === 0 && (
                <p className="text-sm text-stone-500">Nenhuma categoria cadastrada.</p>
              )}
            </div>
            {comparisonAlternatives.length > 0 && (
              <ul className="mt-4 grid gap-2 @3xl:grid-cols-2">
                {comparisonAlternatives.map((alternative) => {
                  const altSummary = alternative.calculation.summary;
                  const difference =
                    altSummary && summary ? altSummary.finalPrice - summary.finalPrice : 0;
                  return (
                    <li
                      key={alternative.categoryId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black text-stone-900">
                          {alternative.categoryName}
                        </p>
                        {alternative.feasible && altSummary ? (
                          <p className="text-sm text-stone-600">
                            {formatMoney(altSummary.finalPrice, currency)}/t ·{' '}
                            <span className={difference <= 0 ? 'text-emerald-700' : 'text-red-700'}>
                              {difference <= 0 ? '' : '+'}
                              {formatMoney(difference, currency)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-red-700">
                            {alternative.issueMessage || 'Sem composição viável.'}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!alternative.feasible}
                        onClick={() => onApplyComparisonAlternative(alternative)}
                        className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-stone-300"
                      >
                        Usar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Fórmula que não fecha: alerta fixo, resultado mais próximo e sugestão */}
        {calculation.notClosed && (
          <section
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
              <div>
                <p className="text-[15px] font-black text-red-950">
                  A fórmula {calculation.formula} não fecha com os produtos selecionados
                </p>
                {calculation.approximation ? (
                  <p className="text-sm text-red-800">
                    Abaixo está o resultado mais próximo, do jeito mais barato:{' '}
                    <strong>{calculation.approximation.suggestedFormula}</strong> · custo base{' '}
                    {formatMoney(calculation.approximation.summary.baseCost, currency)}. Aplique a
                    sugestão ou ajuste a fórmula e os produtos. Não é possível salvar assim.
                  </p>
                ) : (
                  <p className="text-sm text-red-800">
                    Nenhuma composição possível com os produtos selecionados. Ajuste a fórmula ou os
                    produtos.
                  </p>
                )}
              </div>
            </div>
            {calculation.approximation && (
              <button
                type="button"
                onClick={() => applyFormulaApproximation(calculation.id)}
                className="shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800"
              >
                <Sparkles className="mr-1.5 inline h-4 w-4" />
                Aplicar sugestão {calculation.approximation.suggestedFormula}
              </button>
            )}
          </section>
        )}

        {/* Garantias obtidas */}
        {summary && (
          <section>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
              Garantias obtidas
            </p>
            <div className="grid grid-cols-3 gap-2 @4xl:grid-cols-6">
              <GuaranteeTile nutrient="N" obtained={summary.resultingN} target={target.N} large />
              <GuaranteeTile nutrient="P" obtained={summary.resultingP} target={target.P} large />
              <GuaranteeTile nutrient="K" obtained={summary.resultingK} target={target.K} large />
              {secondaryTiles.map((tile) => (
                <GuaranteeTile
                  key={tile.nutrient}
                  nutrient={tile.nutrient}
                  obtained={tile.obtained}
                  target={tile.target}
                />
              ))}
            </div>
            {microsInBatch.length > 0 && (
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 @2xl:grid-cols-6 @4xl:grid-cols-8 @6xl:grid-cols-10">
                {microsInBatch.map((row) => (
                  <MicroTile key={row.key} row={row} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Composição + preços */}
        {summary ? (
          <div className="grid gap-4 @6xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
                <h3 className="text-[15px] font-black text-stone-900">Composição da batida</h3>
                <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  lote de {formatKg(composition.totalQuantity)}
                </span>
              </div>
              {/* Tabela (telas médias e grandes) */}
              <table className="hidden w-full text-[15px] @2xl:table">
                <thead>
                  <tr className="text-right text-xs font-bold uppercase tracking-wide text-stone-500">
                    <th className="px-4 pb-2 pt-3 text-left">Produto</th>
                    <th className="px-3 pb-2 pt-3">Quantidade</th>
                    <th className="px-3 pb-2 pt-3">%</th>
                    <th className="px-3 pb-2 pt-3">Preço do produto</th>
                    <th className="px-4 pb-2 pt-3">Valor na batida</th>
                  </tr>
                </thead>
                <tbody>
                  {composition.rows.map((row) => (
                    <tr key={row.id} className="border-t border-stone-100 text-right tabular-nums">
                      <td className="px-4 py-2.5 text-left font-semibold text-stone-800">
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
                            row.type === 'macro' ? 'bg-emerald-600' : 'bg-cyan-600'
                          }`}
                        />
                        {row.name}
                        {row.isCustom && (
                          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-800">
                            personalizada
                          </span>
                        )}
                        {row.isUnpriced && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                            sem preço
                          </span>
                        )}
                        {row.isManualPrice && !row.isUnpriced && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-800">
                            preço manual
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-black text-stone-900">
                        {formatKg(row.quantity)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                        {formatPercent(row.percent)}
                        <span
                          className="ml-2 inline-block h-1.5 rounded-full bg-emerald-200 align-middle"
                          style={{ width: `${Math.max(2, Math.round(row.percent * 0.8))}px` }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                        {formatMoney(row.price, currency)}/t
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-black text-stone-900">
                        {formatMoney(row.value, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-emerald-200 bg-emerald-50 text-right font-black tabular-nums">
                    <td className="px-4 py-3 text-left">Total</td>
                    <td className="px-3 py-3">{formatKg(composition.totalQuantity)}</td>
                    <td className="px-3 py-3">100</td>
                    <td />
                    <td className="px-4 py-3 text-emerald-800">
                      {formatMoney(composition.totalValue, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {/* Lista (celular) */}
              <ul className="divide-y divide-stone-100 @2xl:hidden">
                {composition.rows.map((row) => (
                  <li key={row.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5">
                    <span className="font-semibold text-stone-800">{row.name}</span>
                    <span className="text-right font-black tabular-nums">
                      {formatMoney(row.value, currency)}
                    </span>
                    <span className="text-sm tabular-nums text-stone-500">
                      {formatKg(row.quantity)} · {formatPercent(row.percent)}%
                    </span>
                    <span className="text-right text-sm tabular-nums text-stone-400">
                      {formatMoney(row.price, currency)}/t
                    </span>
                  </li>
                ))}
                <li className="flex justify-between bg-emerald-50 px-4 py-3 font-black">
                  <span>Total</span>
                  <span className="tabular-nums text-emerald-800">
                    {formatMoney(composition.totalValue, currency)}
                  </span>
                </li>
              </ul>
              <GuaranteeSumStrip rows={guaranteeBreakdown} />
              {(unpricedProducts.length > 0 ||
                manualPriceProducts.length > 0 ||
                customProducts.length > 0) && (
                <div className="space-y-1 border-t border-stone-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {unpricedProducts.length > 0 && (
                    <p>
                      <strong>Sem preço:</strong>{' '}
                      {unpricedProducts.map((row) => row.name).join(', ')}. O custo não inclui esses
                      produtos — informe um valor em Configurar produtos.
                    </p>
                  )}
                  {manualPriceProducts.length > 0 && (
                    <p>
                      <strong>Valor informado por você:</strong>{' '}
                      {manualPriceProducts.map((row) => row.name).join(', ')}.
                    </p>
                  )}
                  {customProducts.length > 0 && (
                    <p>
                      <strong>Matéria-prima personalizada:</strong>{' '}
                      {customProducts.map((row) => row.name).join(', ')} — garantias e preço
                      informados por você.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-2xl bg-gradient-to-b from-[#0f2a1f] to-[#123526] p-4 text-white">
              <div className="grid gap-3 @2xl:grid-cols-2 @6xl:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-200/80">
                    Custo base
                  </p>
                  <p className="mt-0.5 text-2xl font-black tabular-nums">
                    {formatMoney(summary.baseCost, currency)}
                  </p>
                  <p className="text-sm text-emerald-100/70">por tonelada · soma da composição</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3.5 text-emerald-900">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Preço final
                  </p>
                  <p className="mt-0.5 text-[28px] font-black leading-tight tabular-nums">
                    {formatMoney(summary.finalPrice, currency)}
                  </p>
                  <p className="text-sm text-emerald-700">
                    por tonelada
                    {currency === 'USD' && summary.finalPriceBRL !== undefined
                      ? ` · ${formatMoney(summary.finalPriceBRL, 'BRL')}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-emerald-50/80">
                <span>Sobre o custo</span>
                <strong className="whitespace-nowrap text-[15px] tabular-nums text-white">
                  {margin >= 0 ? '+ ' : '− '}
                  {formatMoney(Math.abs(margin), currency)} · {formatPercent(marginPercent)}%
                </strong>
              </div>
              <dl className="space-y-1.5 text-sm text-emerald-50/80">
                {[
                  ['Preço base (fator e ajustes)', summary.basePrice],
                  ['Juros', summary.interestValue],
                  [
                    `Comissão ${formatPercent(calculation.factors.commission, 2)}%`,
                    summary.commissionValue,
                  ],
                  [`Impostos ${formatPercent(calculation.factors.taxRate, 2)}%`, summary.taxValue],
                  [`Frete ${calculation.factors.tipoFrete ?? 'CIF'}`, summary.freightValue],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-3">
                    <dt>{label}</dt>
                    <dd className="font-semibold tabular-nums text-white">
                      {formatMoney(value as number, currency)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-white/15 pt-2">
                  <dt>Total · {formatPercent(calculation.factors.totalTons, 0)} t</dt>
                  <dd className="text-base font-black tabular-nums text-white">
                    {formatMoney(summary.totalSaleValue, currency)}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-[15px] text-stone-500">
            Defina a fórmula e clique em <strong>Calcular</strong> para ver a composição e os
            preços.
          </div>
        )}

        {/* Produtos habilitados (informativo) */}
        {!isFreeProducts && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-3 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Produtos habilitados · {enabledProducts.length}
            </span>
            {enabledProducts.slice(0, 10).map((product) => (
              <span
                key={product.id}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs text-stone-600"
              >
                {product.name}
              </span>
            ))}
            {enabledProducts.length > 10 && (
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs text-stone-600">
                +{enabledProducts.length - 10}
              </span>
            )}
            <button
              type="button"
              onClick={() => openSettings(calculation.id)}
              className="ml-auto text-sm font-bold text-blue-700 hover:underline"
            >
              Editar em Produtos →
            </button>
          </div>
        )}
      </div>

      {/* Ações no rodapé (celular) */}
      <nav
        aria-label={`Ações da fórmula ${index + 1}`}
        className="grid grid-cols-4 gap-1.5 border-t border-stone-200 bg-stone-50 p-2.5 @3xl:hidden"
      >
        {rail}
      </nav>
    </article>
  );
}
