import type { TargetFormula } from '../types';
import type { GuaranteeDivergence } from './guaranteeAuthorization';

const sortRecord = (record: Record<string, number> | undefined) =>
  Object.fromEntries(
    Object.entries(record || {})
      .map(([key, value]) => [key.trim().toLocaleUpperCase('pt-BR'), Number(value)] as const)
      .sort(([left], [right]) => left.localeCompare(right))
  );

export function serializeGuaranteeAuthorizationScope(
  calculations: TargetFormula[],
  divergences: GuaranteeDivergence[]
): string {
  const payload = {
    calculations: calculations
      .filter((calculation) => calculation.selected)
      .map((calculation) => ({
        id: calculation.id,
        formula: calculation.formula,
        targets: {
          n: calculation.targetN,
          p: calculation.targetP,
          k: calculation.targetK,
          ca: calculation.targetCa,
          s: calculation.targetS,
          micros: sortRecord(calculation.targetMicros),
        },
        result: calculation.summary
          ? {
              n: calculation.summary.resultingN,
              p: calculation.summary.resultingP,
              k: calculation.summary.resultingK,
              ca: calculation.summary.resultingCa,
              s: calculation.summary.resultingS,
              micros: sortRecord(calculation.summary.resultingMicros),
            }
          : null,
        macros: calculation.macros
          .filter((material) => material.selected)
          .map((material) => ({ id: material.id, quantity: Number(material.quantity) }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        micros: calculation.micros
          .filter((material) => material.selected)
          .map((material) => ({ id: material.id, quantity: Number(material.quantity) }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    divergences: divergences
      .map((item) => ({
        formulaId: item.formulaId,
        nutrient: item.nutrient,
        target: Number(item.target),
        calculated: Number(item.calculated),
      }))
      .sort((left, right) =>
        `${left.formulaId}:${left.nutrient}`.localeCompare(`${right.formulaId}:${right.nutrient}`)
      ),
  };
  return JSON.stringify(payload);
}

export async function createGuaranteeAuthorizationFingerprint(
  calculations: TargetFormula[],
  divergences: GuaranteeDivergence[]
): Promise<string> {
  const serialized = serializeGuaranteeAuthorizationScope(calculations, divergences);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new globalThis.TextEncoder().encode(serialized)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
