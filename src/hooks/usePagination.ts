import { useEffect, useMemo, useState } from 'react';

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pageItems: T[];
  firstItemNumber: number;
  lastItemNumber: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

/** Calcula a fatia da página atual. Exportada para testes. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    totalItems,
    pageItems: items.slice(start, start + pageSize),
    firstItemNumber: totalItems === 0 ? 0 : start + 1,
    lastItemNumber: Math.min(start + pageSize, totalItems),
  };
}

/**
 * Divide uma lista em páginas. Volta para a primeira página quando a lista muda
 * de tamanho (ex.: nova busca ou filtro), para não cair numa página vazia.
 */
export function usePagination<T>(items: T[], initialPageSize = 12): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const result = useMemo(() => paginate(items, page, pageSize), [items, page, pageSize]);

  return {
    ...result,
    pageSize,
    setPage,
    setPageSize: (nextPageSize: number) => {
      setPageSizeState(nextPageSize);
      setPage(1);
    },
  };
}
