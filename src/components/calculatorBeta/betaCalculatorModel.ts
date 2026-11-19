import type { RawMaterial, SavedFormula, TargetFormula } from '../../types';
import { parseFormulaTarget } from '../../domain/pricing-engine';
import { getMagnesiumTarget, isMagnesiumGuarantee } from '../../utils/micronutrients';

export interface CompositionRow {
  id: string;
  name: string;
  type: RawMaterial['type'];
  quantity: number;
  percent: number;
  price: number;
  value: number;
  isManualPrice: boolean;
  isOutsidePriceList: boolean;
}

export interface CompositionTable {
  rows: CompositionRow[];
  totalQuantity: number;
  totalValue: number;
}

const numeric = (value: unknown): number => Number(value) || 0;

/**
 * Linhas da "Composição da batida": cada produto que entrou na mistura, com a
 * quantidade, a participação no lote e o valor que representa no custo base.
 * A soma dos valores é igual ao custo base calculado pelo motor (kg ÷ 1000 × preço/t).
 */
export function buildCompositionTable(
  calculation: Pick<TargetFormula, 'macros' | 'micros'>
): CompositionTable {
  const used = [...(calculation.macros || []), ...(calculation.micros || [])].filter(
    (material) => material.selected && numeric(material.quantity) > 0
  );
  const totalQuantity = used.reduce((total, material) => total + numeric(material.quantity), 0);
  const rows = used
    .map((material) => {
      const quantity = numeric(material.quantity);
      const price = numeric(material.price);
      return {
        id: material.id,
        name: material.name,
        type: material.type,
        quantity,
        percent: totalQuantity > 0 ? (quantity / totalQuantity) * 100 : 0,
        price,
        value: (quantity / 1000) * price,
        isManualPrice: Boolean(material.isManualPrice),
        isOutsidePriceList: Boolean(material.isOutsidePriceList),
      };
    })
    .sort((left, right) => right.value - left.value || right.quantity - left.quantity);

  return {
    rows,
    totalQuantity,
    totalValue: rows.reduce((total, row) => total + row.value, 0),
  };
}

export interface NpkDraft {
  n: string;
  p: string;
  k: string;
}

const formatTargetNumber = (value: number) =>
  Number.isInteger(value) ? String(value).padStart(2, '0') : String(value).replace('.', ',');

/** Separa a fórmula-alvo nos três campos N, P e K. */
export function splitFormulaTarget(formula?: string): NpkDraft {
  const target = parseFormulaTarget(formula);
  if (!target) return { n: '', p: '', k: '' };
  return {
    n: formatTargetNumber(target.n),
    p: formatTargetNumber(target.p),
    k: formatTargetNumber(target.k),
  };
}

const normalizeDraftNumber = (raw: string) => {
  // "4," ainda está sendo digitado: vale 4 até a casa decimal chegar.
  const value = raw.trim().replace(/[.,]$/, '');
  if (!value) return '00';
  return /^\d$/.test(value) ? value.padStart(2, '0') : value;
};

/** Junta os três campos N, P e K na fórmula usada pelo motor ("04-14-08"). */
export function composeFormulaTarget({ n, p, k }: NpkDraft): string {
  if (![n, p, k].some((value) => value.trim())) return '';
  return [n, p, k].map(normalizeDraftNumber).join('-');
}

/** Indica se o rascunho dos campos e a fórmula representam o mesmo alvo N-P-K. */
export function isSameFormulaTarget(draft: NpkDraft, formula?: string): boolean {
  const fromDraft = parseFormulaTarget(composeFormulaTarget(draft));
  const fromFormula = parseFormulaTarget(formula);
  if (!fromDraft || !fromFormula) return !fromDraft && !fromFormula;
  return (
    fromDraft.n === fromFormula.n && fromDraft.p === fromFormula.p && fromDraft.k === fromFormula.k
  );
}

const draftNumber = (raw: string): number | undefined => {
  const value = raw.trim().replace(/[.,]$/, '');
  return value ? Number(value.replace(',', '.')) : undefined;
};

/**
 * Sugere batidas/produtos formulados cuja fórmula N-P-K combina com o que já foi
 * digitado. Campos vazios não filtram; assim as sugestões aparecem desde o N.
 */
export function findProductsMatchingNpk<
  T extends { ativo?: boolean; arquivado_em?: string; formula_npk?: string },
>(products: T[], draft: NpkDraft, limit = 8): T[] {
  const typed = { n: draftNumber(draft.n), p: draftNumber(draft.p), k: draftNumber(draft.k) };
  if (typed.n === undefined && typed.p === undefined && typed.k === undefined) return [];
  return products
    .filter((product) => {
      if (product.ativo === false || product.arquivado_em) return false;
      const target = parseFormulaTarget(product.formula_npk);
      if (!target) return false;
      return (['n', 'p', 'k'] as const).every(
        (key) => typed[key] === undefined || target[key] === typed[key]
      );
    })
    .slice(0, limit);
}

/** Aceita somente números com até uma vírgula/ponto enquanto o usuário digita. */
export const isValidNutrientInput = (raw: string) => /^\d{0,2}(?:[.,]\d{0,2})?$/.test(raw);

export type NutrientStatus = 'none' | 'pending' | 'met' | 'above' | 'below';

/**
 * Situação da garantia obtida. Abaixo do alvo tolera só arredondamento (0,05);
 * acima, aceita a faixa do nutriente (N-P-K até 0,98; Ca, S e Mg até 0,9).
 */
export function getNutrientStatus(
  target: number | undefined,
  obtained: number | undefined,
  upperTolerance = 0.05
): NutrientStatus {
  if (!(numeric(target) > 0)) return 'none';
  if (obtained === undefined || !Number.isFinite(obtained)) return 'pending';
  const difference = numeric(obtained) - numeric(target);
  if (difference < -0.05) return 'below';
  if (difference > upperTolerance + 0.005) return 'above';
  return 'met';
}

/** Meta de Mg da fórmula: o campo próprio ou, em batidas antigas, a meta entre os micros. */
export function getFormulaMagnesiumTarget(
  calculation: Pick<TargetFormula, 'targetMg' | 'targetMicros'>
): number {
  return numeric(calculation.targetMg) || numeric(getMagnesiumTarget(calculation.targetMicros));
}

/**
 * Atualiza a meta de Mg mantendo também uma cópia entre as metas de micronutrientes.
 * Assim a batida salva continua carregando o Mg nas calculadoras oficiais.
 */
export function applyMagnesiumTarget(
  calculation: TargetFormula,
  value: number
): Pick<TargetFormula, 'targetMg' | 'targetMicros'> {
  const targetMicros = Object.fromEntries(
    Object.entries(calculation.targetMicros || {}).filter(([name]) => !isMagnesiumGuarantee(name))
  );
  if (value > 0) targetMicros.Mg = value;
  return { targetMg: value > 0 ? value : undefined, targetMicros };
}

/**
 * Restaura a composição de uma batida salva na fórmula, mantendo os preços da
 * lista atual. Mesmo comportamento da calculadora simplificada oficial.
 */
export function applySavedFormulaToCalculation(
  calculation: TargetFormula,
  savedFormula: SavedFormula,
  formulaName: string
): TargetFormula {
  const restore = (current: RawMaterial[], saved: RawMaterial[]) =>
    current.map((material) => {
      const savedMaterial = saved.find(
        (item) => item.id === material.id || item.name === material.name
      );
      return {
        ...material,
        ...savedMaterial,
        id: material.id,
        name: material.name,
        selected: savedMaterial ? Boolean(savedMaterial.selected) : false,
        minQty: savedMaterial ? numeric(savedMaterial.minQty) : 0,
        quantity: savedMaterial ? numeric(savedMaterial.quantity) : 0,
        price: material.price,
      };
    });

  const magnesiumTarget = numeric(getMagnesiumTarget(savedFormula.targetMicros));
  return {
    ...calculation,
    savedFormulaId: savedFormula.id,
    formula: formulaName,
    category: savedFormula.category ?? 'all',
    targetCa: savedFormula.targetCa,
    targetS: savedFormula.targetS,
    targetMg: magnesiumTarget > 0 ? magnesiumTarget : undefined,
    targetMicros: savedFormula.targetMicros,
    macros: restore(calculation.macros, savedFormula.macros),
    micros: restore(calculation.micros, savedFormula.micros),
    summary: undefined,
    approximation: undefined,
    notClosed: undefined,
  };
}

export const formatPercent = (value: number | undefined, digits = 1) =>
  `${numeric(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const formatKg = (value: number) =>
  `${numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;

export const formatMoney = (value: number | undefined, currency: 'BRL' | 'USD' = 'BRL') =>
  numeric(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
