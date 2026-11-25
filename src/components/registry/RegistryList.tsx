import React from 'react';
import { AlertTriangle, Edit2, Eye, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import Pagination from '../ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { CatalogModal, secondaryButton, primaryButton } from '../products/catalogUi';

export interface RegistryColumn<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

export interface RegistryStat {
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}

/**
 * Lista de cadastro (clientes, agentes): cabeçalho com indicadores, busca,
 * tabela no computador e cartões no celular, paginação, carga e erro.
 */
export function RegistryList<T extends { id: string; code?: string; name: string }>({
  title,
  subtitle,
  icon: Icon,
  itemLabel,
  items,
  totalCount,
  stats,
  search,
  onSearchChange,
  loading,
  error,
  onRetry,
  columns,
  cardLines,
  canCreate,
  canEdit,
  canDelete,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  itemLabel: string;
  items: T[];
  totalCount: number;
  stats: RegistryStat[];
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  columns: RegistryColumn<T>[];
  cardLines: (item: T) => React.ReactNode[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onCreate: () => void;
  onView: (item: T) => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  const pagination = usePagination(items, 24);

  const actions = (item: T) => (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onView(item)}
        aria-label={`Ver ${item.name}`}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      >
        <Eye className="h-4 w-4" />
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(item)}
          aria-label={`Editar ${item.name}`}
          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={`Excluir ${item.name}`}
          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500">{subtitle}</p>
          </div>
        </div>
        {canCreate && (
          <button type="button" onClick={onCreate} className={primaryButton}>
            <Plus className="h-4 w-4" /> Novo {itemLabel}
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 ${
              stat.tone === 'warning' && stat.value > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-stone-200 bg-white'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{stat.label}</p>
            <p
              className={`text-2xl font-black tabular-nums ${
                stat.tone === 'warning' && stat.value > 0 ? 'text-amber-800' : 'text-stone-900'
              }`}
            >
              {loading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por nome, código, documento, fazenda ou cidade"
              aria-label={`Buscar ${itemLabel}`}
              className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-9 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {search && !loading && (
            <p className="mt-2 text-xs text-stone-500">
              {items.length} de {totalCount} encontrados
            </p>
          )}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-red-800"
          >
            <AlertTriangle className="h-6 w-6" /> {error}
            <button type="button" onClick={onRetry} className={secondaryButton}>
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-stone-400">
            {search ? 'Nada encontrado para essa busca.' : `Nenhum ${itemLabel} cadastrado ainda.`}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.header} className={`px-4 py-3 ${column.className || ''}`}>
                        {column.header}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pagination.pageItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50">
                      {columns.map((column) => (
                        <td
                          key={column.header}
                          className={`px-4 py-3 align-middle ${column.className || ''}`}
                        >
                          {column.cell(item)}
                        </td>
                      ))}
                      <td className="px-4 py-2">{actions(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-stone-100 md:hidden">
              {pagination.pageItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-bold text-stone-900">
                      <span className="mr-1.5 font-mono text-emerald-700">{item.code}</span>
                      {item.name}
                    </p>
                    {cardLines(item).map((line, index) => (
                      <p key={index} className="truncate text-xs text-stone-500">
                        {line}
                      </p>
                    ))}
                  </button>
                  {actions(item)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {!loading && !error && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          firstItemNumber={pagination.firstItemNumber}
          lastItemNumber={pagination.lastItemNumber}
          pageSize={pagination.pageSize}
          pageSizeOptions={[24, 48, 96]}
          itemLabel={`${itemLabel}s`}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </div>
  );
}

export interface DetailSection {
  title: string;
  rows: { label: string; value?: React.ReactNode }[];
}

/** Ficha de leitura do cadastro; "Editar" só aparece para quem pode editar. */
export function RegistryDetailModal({
  title,
  subtitle,
  icon,
  sections,
  canEdit,
  onEdit,
  onClose,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sections: DetailSection[];
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <CatalogModal
      isOpen
      size="lg"
      title={title}
      subtitle={subtitle}
      icon={icon}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Fechar
          </button>
          {canEdit && (
            <button type="button" onClick={onEdit} className={primaryButton}>
              <Edit2 className="h-4 w-4" /> Editar
            </button>
          )}
        </>
      }
    >
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-sm font-black text-stone-800">{section.title}</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  {row.label}
                </dt>
                <dd className="break-words text-sm font-medium text-stone-800">
                  {row.value || <span className="text-stone-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </CatalogModal>
  );
}
