import { describe, expect, it } from 'vitest';
import { paginate } from './usePagination';
import { getVisiblePages } from '../components/ui/Pagination';

describe('paginação', () => {
  const items = Array.from({ length: 30 }, (_, index) => index + 1);

  it('fatia a página pedida e informa a faixa exibida', () => {
    const result = paginate(items, 2, 12);
    expect(result.pageItems).toEqual(items.slice(12, 24));
    expect(result.totalPages).toBe(3);
    expect(result.firstItemNumber).toBe(13);
    expect(result.lastItemNumber).toBe(24);
  });

  it('corrige página fora do intervalo', () => {
    expect(paginate(items, 9, 12).page).toBe(3);
    expect(paginate(items, 0, 12).page).toBe(1);
    expect(paginate([], 3, 12)).toMatchObject({ page: 1, totalPages: 1, firstItemNumber: 0 });
  });

  it('mostra reticências quando há muitas páginas', () => {
    expect(getVisiblePages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getVisiblePages(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(getVisiblePages(1, 10)).toEqual([1, 2, 'gap', 10]);
  });
});
