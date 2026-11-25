import type { PricingRecord, User } from '../../types';
import { canDecidePricing } from '../../utils/pricingApprovalRules';

export interface PricingQueueFilters {
  search: string;
  onlyDecidable: boolean;
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Texto pesquisável da precificação: cliente, vendedor, código e fórmulas. */
function searchableText(pricing: PricingRecord): string {
  const formulas = (pricing.calculations || []).map((calculation) => calculation.formula).join(' ');
  return normalize(
    [
      pricing.factors?.client?.name,
      pricing.userName,
      pricing.formattedCod,
      pricing.factors?.targetFormula,
      formulas,
    ].join(' ')
  );
}

/** Fila de precificações pendentes com busca e "só as que eu posso decidir". */
export function filterPricingQueue(
  pricings: PricingRecord[],
  user: User,
  { search, onlyDecidable }: PricingQueueFilters
): PricingRecord[] {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return pricings.filter((pricing) => {
    if (onlyDecidable && !canDecidePricing(user, pricing)) return false;
    if (terms.length === 0) return true;
    const text = searchableText(pricing);
    return terms.every((term) => text.includes(term));
  });
}

export interface ApprovalSummary {
  pricings: number;
  decidable: number;
  deletions: number;
  goals: number;
  guarantees: number;
}

export function summarizeApprovals(input: {
  pendingPricings: PricingRecord[];
  pendingDeletions: PricingRecord[];
  goals: number;
  guarantees: number;
  user: User;
}): ApprovalSummary {
  return {
    pricings: input.pendingPricings.length,
    decidable: input.pendingPricings.filter((pricing) => canDecidePricing(input.user, pricing))
      .length,
    deletions: input.pendingDeletions.length,
    goals: input.goals,
    guarantees: input.guarantees,
  };
}
