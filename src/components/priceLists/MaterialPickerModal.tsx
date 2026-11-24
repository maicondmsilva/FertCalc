import React, { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { MacroMaterial, MicroMaterial } from '../../types';
import { closeModalOnBackdrop } from '../../utils/modalUtils';

interface MaterialPickerModalProps {
  title: string;
  items: Array<MacroMaterial | MicroMaterial>;
  alreadyAdded: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

/** Escolha de matérias-primas do cadastro para incluir na lista. */
export function MaterialPickerModal({
  title,
  items,
  alreadyAdded,
  onSelect,
  onClose,
}: MaterialPickerModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return items;
    return items.filter(
      (item) => normalize(item.name).includes(term) || normalize(item.code).includes(term)
    );
  }, [items, query]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-black text-stone-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-stone-100 px-5 py-3">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar por nome ou código"
              className="h-10 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <p className="mt-1.5 text-xs text-stone-500">
            {filtered.length} disponíveis · {selected.size} selecionada(s)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-400">
              Nenhuma matéria-prima encontrada.
            </p>
          )}
          {filtered.map((item) => {
            const added = alreadyAdded.includes(item.id);
            const checked = selected.has(item.id);
            const premium = 'isPremiumLine' in item && item.isPremiumLine;
            return (
              <button
                key={item.id}
                type="button"
                disabled={added}
                onClick={() => toggle(item.id)}
                className={`flex w-full items-center gap-3 border-b border-stone-50 px-5 py-3 text-left last:border-0 ${
                  added
                    ? 'cursor-not-allowed bg-stone-50 opacity-50'
                    : checked
                      ? 'bg-emerald-50'
                      : 'hover:bg-stone-50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    added
                      ? 'border-stone-300 bg-stone-200'
                      : checked
                        ? 'border-emerald-600 bg-emerald-600'
                        : 'border-stone-300'
                  }`}
                >
                  {(checked || added) && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-700">
                      {item.code}
                    </span>
                    {premium && (
                      <span className="rounded bg-amber-100 px-1.5 text-[10px] font-black uppercase text-amber-700">
                        Diferenciada
                      </span>
                    )}
                    {added && (
                      <span className="rounded bg-stone-200 px-1.5 text-[10px] font-bold uppercase text-stone-500">
                        Já na lista
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm font-semibold text-stone-800">
                    {item.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-600 hover:bg-stone-50"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => {
              onSelect([...selected]);
              onClose();
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
