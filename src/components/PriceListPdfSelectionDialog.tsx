import React, { useEffect, useState } from 'react';
import { Check, FileText, MapPin, X } from 'lucide-react';
import type { PriceListPdfGroup } from '../utils/priceListPdfSelection';

export interface PriceListPdfSelection {
  group: PriceListPdfGroup;
  listIds: string[];
}

interface PriceListPdfSelectionDialogProps {
  groups: PriceListPdfGroup[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (selection: PriceListPdfSelection) => void;
}

export function PriceListPdfSelectionDialog({
  groups,
  loading,
  error,
  onClose,
  onConfirm,
}: PriceListPdfSelectionDialogProps) {
  const [groupId, setGroupId] = useState('');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const selectedGroup = groups.find((group) => group.id === groupId);

  useEffect(() => {
    if (!groupId && groups[0]) setGroupId(groups[0].id);
  }, [groupId, groups]);

  useEffect(() => {
    setSelectedListIds(selectedGroup?.locations.map((location) => location.listId) ?? []);
  }, [selectedGroup?.id]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toggleList = (listId: string) => {
    setSelectedListIds((current) =>
      current.includes(listId)
        ? current.filter((id) => id !== listId)
        : [...current, listId]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-list-pdf-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 px-6 py-5">
          <div>
            <h2 id="price-list-pdf-title" className="flex items-center gap-2 text-lg font-bold text-stone-800">
              <FileText className="h-5 w-5 text-emerald-600" />
              Preparar lista de preços em PDF
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Escolha a publicação e os locais que devem compor o relatório.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {loading && <div className="py-10 text-center text-sm text-stone-500">Carregando listas disponíveis...</div>}
          {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {!loading && !error && groups.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nenhuma lista de preços está disponível para preparar o PDF.
            </div>
          )}
          {!loading && !error && groups.length > 0 && (
            <>
              <div>
                <label htmlFor="pdf-price-list" className="mb-1 block text-sm font-semibold text-stone-700">
                  Publicação ou lista
                </label>
                <select
                  id="pdf-price-list"
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label} - {group.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-stone-700">Locais de carregamento</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedListIds(
                        selectedListIds.length === selectedGroup?.locations.length
                          ? []
                          : selectedGroup?.locations.map((location) => location.listId) ?? []
                      )
                    }
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    {selectedListIds.length === selectedGroup?.locations.length
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-stone-200 p-2">
                  {selectedGroup?.locations.map((location) => {
                    const checked = selectedListIds.includes(location.listId);
                    return (
                      <label
                        key={location.listId}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 transition-colors ${
                          checked
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-transparent hover:bg-stone-50'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-amber-500" />
                          <span className="truncate">{location.localName}</span>
                          <span className="flex-shrink-0 text-xs text-stone-400">
                            ID {location.listIdNumeric ?? '—'}
                          </span>
                        </span>
                        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white'}`}>
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <input type="checkbox" checked={checked} onChange={() => toggleList(location.listId)} className="sr-only" />
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {selectedListIds.length} de {selectedGroup?.locations.length ?? 0} locais selecionados
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-white">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedGroup || selectedListIds.length === 0 || loading}
            onClick={() => selectedGroup && onConfirm({ group: selectedGroup, listIds: selectedListIds })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar seleção
          </button>
        </div>
      </div>
    </div>
  );
}
