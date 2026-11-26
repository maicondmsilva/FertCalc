import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  filterPermissionGroups,
  isEnabled,
  setGroup,
  type PermissionMap,
} from './permissionCatalog';

interface PermissionEditorProps {
  permissions: PermissionMap;
  onChange: (next: PermissionMap) => void;
  /** Perfil de referência: marca o que está diferente dele. */
  baseline?: PermissionMap;
  disabled?: boolean;
  /** Conteúdo extra ao lado da busca (ex.: "Aplicar perfil"). */
  toolbar?: React.ReactNode;
}

function Toggle({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      aria-hidden="true"
      data-label={label}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? 'bg-emerald-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </span>
  );
}

/** Lista de permissões agrupada, com busca, contagem e "marcar todos". */
export default function PermissionEditor({
  permissions,
  onChange,
  baseline,
  disabled = false,
  toolbar,
}: PermissionEditorProps) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => filterPermissionGroups(query), [query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar permissão (ex.: cotação, excluir)"
            aria-label="Buscar permissão"
            className="h-full w-full bg-transparent text-sm outline-none"
          />
        </label>
        {toolbar}
      </div>

      {groups.length === 0 && (
        <p className="rounded-xl bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">
          Nenhuma permissão encontrada para “{query}”.
        </p>
      )}

      {groups.map((group) => {
        const enabled = group.items.filter((item) => isEnabled(permissions, item.id)).length;
        const allOn = enabled === group.items.length;
        return (
          <section key={group.id} className="rounded-xl border border-stone-200 bg-white">
            <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-3 py-2">
              <h4 className="text-sm font-black text-stone-900">
                {group.title}{' '}
                <span className="ml-1 text-xs font-semibold text-stone-500">
                  {enabled}/{group.items.length}
                </span>
              </h4>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(setGroup(permissions, group, !allOn))}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  {allOn ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
            </header>
            <div className="grid gap-x-2 p-1 sm:grid-cols-2">
              {group.items.map((item) => {
                const on = isEnabled(permissions, item.id);
                const differs = baseline !== undefined && on !== isEnabled(baseline, item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => onChange({ ...permissions, [item.id]: !on })}
                    className={`flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 disabled:cursor-not-allowed ${
                      on ? 'text-stone-800' : 'text-stone-500'
                    }`}
                  >
                    <span>
                      {item.label}
                      {differs && (
                        <span className="ml-1.5 whitespace-nowrap rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                          diferente do perfil
                        </span>
                      )}
                    </span>
                    <Toggle on={on} label={item.label} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
