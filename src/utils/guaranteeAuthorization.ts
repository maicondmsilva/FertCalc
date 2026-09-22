import type { PricingRecord, TargetFormula, User } from '../types';
import { parseFormulaTarget } from '../domain/pricing-engine/formulaEngine';
import { buildGuaranteeComparisons } from './guaranteeComparison';

export interface GuaranteeDivergence {
  formulaId: string;
  formula: string;
  nutrient: string;
  target: number;
  calculated: number;
}

const NPK_TOLERANCE = 0.05;

export function getGuaranteeDivergences(calculations: TargetFormula[]): GuaranteeDivergence[] {
  return calculations
    .filter((calculation) => calculation.selected && calculation.summary)
    .flatMap((calculation) => {
      const summary = calculation.summary!;
      const formulaTarget = parseFormulaTarget(calculation.formula);
      const npk = formulaTarget
        ? [
            ['N', formulaTarget.n, summary.resultingN],
            ['P', formulaTarget.p, summary.resultingP],
            ['K', formulaTarget.k, summary.resultingK],
          ]
            .filter(([, target, calculated]) =>
              Number.isFinite(target) && Math.abs(Number(calculated) - Number(target)) > NPK_TOLERANCE
            )
            .map(([nutrient, target, calculated]) => ({
              formulaId: calculation.id,
              formula: calculation.formula,
              nutrient: String(nutrient),
              target: Number(target),
              calculated: Number(calculated),
            }))
        : [];
      const additional = buildGuaranteeComparisons(summary, calculation)
        .filter((item) => item.target !== undefined && item.status === 'divergent')
        .map((item) => ({
          formulaId: calculation.id,
          formula: calculation.formula,
          nutrient: item.label,
          target: Number(item.target),
          calculated: item.calculated,
        }));
      return [...npk, ...additional];
    });
}

export function canAuthorizeGuaranteeDivergence(user: User): boolean {
  return (
    user.role === 'master' ||
    user.role === 'admin' ||
    user.role === 'manager' ||
    user.permissions?.calculator_overrideGuaranteeDivergence === true
  );
}

export function getPricingGuaranteeAuthorizationSummary(pricing: PricingRecord) {
  const authorizations = (pricing.calculations || [])
    .map((calculation) => calculation.guaranteeDivergenceAuthorization)
    .filter((authorization): authorization is NonNullable<typeof authorization> => Boolean(authorization));
  const latest = [...authorizations].sort((left, right) =>
    right.authorizedAt.localeCompare(left.authorizedAt)
  )[0];
  return {
    hasAuthorizedDivergence: authorizations.length > 0,
    authorizedFormulaCount: authorizations.length,
    divergenceCount: authorizations.reduce(
      (total, authorization) => total + authorization.divergences.length,
      0
    ),
    latestAuthorization: latest,
  };
}

export function formatPricingGuaranteeAuthorizationAudit(pricing: PricingRecord): string {
  const authorizations = (pricing.calculations || [])
    .map((calculation) => ({
      formula: calculation.formula,
      authorization: calculation.guaranteeDivergenceAuthorization,
    }))
    .filter(
      (entry): entry is {
        formula: string;
        authorization: NonNullable<TargetFormula['guaranteeDivergenceAuthorization']>;
      } => Boolean(entry.authorization)
    )
    .sort((left, right) =>
      right.authorization.authorizedAt.localeCompare(left.authorization.authorizedAt)
    );

  if (authorizations.length === 0) return 'Sem exceção';

  return authorizations
    .map(({ formula, authorization }) => {
      const nutrients = authorization.divergences.map((item) => item.nutrient).join(', ');
      const authorizedAt = new Date(authorization.authorizedAt);
      const dateLabel = Number.isNaN(authorizedAt.getTime())
        ? authorization.authorizedAt
        : authorizedAt.toLocaleString('pt-BR');
      return `${formula}: ${authorization.authorizedByUserName} em ${dateLabel} — ${authorization.justification} (${nutrients})`;
    })
    .join(' | ');
}
