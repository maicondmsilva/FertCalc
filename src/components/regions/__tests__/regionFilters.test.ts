import { describe, expect, it } from 'vitest';
import { matchesRegionFilter } from '../RegionFilterSelect';
import { totalsByRegion } from '../../ExpenseManagement/ExpenseReport';
import { groupCarregamentos } from '../../../utils/carregamentoReport';
import type { Region } from '../../../types';
import type { CreditCardExpense } from '../../../types/expense.types';
import type { Carregamento } from '../../../types/carregamento';

const regions = [
  { id: 'r1', name: 'Norte', ativo: true },
  { id: 'r2', name: 'Sul', ativo: true },
] as Region[];

describe('matchesRegionFilter', () => {
  it('sem filtro aceita tudo', () => {
    expect(matchesRegionFilter(null, '')).toBe(true);
    expect(matchesRegionFilter('r1', '')).toBe(true);
  });
  it('"none" aceita só sem região', () => {
    expect(matchesRegionFilter(null, 'none')).toBe(true);
    expect(matchesRegionFilter('r1', 'none')).toBe(false);
  });
  it('id aceita só a região escolhida', () => {
    expect(matchesRegionFilter('r1', 'r1')).toBe(true);
    expect(matchesRegionFilter('r2', 'r1')).toBe(false);
    expect(matchesRegionFilter(undefined, 'r1')).toBe(false);
  });
});

describe('totalsByRegion', () => {
  it('soma por região, maior primeiro e "Sem região" no fim', () => {
    const expenses = [
      { amount: 100, regionId: 'r1' },
      { amount: 50, regionId: null },
      { amount: 300, regionId: 'r2' },
      { amount: 20, regionId: 'r1' },
    ] as unknown as CreditCardExpense[];
    expect(totalsByRegion(expenses, regions)).toEqual([
      { regionId: 'r2', name: 'Sul', total: 300, count: 1 },
      { regionId: 'r1', name: 'Norte', total: 120, count: 2 },
      { regionId: null, name: 'Sem região', total: 50, count: 1 },
    ]);
  });
});

describe('groupCarregamentos por região', () => {
  it('agrupa pelo nome da região', () => {
    const items = [
      { id: '1', regiao_nome: 'Norte', status: 'carregado' },
      { id: '2', status: 'carregado' },
      { id: '3', regiao_nome: 'Norte', status: 'carregado' },
    ] as unknown as Carregamento[];
    const labels = groupCarregamentos(items, 'regiao').map((g) => [g.label, g.items.length]);
    expect(labels).toEqual(
      expect.arrayContaining([
        ['Norte', 2],
        ['Sem região', 1],
      ])
    );
  });
});
