import { describe, expect, it } from 'vitest';
import { getTotalPages, paginateItems } from './pagination';

describe('paginação', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it('divide os itens e mantém a última página parcial', () => {
    expect(getTotalPages(items.length, 12)).toBe(3);
    expect(paginateItems(items, 1, 12)).toEqual(items.slice(0, 12));
    expect(paginateItems(items, 3, 12)).toEqual([25]);
  });

  it('limita páginas inválidas ao intervalo disponível', () => {
    expect(paginateItems(items, 0, 12)).toEqual(items.slice(0, 12));
    expect(paginateItems(items, 99, 12)).toEqual([25]);
    expect(getTotalPages(0, 12)).toBe(1);
  });
});
