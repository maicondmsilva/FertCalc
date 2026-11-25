import React from 'react';
import { Edit3, Eye, Star, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type {
  Brand,
  CompatibilityCategory,
  Embalagem,
  NutrientType,
  UnifiedProduct,
} from '../../types';
import { usageLabel } from './productManagerModel';

const iconButton = 'rounded-lg p-2 text-stone-400 transition-colors';

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function EmptyState({ loading, text }: { loading: boolean; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-400">
      {loading ? 'Carregando…' : text}
    </div>
  );
}

interface ProductTableProps {
  type: NutrientType;
  items: UnifiedProduct[];
  loading: boolean;
  brands: Brand[];
  categories: CompatibilityCategory[];
  usage: Record<string, number>;
  canManage: boolean;
  onView: (item: UnifiedProduct) => void;
  onEdit: (item: UnifiedProduct) => void;
  onToggle: (item: UnifiedProduct) => void;
  onDelete: (item: UnifiedProduct) => void;
}

/** Garantias em texto curto: "0-0-60 · B 0,5% · Zn 1%". */
function guaranteeText(item: UnifiedProduct): string {
  const parts: string[] = [];
  if (item.type === 'macro') parts.push(`${item.n}-${item.p}-${item.k}`);
  (item.microGuarantees || []).forEach((guarantee) => {
    if (guarantee.name) parts.push(`${guarantee.name} ${guarantee.value}%`);
  });
  return parts.join(' · ') || '—';
}

/** Macros, micros e produto acabado: tabela no computador, cartões no celular. */
export function ProductTable({
  type,
  items,
  loading,
  brands,
  categories,
  usage,
  canManage,
  onView,
  onEdit,
  onToggle,
  onDelete,
}: ProductTableProps) {
  if (loading || items.length === 0) {
    return <EmptyState loading={loading} text="Nenhum produto encontrado." />;
  }
  const isMaterial = type === 'macro' || type === 'micro';
  const brandName = (id?: string) => brands.find((brand) => brand.id === id)?.name;
  const categoryNames = (ids?: string[]) =>
    (ids || []).map((id) => categories.find((category) => category.id === id)?.nome || id);

  const actions = (item: UnifiedProduct) => (
    <div className="flex justify-end gap-0.5">
      <button
        type="button"
        onClick={() => onView(item)}
        title="Visualizar"
        className={`${iconButton} hover:bg-emerald-50 hover:text-emerald-700`}
      >
        <Eye className="h-4 w-4" />
      </button>
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Editar"
            className={`${iconButton} hover:bg-blue-50 hover:text-blue-600`}
          >
            <Edit3 className="h-4 w-4" />
          </button>
          {isMaterial && (
            <button
              type="button"
              onClick={() => onToggle(item)}
              title={item.ativo === false ? 'Ativar' : 'Desativar'}
              className={`${iconButton} hover:bg-amber-50 hover:text-amber-600`}
            >
              {item.ativo === false ? (
                <ToggleLeft className="h-4 w-4" />
              ) : (
                <ToggleRight className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(item)}
            title={usage[item.id] ? 'Desativar (produto em uso)' : 'Excluir'}
            className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  const badges = (item: UnifiedProduct) => (
    <>
      {isMaterial && <StatusBadge active={item.ativo !== false} />}
      {item.isPremiumLine && (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Premium
        </span>
      )}
      {item.availableInCalculatorWithoutPriceList && (
        <span className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
          Extra em {item.extraLoadingLocationIds?.length || 0} local(is)
        </span>
      )}
      {usageLabel(usage[item.id]) && (
        <span
          className="whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600"
          title="Aparece em listas de preço, batidas ou precificações: ao excluir, o produto é desativado."
        >
          {usageLabel(usage[item.id])}
        </span>
      )}
    </>
  );

  return (
    <>
      {/* Celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border border-stone-200 bg-white p-4 ${item.ativo === false ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-emerald-600">#{item.code}</p>
                <p className="font-bold text-stone-900">{item.name}</p>
              </div>
              {actions(item)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{badges(item)}</div>
            {isMaterial && (
              <p className="mt-2 font-mono text-xs text-stone-600">{guaranteeText(item)}</p>
            )}
            {type === 'macro' && (
              <p className="mt-1 text-xs text-stone-500">
                Marca: {brandName(item.brandId) || 'sem marca'}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Computador: tabela */}
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-xs font-bold uppercase text-stone-500">
            <tr>
              <th className="w-16 px-4 py-3">Cód.</th>
              <th className="px-4 py-3">Nome</th>
              {isMaterial && <th className="px-4 py-3">Garantias</th>}
              {type === 'macro' && <th className="px-4 py-3">Marca</th>}
              {isMaterial && <th className="hidden px-4 py-3 lg:table-cell">Categorias</th>}
              {type === 'finished' && <th className="px-4 py-3">Descrição</th>}
              <th className="w-40 px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-stone-50 ${item.ativo === false ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 font-mono font-bold text-emerald-600">{item.code}</td>
                <td className="min-w-[14rem] px-4 py-3">
                  <p className="font-semibold text-stone-900">{item.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{badges(item)}</div>
                </td>
                {isMaterial && (
                  <td className="px-4 py-3 font-mono text-xs text-stone-700">
                    {guaranteeText(item)}
                  </td>
                )}
                {type === 'macro' && (
                  <td className="px-4 py-3 text-stone-600">
                    {brandName(item.brandId) || (
                      <span className="text-xs font-semibold text-amber-700">Sem marca</span>
                    )}
                  </td>
                )}
                {isMaterial && (
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {categoryNames(item.categories).map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                )}
                {type === 'finished' && (
                  <td className="max-w-xs truncate px-4 py-3 text-stone-500">
                    {item.description || '—'}
                  </td>
                )}
                <td className="px-4 py-3">{actions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const money = (value?: number | null) =>
  `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface EmbalagemTableProps {
  items: Embalagem[];
  loading: boolean;
  canManage: boolean;
  onEdit: (item: Embalagem) => void;
  onToggle: (item: Embalagem) => void;
  onDelete: (item: Embalagem) => void;
}

function embalagemEffect(item: Embalagem): string {
  const parts: string[] = [];
  if (item.cobrar) parts.push(`+${money(item.valor_cobrar)}/t`);
  if (item.descontar) parts.push(`−${money(item.valor_descontar)}/t`);
  return parts.join(' · ') || 'Sem ajuste no preço';
}

export function EmbalagemTable({
  items,
  loading,
  canManage,
  onEdit,
  onToggle,
  onDelete,
}: EmbalagemTableProps) {
  if (loading || items.length === 0) {
    return <EmptyState loading={loading} text="Nenhuma embalagem encontrada." />;
  }
  const actions = (item: Embalagem) =>
    canManage ? (
      <div className="flex justify-end gap-0.5">
        <button
          type="button"
          onClick={() => onEdit(item)}
          title="Editar"
          className={`${iconButton} hover:bg-blue-50 hover:text-blue-600`}
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(item)}
          title={item.ativo ? 'Desativar' : 'Ativar'}
          className={`${iconButton} hover:bg-amber-50 hover:text-amber-600`}
        >
          {item.ativo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          title="Excluir"
          className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) : null;

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border border-stone-200 bg-white p-4 ${item.ativo ? '' : 'opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-stone-900">{item.nome}</p>
                <p className="mt-1 font-mono text-xs text-stone-600">{embalagemEffect(item)}</p>
              </div>
              {actions(item)}
            </div>
            <div className="mt-2">
              <StatusBadge active={!!item.ativo} />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-xs font-bold uppercase text-stone-500">
            <tr>
              <th className="w-16 px-4 py-3">ID</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3 text-right">Cobrar (R$/t)</th>
              <th className="px-4 py-3 text-right">Descontar (R$/t)</th>
              <th className="px-4 py-3">Status</th>
              <th className="w-36 px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-stone-50 ${item.ativo ? '' : 'opacity-60'}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-stone-500">{item.id_numeric}</td>
                <td className="px-4 py-3 font-semibold text-stone-900">{item.nome}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">
                  {item.cobrar ? money(item.valor_cobrar) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">
                  {item.descontar ? money(item.valor_descontar) : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={!!item.ativo} />
                </td>
                <td className="px-4 py-3">{actions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
