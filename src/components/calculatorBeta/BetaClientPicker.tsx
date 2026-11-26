import React, { useMemo, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import type { Agent, Client } from '../../types';
import { matchesRegistrySearch } from '../registry/registryModel';

const EMPTY_CLIENT = { id: '', code: '', name: '', document: '' };

type Party = Client | Agent;

/**
 * Cliente ou agente da precificação. Busca por nome, código, documento,
 * fazenda ou cidade; mostra o escolhido com opção de trocar.
 */
export default function BetaClientPicker({
  clients,
  selected,
  search,
  onSearchChange,
  onSelect,
  disabled = false,
  noun = 'cliente',
  inputId = 'beta-client',
}: {
  clients: Party[];
  selected?: { id?: string; code?: string; name?: string; document?: string };
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (party: Party | typeof EMPTY_CLIENT) => void;
  disabled?: boolean;
  noun?: 'cliente' | 'agente';
  inputId?: string;
}) {
  const [open, setOpen] = useState(false);
  const results = useMemo(
    () =>
      search.trim()
        ? clients.filter((client) => matchesRegistrySearch(client, search)).slice(0, 8)
        : [],
    [clients, search]
  );

  if (selected?.id) {
    return (
      <div className="flex h-11 items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3">
        <UserRound className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-bold text-emerald-900">{selected.name}</span>
          <span className="ml-2 text-xs text-emerald-700">
            cód. {selected.code}
            {selected.document ? ` · ${selected.document}` : ''}
          </span>
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onSelect(EMPTY_CLIENT);
              onSearchChange('');
            }}
            aria-label={`Trocar ${noun}`}
            className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        id={inputId}
        value={search}
        disabled={disabled}
        onChange={(event) => {
          onSearchChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Buscar ${noun} por nome, código ou documento`}
        className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {open && search.trim() && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-stone-500">Nenhum {noun} encontrado.</li>
          ) : (
            results.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(client);
                    onSearchChange(client.name);
                    setOpen(false);
                  }}
                  className="block w-full border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-emerald-50"
                >
                  <span className="block text-sm font-bold text-stone-800">{client.name}</span>
                  <span className="text-xs text-stone-500">
                    cód. {client.code}
                    {client.document ? ` · ${client.document}` : ''}
                    {'fazenda' in client && client.fazenda ? ` · ${client.fazenda}` : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
