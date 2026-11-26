import React from 'react';
import { MapPin } from 'lucide-react';
import type { MyRegions } from '../../hooks/useMyRegions';

/** Problema da região ao salvar a precificação, ou null. */
export function pricingRegionProblem(regions: MyRegions, value?: string | null): string | null {
  if (regions.loading || !regions.orgHasRegions) return null;
  if (regions.options.length === 0)
    return 'Você não tem região. Peça ao administrador para vincular uma em Usuários → Regiões.';
  if (!value || !regions.options.some((region) => region.id === value))
    return 'Escolha a região da precificação.';
  return null;
}

const boxClass =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold';

/**
 * Região da precificação: a principal já vem marcada; com uma região só, fica
 * fixa; sem região, avisa. Editando uma precificação salva, mostra a região dela
 * (muda só pela transferência, na tela de Precificações).
 */
export default function PricingRegionField({
  id,
  regions,
  value,
  onChange,
  disabled,
  lockedRegionId,
  compact = false,
}: {
  id: string;
  regions: MyRegions;
  value?: string | null;
  onChange: (regionId: string) => void;
  disabled?: boolean;
  /** Precificação já salva: região fixa (transferência é outra ação). */
  lockedRegionId?: string | null;
  compact?: boolean;
}) {
  if (!regions.orgHasRegions && !lockedRegionId) return null;
  const labelClass = compact
    ? 'mb-1 flex items-center text-sm font-medium text-stone-600'
    : 'mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500';
  const name = (regionId?: string | null) =>
    regions.all.find((region) => region.id === regionId)?.name || 'Sem região';

  const label = (hint?: string) => (
    <label htmlFor={id} className={labelClass}>
      <MapPin className={compact ? 'mr-1 h-4 w-4' : 'h-4 w-4'} /> Região
      {hint && (
        <span className="ml-1 font-medium normal-case tracking-normal text-stone-400">{hint}</span>
      )}
    </label>
  );

  if (lockedRegionId !== undefined) {
    return (
      <div>
        {label()}
        <div id={id} className={`${boxClass} border-stone-200 bg-stone-50 text-stone-700`}>
          <span className="truncate">{name(lockedRegionId)}</span>
          <span className="shrink-0 text-[10px] font-bold text-stone-400">
            transferir em Precificações
          </span>
        </div>
      </div>
    );
  }

  if (regions.loading) {
    return (
      <div>
        {label()}
        <div className={`${boxClass} animate-pulse border-stone-200 bg-stone-100`} />
      </div>
    );
  }

  if (regions.options.length === 0) {
    return (
      <div>
        {label('(obrigatória)')}
        <div id={id} className={`${boxClass} border-red-300 bg-red-50 text-red-600`}>
          Nenhuma região
        </div>
      </div>
    );
  }

  if (regions.options.length === 1) {
    return (
      <div>
        {label()}
        <div id={id} className={`${boxClass} border-stone-300 bg-stone-50 text-stone-800`}>
          <span className="truncate">{regions.options[0].name}</span>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            sua região
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label('(obrigatória)')}
      <select
        id={id}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${boxClass} border-stone-300 bg-white text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-stone-100`}
      >
        <option value="">Selecione a região</option>
        {regions.options.map((region) => (
          <option key={region.id} value={region.id}>
            {region.id === regions.principalId ? `★ ${region.name} (principal)` : region.name}
          </option>
        ))}
      </select>
    </div>
  );
}
