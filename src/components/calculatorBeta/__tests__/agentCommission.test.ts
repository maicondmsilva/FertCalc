import { describe, expect, it } from 'vitest';
import { agentCommissionProblem } from '../betaCalculatorModel';

const calc = (formula: string, commission: number, selected = true) =>
  ({ formula, selected, factors: { commission } }) as never;

describe('agente exige comissão', () => {
  it('sem agente não exige nada', () => {
    expect(agentCommissionProblem([calc('14-00-19', 0)], null)).toBeNull();
  });

  it('com agente, fórmula selecionada sem comissão é apontada', () => {
    expect(agentCommissionProblem([calc('14-00-19', 0), calc('10-10-10', 3)], { id: 'a1' })).toBe(
      'Com agente informado, informe a comissão em Condições: 14-00-19.'
    );
  });

  it('com agente e comissão em todas as selecionadas, libera', () => {
    expect(
      agentCommissionProblem([calc('14-00-19', 2), calc('04-14-08', 0, false)], { id: 'a1' })
    ).toBeNull();
  });
});
