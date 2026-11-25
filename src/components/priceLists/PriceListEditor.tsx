import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Copy,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { MacroMaterial, MicroMaterial, RawMaterial } from '../../types';
import type { LocalCarregamento } from '../../types/carregamento';
import { MaterialPickerModal } from './MaterialPickerModal';
import { PriceInput } from './PriceInput';
import {
  filterMaterials,
  findMissingUsdItems,
  findZeroPriceItems,
  priceIn,
  withPriceIn,
  macroToRow,
  materialGuarantees,
  microToRow,
  moveMaterial,
  orderForDisplay,
  type MaterialTab,
  type PriceListDraft,
} from './priceListEditorModel';

interface PriceListEditorProps {
  draft: PriceListDraft;
  onChange: (draft: PriceListDraft) => void;
  isNew: boolean;
  archivedAt?: string;
  createdAt?: string;
  idNumeric?: number;
  canManage: boolean;
  /** Lista já salva abre em visualização; o botão Editar libera os campos. */
  editing: boolean;
  onEdit: () => void;
  dirty: boolean;
  saving: boolean;
  catalogMacros: MacroMaterial[];
  catalogMicros: MicroMaterial[];
  locais: LocalCarregamento[];
  onSave: () => void;
  onDiscard: () => void;
  onDuplicate: () => void;
  onExportExcel: () => void;
  onPdf: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500';
const fieldClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-500';

/** Editor da lista aberta: dados da lista e preços de macros e micros. */
export function PriceListEditor({
  draft,
  onChange,
  isNew,
  archivedAt,
  createdAt,
  idNumeric,
  canManage,
  editing,
  onEdit,
  dirty,
  saving,
  catalogMacros,
  catalogMicros,
  locais,
  onSave,
  onDiscard,
  onDuplicate,
  onExportExcel,
  onPdf,
  onRemove,
  onRestore,
}: PriceListEditorProps) {
  const [tab, setTab] = useState<MaterialTab>('macro');
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const readOnly = !canManage || Boolean(archivedAt) || (!isNew && !editing);
  const canStartEditing = canManage && !archivedAt && !isNew && !editing;
  const symbol = draft.currency === 'USD' ? 'US$' : 'R$';
  const items = tab === 'macro' ? draft.macros : draft.micros;
  const visibleItems = useMemo(
    () => filterMaterials(tab === 'macro' ? orderForDisplay(items) : items, query),
    [items, query, tab]
  );
  const zeroItems = findZeroPriceItems(draft);
  const canDrag = !readOnly && !query.trim();

  const setItems = (next: RawMaterial[]) =>
    onChange(tab === 'macro' ? { ...draft, macros: next } : { ...draft, micros: next });

  // O preço editado é o da moeda escolhida nos botões (a lista guarda R$ e US$).
  const updatePrice = (id: string, price: number) =>
    setItems(
      items.map((item) => (item.id === id ? withPriceIn(item, draft.currency, price) : item))
    );
  const otherCurrency = draft.currency === 'USD' ? 'BRL' : 'USD';
  const formatOther = (value: number) =>
    value > 0
      ? `${otherCurrency === 'USD' ? 'US$' : 'R$'} ${value.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `sem preço em ${otherCurrency === 'USD' ? 'dólar' : 'reais'}`;
  const missingUsd = findMissingUsdItems(draft);

  const addFromCatalog = (ids: string[]) => {
    if (tab === 'macro') {
      const added = catalogMacros
        .filter((item) => ids.includes(item.id) && !draft.macros.some((row) => row.id === item.id))
        .map(macroToRow);
      onChange({ ...draft, macros: [...draft.macros, ...added] });
    } else {
      const added = catalogMicros
        .filter((item) => ids.includes(item.id) && !draft.micros.some((row) => row.id === item.id))
        .map(microToRow);
      onChange({ ...draft, micros: [...draft.micros, ...added] });
    }
  };

  const title = isNew
    ? draft.name.trim() || 'Nova lista de preço'
    : `${draft.name}${
        draft.localId ? ` — ${locais.find((local) => local.id === draft.localId)?.nome ?? ''}` : ''
      }`;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      {pickerOpen && (
        <MaterialPickerModal
          title={tab === 'macro' ? 'Adicionar macronutrientes' : 'Adicionar micronutrientes'}
          items={(tab === 'macro' ? catalogMacros : catalogMicros).filter(
            (item) => item.ativo !== false
          )}
          alreadyAdded={items.map((item) => item.id)}
          onSelect={addFromCatalog}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                archivedAt
                  ? 'bg-stone-200 text-stone-600'
                  : isNew
                    ? 'bg-blue-100 text-blue-700'
                    : readOnly
                      ? 'bg-stone-100 text-stone-600'
                      : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {archivedAt
                ? 'Arquivada'
                : isNew
                  ? 'Nova lista'
                  : editing
                    ? 'Editando'
                    : canManage
                      ? 'Visualizando'
                      : 'Somente leitura'}
            </span>
            {!isNew && (
              <span className="text-xs text-stone-400">
                {createdAt ? `Criada em ${new Date(createdAt).toLocaleDateString('pt-BR')}` : ''}
                {idNumeric != null ? ` · ID ${idNumeric}` : ''}
                {archivedAt
                  ? ` · Arquivada em ${new Date(archivedAt).toLocaleDateString('pt-BR')}`
                  : ''}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 truncate text-2xl font-black text-stone-900">{title}</h2>
        </div>
        {!isNew && (
          <div className="flex flex-wrap gap-2">
            {canStartEditing && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
            {canManage && !editing && (
              <button
                type="button"
                onClick={onDuplicate}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                <Copy className="h-4 w-4" /> Duplicar
              </button>
            )}
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            {!archivedAt && (
              <button
                type="button"
                onClick={onPdf}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
            )}
            {canManage &&
              !editing &&
              (archivedAt ? (
                <button
                  type="button"
                  onClick={onRestore}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  <ArchiveRestore className="h-4 w-4" /> Restaurar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRemove}
                  title="Exclui se nunca foi usada em precificação; se já foi usada, arquiva."
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-600 hover:bg-red-50"
                >
                  <Archive className="h-4 w-4" /> Excluir ou arquivar
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Dados da lista */}
      <div className="grid grid-cols-1 gap-3 border-b border-stone-100 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Nome da lista</span>
          <input
            value={draft.name}
            disabled={readOnly}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Ex.: 611/2026"
            className={`${fieldClass} font-semibold`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Local de carregamento</span>
          <select
            value={draft.localId}
            disabled={readOnly}
            onChange={(event) => onChange({ ...draft, localId: event.target.value })}
            className={fieldClass}
          >
            <option value="">Sem local (opcional)</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
                {local.cidade ? ` — ${local.cidade}${local.estado ? `/${local.estado}` : ''}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className={labelClass}>Preencher preços em</span>
          <div className="inline-flex h-11 w-full rounded-xl bg-stone-100 p-1" role="radiogroup">
            {(
              [
                { value: 'BRL', label: 'R$ Reais' },
                { value: 'USD', label: 'US$ Dólar' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={draft.currency === option.value}
                disabled={readOnly}
                onClick={() => onChange({ ...draft, currency: option.value })}
                className={`flex-1 rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                  draft.currency === option.value
                    ? option.value === 'USD'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={labelClass}>Câmbio (R$ por US$)</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={draft.exchangeRate > 0 ? draft.exchangeRate : ''}
            disabled={readOnly}
            onChange={(event) =>
              onChange({ ...draft, exchangeRate: Math.max(0, Number(event.target.value) || 0) })
            }
            placeholder={
              missingUsd.length < draft.macros.length + draft.micros.length
                ? 'Obrigatório'
                : 'Opcional'
            }
            className={`${fieldClass} text-right font-mono`}
          />
        </label>
      </div>

      {/* Abas, busca e adicionar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-bold" role="tablist">
          {(
            [
              { value: 'macro', label: 'Macronutrientes', count: draft.macros.length },
              { value: 'micro', label: 'Micronutrientes', count: draft.micros.length },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={`rounded-lg px-4 py-2 ${
                tab === option.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {option.label} <span className="text-stone-400">{option.count}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Buscar matéria-prima</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar matéria-prima"
              className="h-10 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-800"
            >
              <Plus className="h-4 w-4" /> Adicionar matéria-prima
            </button>
          )}
        </div>
      </div>

      {/* Tabela de preços */}
      <div className="p-5">
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full">
            <thead className="bg-stone-50 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">
              <tr>
                {canDrag && <th className="hidden w-8 sm:table-cell" aria-label="Ordem" />}
                <th className="hidden w-16 px-3 py-2.5 sm:table-cell">Cód.</th>
                <th className="px-3 py-2.5">Matéria-prima e garantias</th>
                <th className="px-3 py-2.5 text-right">
                  <span className="sm:hidden">Preço/t</span>
                  <span className="hidden sm:inline">Preço por tonelada</span>
                </th>
                {!readOnly && <th className="w-10" aria-label="Remover" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-stone-400">
                    {query.trim()
                      ? 'Nenhuma matéria-prima encontrada nesta busca.'
                      : readOnly
                        ? 'Lista sem matérias-primas.'
                        : 'Clique em "Adicionar matéria-prima" para montar a lista.'}
                  </td>
                </tr>
              )}
              {visibleItems.map((item) => (
                <tr
                  key={item.id}
                  draggable={canDrag}
                  onDragStart={() => setDragId(item.id)}
                  onDragOver={(event) => {
                    if (!canDrag) return;
                    event.preventDefault();
                    setDragOverId(item.id);
                  }}
                  onDrop={() => {
                    if (dragId) setItems(moveMaterial(items, dragId, item.id));
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  className={`hover:bg-stone-50 ${
                    dragOverId === item.id && dragId !== item.id
                      ? 'border-t-2 border-emerald-500'
                      : ''
                  }`}
                >
                  {canDrag && (
                    <td className="hidden cursor-grab pl-2 text-stone-300 active:cursor-grabbing sm:table-cell">
                      <GripVertical className="h-4 w-4" />
                    </td>
                  )}
                  <td className="hidden px-3 py-2.5 font-mono text-xs font-bold text-emerald-700 sm:table-cell">
                    {item.code}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-stone-800">
                      <span className="font-mono text-xs font-bold text-emerald-700 sm:hidden">
                        {item.code}
                      </span>
                      {item.name}
                      {item.isPremiumLine && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700">
                          Diferenciada
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {materialGuarantees(item).map((guarantee) => (
                        <span
                          key={guarantee.name}
                          className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-600"
                        >
                          {guarantee.name} {guarantee.value.toLocaleString('pt-BR')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <PriceInput
                      label={`Preço de ${item.name}`}
                      value={priceIn(item, draft.currency)}
                      symbol={symbol}
                      disabled={readOnly}
                      highlightEmpty={!readOnly && draft.currency === 'BRL'}
                      onChange={(price) => updatePrice(item.id, price)}
                    />
                    <p className="mt-1 text-right text-[11px] text-stone-400">
                      {formatOther(priceIn(item, otherCurrency))}
                    </p>
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => setItems(items.filter((row) => row.id !== item.id))}
                        className="rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé */}
      {!readOnly && (
        <div className="flex flex-col gap-3 rounded-b-2xl border-t border-stone-200 bg-stone-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={`flex items-center gap-1.5 text-sm font-semibold ${
              zeroItems.length > 0 ? 'text-amber-700' : 'text-stone-500'
            }`}
          >
            {zeroItems.length > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {zeroItems.length === 1
                  ? `1 matéria-prima sem preço em reais: ${zeroItems[0].name}`
                  : `${zeroItems.length} matérias-primas sem preço em reais`}
              </>
            ) : draft.currency === 'USD' && missingUsd.length > 0 ? (
              `${missingUsd.length} sem preço em dólar: aparecem zerados na calculadora em US$.`
            ) : dirty ? (
              'Há alterações não salvas.'
            ) : (
              'Todos os preços preenchidos.'
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="h-11 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              {isNew ? 'Cancelar' : 'Cancelar edição'}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || (!dirty && !isNew)}
              className="h-11 rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Salvando…' : isNew ? 'Criar lista' : 'Salvar lista'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
