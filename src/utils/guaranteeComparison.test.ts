import { describe, expect, it } from 'vitest';
import { buildGuaranteeComparisons } from './guaranteeComparison';

describe('guarantee comparison', () => {
  it('combina resultado e alvo sem duplicar Ca e S entre os micros', () => {
    const result = buildGuaranteeComparisons(
      {
        resultingCa: 1.2,
        resultingS: 2,
        resultingMicros: { Ca: 1.2, B: 0.25, ZN: 0.1 },
      },
      { targetCa: 1.2, targetS: 2.1, targetMicros: { B: 0.25, Zn: 0.15, S: 2.1 } }
    );

    expect(result.map(({ key }) => key)).toEqual(['CA', 'S', 'B', 'ZN']);
    expect(result.find(({ key }) => key === 'CA')?.status).toBe('met');
    expect(result.find(({ key }) => key === 'S')?.status).toBe('divergent');
    expect(result.find(({ key }) => key === 'B')?.status).toBe('met');
    expect(result.find(({ key }) => key === 'ZN')?.target).toBe(0.15);
  });

  it('mantém uma meta sem resultado para tornar a ausência visível', () => {
    const result = buildGuaranteeComparisons(
      { resultingCa: 0, resultingS: 0, resultingMicros: {} },
      { targetMicros: { Mn: 0.2 } }
    );

    expect(result).toEqual([
      expect.objectContaining({ key: 'MN', calculated: 0, target: 0.2, status: 'divergent' }),
    ]);
  });
});
