import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { GuaranteeRow } from '../../utils/guaranteeBreakdown';
import { formatGuarantee } from '../../utils/formatters';

const TOLERANCE = 0.01;

function status(row: GuaranteeRow) {
  if (!(row.target > 0)) return { label: 'Sem meta', tone: 'bg-stone-100 text-stone-600' };
  if (row.obtained + TOLERANCE >= row.target)
    return { label: 'Atingida', tone: 'bg-emerald-100 text-emerald-800' };
  return { label: 'Abaixo', tone: 'bg-amber-100 text-amber-800' };
}

const kindLabel: Record<GuaranteeRow['kind'], string> = {
  primario: 'Primário',
  secundario: 'Secundário',
  micro: 'Micro',
};

/**
 * Soma de cada garantia que entrou na batida e de qual produto ela veio —
 * inclusive micros que chegam dentro dos macros e os que não têm meta.
 */
export default function GuaranteeBreakdownTable({ rows }: { rows: GuaranteeRow[] }) {
  if (rows.length === 0) return null;
  const withoutTarget = rows.filter((row) => !(row.target > 0) && row.obtained > 0).length;
  return (
    <details open className="group mt-3 overflow-hidden rounded-2xl border border-stone-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-stone-50 px-4 py-3">
        <span>
          <span className="block text-[15px] font-black text-stone-900">
            Somatória das garantias na batida
          </span>
          <span className="block text-xs text-stone-500">
            {rows.length} nutriente{rows.length === 1 ? '' : 's'}
            {withoutTarget > 0 && ` · ${withoutTarget} sem meta (vieram nos produtos)`}
          </span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>

      {/* Tabela (telas largas) */}
      <div className="hidden overflow-x-auto @3xl:block">
        <table className="w-full text-sm">
          <thead className="border-y border-stone-200 bg-white text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Nutriente</th>
              <th className="px-3 py-2 text-right">Meta</th>
              <th className="px-3 py-2 text-right">Obtido</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-4 py-2">De onde veio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => {
              const current = status(row);
              return (
                <tr key={row.key} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className="font-black text-stone-900">{row.label}</span>
                    <span className="ml-1.5 text-xs text-stone-400">{kindLabel[row.kind]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-stone-600">
                    {row.target > 0 ? formatGuarantee(row.target) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-stone-900">
                    {formatGuarantee(row.obtained)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${current.tone}`}>
                      {current.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Contributions row={row} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cartões (celular) */}
      <ul className="divide-y divide-stone-100 @3xl:hidden">
        {rows.map((row) => {
          const current = status(row);
          return (
            <li key={row.key} className="space-y-1.5 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-black text-stone-900">{row.label}</span>
                  <span className="ml-1.5 text-xs text-stone-400">{kindLabel[row.kind]}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${current.tone}`}>
                  {current.label}
                </span>
              </div>
              <p className="font-mono text-sm tabular-nums text-stone-700">
                <span className="font-bold text-stone-900">{formatGuarantee(row.obtained)}</span>
                {row.target > 0 && (
                  <span className="text-stone-500"> / meta {formatGuarantee(row.target)}</span>
                )}
              </p>
              <Contributions row={row} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function Contributions({ row }: { row: GuaranteeRow }) {
  if (row.contributions.length === 0)
    return (
      <span className="text-xs font-semibold text-amber-700">
        Nenhum produto da batida tem este nutriente.
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.contributions.map((item) => (
        <span
          key={item.materialId}
          className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700"
        >
          {item.name}{' '}
          <span className="font-mono font-bold tabular-nums text-stone-900">
            {formatGuarantee(item.percent)}
          </span>
        </span>
      ))}
    </div>
  );
}
