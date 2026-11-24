import React from 'react';
import { Archive, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import type { PriceList } from '../../types';
import type { LocalCarregamento } from '../../types/carregamento';
import { listCurrencies } from '../../utils/priceListCurrency';

interface PriceListSidebarProps {
  lists: PriceList[];
  loading: boolean;
  error: string;
  selectedId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  localId: string;
  onLocalChange: (value: string) => void;
  archived: boolean;
  onArchivedChange: (value: boolean) => void;
  activeCount: number;
  archivedCount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  locais: LocalCarregamento[];
  localName: (id?: string) => string;
  onSelect: (list: PriceList) => void;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

/** Coluna com as listas: busca, filtros, ativas/arquivadas e paginação. */
export function PriceListSidebar({
  lists,
  loading,
  error,
  selectedId,
  search,
  onSearchChange,
  localId,
  onLocalChange,
  archived,
  onArchivedChange,
  activeCount,
  archivedCount,
  page,
  totalPages,
  onPageChange,
  locais,
  localName,
  onSelect,
}: PriceListSidebarProps) {
  return (
    <aside className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-stone-100 p-4">
        <label className="relative block">
          <span className="sr-only">Buscar lista</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar lista por nome ou número"
            className="h-11 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={localId}
            onChange={(event) => onLocalChange(event.target.value)}
            aria-label="Filtrar por local"
            className="h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos os locais</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-4 text-sm font-bold" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!archived}
            onClick={() => onArchivedChange(false)}
            className={`border-b-2 pb-1 ${
              !archived
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-400'
            }`}
          >
            Ativas ({activeCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archived}
            onClick={() => onArchivedChange(true)}
            className={`border-b-2 pb-1 ${
              archived ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-400'
            }`}
          >
            Arquivadas ({archivedCount})
          </button>
        </div>
      </div>

      <div className="space-y-1 p-2">
        {loading && (
          <p className="px-3 py-8 text-center text-sm text-stone-400">Carregando listas…</p>
        )}
        {!loading && error && (
          <p className="m-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!loading && !error && lists.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-stone-400">
            {archived ? 'Nenhuma lista arquivada.' : 'Nenhuma lista encontrada.'}
          </p>
        )}
        {!loading &&
          lists.map((list) => {
            const selected = list.id === selectedId;
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => onSelect(list)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-500'
                    : 'hover:bg-stone-50'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-black text-stone-800">
                      {list.name}
                    </span>
                    {listCurrencies(list).map((currency) => (
                      <span
                        key={currency}
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-black ${
                          currency === 'USD'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {currency === 'USD' ? 'US$' : 'R$'}
                      </span>
                    ))}
                    {list.arquivadoEm && <Archive className="h-3.5 w-3.5 text-stone-400" />}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber-500" />
                      {localName(list.local_carregamento_id)}
                    </span>
                    <span>· {formatDate(list.date)}</span>
                    <span>· {list.macros.length + list.micros.length} itens</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
              </button>
            );
          })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima página"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
