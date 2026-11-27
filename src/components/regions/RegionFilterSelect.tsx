import React from 'react';
import type { Region } from '../../types';

/** Valor do filtro: '' = todas, 'none' = sem região, ou o id da região. */
export function matchesRegionFilter(regionId: string | null | undefined, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'none') return !regionId;
  return regionId === filter;
}

/** Filtro de região reaproveitável; some quando a empresa não tem regiões. */
export default function RegionFilterSelect({
  regions,
  value,
  onChange,
  className = 'h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700',
}: {
  regions: Region[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (regions.length === 0) return null;
  return (
    <select
      aria-label="Filtrar por região"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">Todas as regiões</option>
      <option value="none">Sem região</option>
      {regions.map((region) => (
        <option key={region.id} value={region.id}>
          {region.name}
          {region.ativo ? '' : ' (inativa)'}
        </option>
      ))}
    </select>
  );
}
