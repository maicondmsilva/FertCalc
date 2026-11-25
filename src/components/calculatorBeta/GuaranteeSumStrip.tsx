import React from 'react';
import type { GuaranteeRow } from '../../utils/guaranteeBreakdown';
import { formatGuarantee } from '../../utils/formatters';

/**
 * Somatória das garantias da batida em uma linha só (N - 20,10 · P - 10,40 …),
 * inclusive micros que vieram nos produtos sem meta. Abaixo da meta fica em âmbar.
 */
export default function GuaranteeSumStrip({ rows }: { rows: GuaranteeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-stone-200 bg-white px-4 py-2.5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">
        Somatória das garantias
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
        {rows.map((row) => {
          const below = row.target > 0 && row.obtained + 0.01 < row.target;
          return (
            <span
              key={row.key}
              title={row.target > 0 ? `Meta ${formatGuarantee(row.target)}` : 'Sem meta'}
              className={below ? 'font-bold text-amber-700' : 'text-stone-800'}
            >
              <span className="font-black">{row.label}</span> - {formatGuarantee(row.obtained)}
            </span>
          );
        })}
      </p>
    </div>
  );
}
