import type { TargetFormula } from '../types';

/**
 * Controls only whether a formula participates in batch actions. Its formula
 * composition, commercial context and calculated result remain the same
 * snapshot while the card is unchecked.
 */
export const setCalculationBatchSelection = (
  calculations: TargetFormula[],
  calculationId: string,
  selected: boolean
): TargetFormula[] =>
  calculations.map((calculation) =>
    calculation.id === calculationId ? { ...calculation, selected } : calculation
  );
