import { describe, expect, it } from 'vitest';
import type { Agent, TargetFormula } from '../types';
import { validatePricingForSave } from './pricingValidation';

const calculation = (overrides: Partial<TargetFormula> = {}): TargetFormula => ({
  id: 'formula-1',
  formula: '20-05-20',
  selected: true,
  factors: { totalTons: 10, commission: 0 } as TargetFormula['factors'],
  macros: [],
  micros: [],
  ...overrides,
});

describe('pricing save validation', () => {
  it('requires at least one selected formula', () => {
    expect(validatePricingForSave([calculation({ selected: false })], null)).toMatchObject({
      valid: false,
    });
  });

  it('blocks a selected formula without tons', () => {
    const result = validatePricingForSave([
      calculation({ factors: { totalTons: 0, commission: 0 } as TargetFormula['factors'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('toneladas');
  });

  it('blocks commission without an agent', () => {
    const result = validatePricingForSave([
      calculation({ factors: { totalTons: 10, commission: 2 } as TargetFormula['factors'] }),
    ]);
    expect(result).toEqual({
      valid: false,
      message: 'Selecione um agente antes de aplicar comissão.',
    });
  });

  it('allows commission when an agent is selected', () => {
    const agent = { id: 'agent-1', name: 'Agente' } as Agent;
    expect(
      validatePricingForSave(
        [calculation({ factors: { totalTons: 10, commission: 2 } as TargetFormula['factors'] })],
        agent
      )
    ).toEqual({ valid: true });
  });
});
