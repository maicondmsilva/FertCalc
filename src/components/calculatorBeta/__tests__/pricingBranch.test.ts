import { describe, expect, it } from 'vitest';
import { pricingBranchOptions } from '../betaCalculatorModel';

const branches = [
  { id: 'a', name: 'Uberaba', ativo: true },
  { id: 'b', name: 'Rio Verde', ativo: true },
  { id: 'c', name: 'Antiga', ativo: false },
];

describe('filiais da precificação', () => {
  it('mostra só as ativas', () => {
    expect(pricingBranchOptions(branches).map((branch) => branch.id)).toEqual(['a', 'b']);
  });

  it('respeita as filiais liberadas no cadastro do usuário', () => {
    expect(pricingBranchOptions(branches, ['b', 'c']).map((branch) => branch.id)).toEqual(['b']);
  });
});
