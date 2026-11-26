import React, { useState, useEffect } from 'react';
import { X, RefreshCw, History } from 'lucide-react';
import { getAuditLog, AuditLogCarregamento } from '../services/auditLogService';
import { getTransportadoras } from '../services/carregamentoService';
import AuditTimeline from './AuditTimeline';
import type { AuditNameLookup } from '../utils/auditHistory';
import { closeModalOnBackdrop } from '../utils/modalUtils';

interface HistoricoModificacoesProps {
  tabela: 'carregamentos' | 'cotacoes_solicitadas';
  registroId: string;
  titulo: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoricoModificacoes({
  tabela,
  registroId,
  titulo,
  isOpen,
  onClose,
}: HistoricoModificacoesProps) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<AuditLogCarregamento[]>([]);
  const [names, setNames] = useState<AuditNameLookup>({});

  useEffect(() => {
    if (!isOpen || !registroId) return;
    setLoading(true);
    getAuditLog(tabela, registroId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
    // Nomes das transportadoras: o histórico antigo guarda só o id.
    getTransportadoras()
      .then((list) =>
        setNames(Object.fromEntries(list.map((item) => [item.id, item.nome] as const)))
      )
      .catch(() => undefined);
  }, [isOpen, tabela, registroId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-stone-500" />
            <div>
              <p className="font-bold text-stone-800 text-sm">Histórico de Modificações</p>
              <p className="text-xs text-stone-400 mt-0.5">{titulo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma modificação registrada.</p>
            </div>
          ) : (
            <AuditTimeline entries={entries} names={names} />
          )}
        </div>
      </div>
    </div>
  );
}
