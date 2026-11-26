import React from 'react';
import {
  CheckCircle2,
  CircleDot,
  FilePlus,
  FileEdit,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { AuditLogCarregamento } from '../services/auditLogService';
import {
  describeAuditEntry,
  type AuditDescription,
  type AuditNameLookup,
} from '../utils/auditHistory';

const TONE: Record<
  AuditDescription['tone'],
  { Icon: React.ComponentType<{ className?: string }>; dot: string }
> = {
  created: { Icon: FilePlus, dot: 'bg-blue-100 text-blue-700' },
  progress: { Icon: CircleDot, dot: 'bg-amber-100 text-amber-700' },
  approved: { Icon: CheckCircle2, dot: 'bg-emerald-100 text-emerald-700' },
  returned: { Icon: RotateCcw, dot: 'bg-orange-100 text-orange-700' },
  cancelled: { Icon: XCircle, dot: 'bg-red-100 text-red-700' },
  edited: { Icon: FileEdit, dot: 'bg-stone-100 text-stone-600' },
  deleted: { Icon: Trash2, dot: 'bg-red-100 text-red-700' },
};

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/** Linha do tempo do histórico, em mensagens que o usuário entende. */
export default function AuditTimeline({
  entries,
  names,
  compact = false,
}: {
  entries: AuditLogCarregamento[];
  names?: AuditNameLookup;
  compact?: boolean;
}) {
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-stone-200">
      {entries.map((entry, index) => {
        const description = describeAuditEntry(entry, names);
        const { Icon, dot } = TONE[description.tone];
        return (
          <li key={entry.id ?? index} className="relative flex gap-3">
            <span
              className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${dot}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={`font-bold text-stone-800 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {description.title}
                </p>
                <span className="text-[11px] text-stone-400">{when(entry.criado_em)}</span>
              </div>
              <p className="text-xs text-stone-500">por {entry.usuario_nome || 'sistema'}</p>
              {description.details.length > 0 && (
                <p className={`mt-1 text-stone-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {description.details.join(' · ')}
                </p>
              )}
              {description.changes.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {description.changes.map((change) => (
                    <li
                      key={change.field}
                      className="flex flex-wrap items-baseline gap-x-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-stone-500">{change.label}:</span>
                      <span className="text-stone-400 line-through">{change.before}</span>
                      <span className="text-stone-400">→</span>
                      <span className="font-semibold text-emerald-700">{change.after}</span>
                    </li>
                  ))}
                </ul>
              )}
              {description.note && (
                <p className="mt-1 text-xs italic text-stone-500">“{description.note}”</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
