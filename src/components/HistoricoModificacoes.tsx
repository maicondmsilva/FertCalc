import React, { useState, useEffect } from 'react';
import { X, RefreshCw, History, FileEdit, FilePlus, Trash2 } from 'lucide-react';
import { getAuditLog, AuditLogCarregamento } from '../services/auditLogService';

interface HistoricoModificacoesProps {
  tabela: 'carregamentos' | 'cotacoes_solicitadas';
  registroId: string;
  titulo: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const ACAO_CONFIG: Record<
  AuditLogCarregamento['acao'],
  { label: string; color: string; Icon: React.ElementType }
> = {
  INSERT: { label: 'Criação', color: 'bg-blue-100 text-blue-700', Icon: FilePlus },
  UPDATE: { label: 'Edição', color: 'bg-amber-100 text-amber-700', Icon: FileEdit },
  DELETE: { label: 'Exclusão', color: 'bg-red-100 text-red-700', Icon: Trash2 },
};

function AcaoBadge({ acao }: { acao: AuditLogCarregamento['acao'] }) {
  const config = ACAO_CONFIG[acao];
  const Icon = config.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
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

  useEffect(() => {
    if (!isOpen || !registroId) return;
    setLoading(true);
    getAuditLog(tabela, registroId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [isOpen, tabela, registroId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
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
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className="border border-stone-200 rounded-xl overflow-hidden">
                  {/* Entry header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <AcaoBadge acao={entry.acao} />
                      <span className="text-sm font-medium text-stone-700">
                        {entry.usuario_nome}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400">
                      {formatDateTime(entry.criado_em)}
                    </span>
                  </div>

                  {/* Entry body */}
                  <div className="p-4 space-y-3">
                    {/* Motivo */}
                    {entry.motivo && (
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">
                          Motivo
                        </p>
                        <p className="text-sm text-stone-700">{entry.motivo}</p>
                      </div>
                    )}

                    {/* Campos alterados (UPDATE) */}
                    {entry.acao === 'UPDATE' &&
                      entry.campos_alterados &&
                      entry.campos_alterados.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                            Campos alterados
                          </p>
                          <div className="space-y-1">
                            {entry.campos_alterados.map((campo) => {
                              const anterior = formatValue(entry.dados_anteriores?.[campo]);
                              const novo = formatValue(entry.dados_novos?.[campo]);
                              return (
                                <div
                                  key={campo}
                                  className="flex items-start gap-2 text-xs text-stone-600 bg-stone-50 rounded-lg px-3 py-2"
                                >
                                  <span className="font-mono font-bold text-stone-500 min-w-[120px] shrink-0">
                                    {campo}
                                  </span>
                                  <span className="text-red-500 line-through">{anterior}</span>
                                  <span className="text-stone-400">→</span>
                                  <span className="text-emerald-600 font-medium">{novo}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* UPDATE sem campos específicos */}
                    {entry.acao === 'UPDATE' &&
                      (!entry.campos_alterados || entry.campos_alterados.length === 0) && (
                        <p className="text-sm text-stone-500 italic">Registro atualizado.</p>
                      )}

                    {/* DELETE — snapshot resumido */}
                    {entry.acao === 'DELETE' && entry.dados_anteriores && (
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                          Dados no momento da exclusão
                        </p>
                        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-stone-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {JSON.stringify(entry.dados_anteriores, null, 2)}
                        </div>
                      </div>
                    )}

                    {/* INSERT */}
                    {entry.acao === 'INSERT' && (
                      <p className="text-sm text-stone-500">Registro criado.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
