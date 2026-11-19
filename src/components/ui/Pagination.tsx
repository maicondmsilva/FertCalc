import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  firstItemNumber: number;
  lastItemNumber: number;
  pageSize: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/** Números de página a mostrar, com reticências quando há muitas páginas. */
export function getVisiblePages(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
  return sorted.flatMap((value, index) =>
    index > 0 && value - sorted[index - 1] > 1 ? (['gap', value] as const) : [value]
  );
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  firstItemNumber,
  lastItemNumber,
  pageSize,
  pageSizeOptions = [12, 24, 48],
  itemLabel = 'itens',
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;
  const buttonClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <span>
          Mostrando <strong className="text-stone-900">{firstItemNumber}</strong>–
          <strong className="text-stone-900">{lastItemNumber}</strong> de{' '}
          <strong className="text-stone-900">{totalItems}</strong> {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="text-stone-500">Por página</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className={`${buttonClass} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getVisiblePages(page, totalPages).map((value, index) =>
            value === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-stone-400">
                …
              </span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => onPageChange(value)}
                aria-current={value === page ? 'page' : undefined}
                className={`${buttonClass} ${
                  value === page
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {value}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Próxima página"
            className={`${buttonClass} border-stone-200 bg-white text-stone-600 hover:bg-stone-50`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
