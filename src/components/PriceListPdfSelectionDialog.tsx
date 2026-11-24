import React, { useEffect, useState } from 'react';
import { Check, FileText, MapPin, X } from 'lucide-react';
import type { PriceListPdfGroup } from '../utils/priceListPdfSelection';

export interface PriceListPdfSelection {
  group: PriceListPdfGroup;
  listIds: string[];
  /** Observações digitadas pelo usuário; saem no fim do PDF (que continua em uma página). */
  notes: string;
  /** Moeda dos preços impressos (a mesma lista pode ter R$ e US$). */
  currency: 'BRL' | 'USD';
}

/** Limite de texto para a observação caber na mesma página da lista. */
export const PDF_NOTES_MAX_LENGTH = 600;
const NOTES_STORAGE_KEY = 'fertcalc.priceListPdfNotes';

const readSavedNotes = () => {
  try {
    return window.localStorage.getItem(NOTES_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const saveNotes = (notes: string) => {
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, notes);
  } catch {
    // Sem armazenamento local: a observação só não fica lembrada.
  }
};

interface PriceListPdfSelectionDialogProps {
  groups: PriceListPdfGroup[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (selection: PriceListPdfSelection) => Promise<void> | void;
  /** Abre já com a publicação que contém esta lista. */
  initialListId?: string;
}

export function PriceListPdfSelectionDialog({
  groups,
  loading,
  error,
  onClose,
  onConfirm,
  initialListId,
}: PriceListPdfSelectionDialogProps) {
  const [groupId, setGroupId] = useState('');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [generating, setGenerating] = useState(false);
  const selectedGroup = groups.find((group) => group.id === groupId);

  useEffect(() => {
    if (groupId || groups.length === 0) return;
    const initialGroup = initialListId
      ? groups.find((group) =>
          group.locations.some((location) => location.listId === initialListId)
        )
      : undefined;
    setGroupId((initialGroup ?? groups[0]).id);
  }, [groupId, groups, initialListId]);

  useEffect(() => {
    setSelectedListIds(selectedGroup?.locations.map((location) => location.listId) ?? []);
    // A observação da publicação tem prioridade; sem ela, usa a última digitada.
    setNotes((selectedGroup?.notes || readSavedNotes()).slice(0, PDF_NOTES_MAX_LENGTH));
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
      current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId]
    );
  };

  const handleConfirm = async () => {
    if (!selectedGroup || selectedListIds.length === 0 || generating) return;
    setGenerating(true);
    try {
      saveNotes(notes.trim());
      await onConfirm({
        group: selectedGroup,
        listIds: selectedListIds,
        notes: notes.trim(),
        currency,
      });
    } finally {
      setGenerating(false);
    }
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
            <h2
              id="price-list-pdf-title"
              className="flex items-center gap-2 text-lg font-bold text-stone-800"
            >
              <FileText className="h-5 w-5 text-emerald-600" />
              Preparar lista de preços em PDF
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Escolha a publicação e os locais que devem compor o relatório.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {loading && (
            <div className="py-10 text-center text-sm text-stone-500">
              Carregando listas disponíveis...
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && groups.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nenhuma lista de preços está disponível para preparar o PDF.
            </div>
          )}
          {!loading && !error && groups.length > 0 && (
            <>
              <div>
                <label
                  htmlFor="pdf-price-list"
                  className="mb-1 block text-sm font-semibold text-stone-700"
                >
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
                  <span className="text-sm font-semibold text-stone-700">
                    Locais de carregamento
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedListIds(
                        selectedListIds.length === selectedGroup?.locations.length
                          ? []
                          : (selectedGroup?.locations.map((location) => location.listId) ?? [])
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
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white'}`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleList(location.listId)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {selectedListIds.length} de {selectedGroup?.locations.length ?? 0} locais
                  selecionados
                </p>
              </div>

              <div>
                <span className="mb-1 block text-sm font-semibold text-stone-700">
                  Moeda dos preços
                </span>
                <div
                  role="radiogroup"
                  aria-label="Moeda dos preços"
                  className="inline-flex rounded-lg bg-stone-100 p-0.5"
                >
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
                      aria-checked={currency === option.value}
                      onClick={() => setCurrency(option.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        currency === option.value
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

              <div>
                <label
                  htmlFor="pdf-price-list-notes"
                  className="mb-1 block text-sm font-semibold text-stone-700"
                >
                  Observações (opcional)
                </label>
                <textarea
                  id="pdf-price-list-notes"
                  value={notes}
                  maxLength={PDF_NOTES_MAX_LENGTH}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Ex.: Preços FOB; validade de 5 dias; sujeito a disponibilidade de estoque"
                  className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="mt-1 flex justify-between gap-3 text-xs text-stone-500">
                  <span>Uma informação por linha. O PDF continua em uma única página.</span>
                  <span>
                    {notes.length}/{PDF_NOTES_MAX_LENGTH}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedGroup || selectedListIds.length === 0 || loading || generating}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Gerando PDF...' : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
