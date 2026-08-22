const TARGET_FORMULA_PATTERN = /(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)[^\d]+(\d+(?:[.,]\d+)?)/;

export interface FormulaTarget {
  n: number;
  p: number;
  k: number;
}

export function parseFormulaTarget(formula?: string): FormulaTarget | null {
  const match = formula?.trim().match(TARGET_FORMULA_PATTERN);
  if (!match) return null;
  return {
    n: Number(match[1].replace(',', '.')),
    p: Number(match[2].replace(',', '.')),
    k: Number(match[3].replace(',', '.')),
  };
}

export const hasFormulaTarget = (formula?: string): boolean => parseFormulaTarget(formula) !== null;
