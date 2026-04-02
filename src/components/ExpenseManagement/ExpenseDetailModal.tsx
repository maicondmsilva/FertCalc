import React, { useState, useEffect } from 'react';
import { CreditCardExpense, ExpenseAudit, ExpenseStatus } from '../../types/expense.types';
import { User } from '../../types';
import { getExpenseAudit } from '../../services/expenseService';
import { X, CheckCircle, XCircle, ClipboardCheck, Clock, Edit3, Trash2, FileText } from 'lucide-react';

interface ExpenseDetailModalProps {
  expense: CreditCardExpense;
  currentUser: User;
  onClose: () => void;
  onCheck: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (observation: string) => Promise<void>;
}

const statusLabels: Record<ExpenseStatus, string> = {
  pendente: 'Pendente',
  conferido: 'Conferido',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

const statusColors: Record<ExpenseStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  conferido: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-emerald-100 text-emerald-700',
  rejeitado: 'bg-red-100 text-red-700',
};

const auditIcons: Record<string, React.ReactNode> = {
  criado: <FileText className="w-4 h-4 text-blue-500" />,
  conferido: <ClipboardCheck className="w-4 h-4 text-blue-500" />,
  aprovado: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  rejeitado: <XCircle className="w-4 h-4 text-red-500" />,
  editado: <Edit3 className="w-4 h-4 text-amber-500" />,
  excluido: <Trash2 className="w-4 h-4 text-red-500" />,
};

export default function ExpenseDetailModal({ expense, currentUser, onClose, onCheck, onApprove, onReject }: ExpenseDetailModalProps) {
  const [audit, setAudit] = useState<ExpenseAudit[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectObservation, setRejectObservation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';

  useEffect(() => {
    setLoadingAudit(true);
    getExpenseAudit(expense.id)
      .then(setAudit)
      .catch(() => setAudit([]))
      .finally(() => setLoadingAudit(false));
  }, [expense.id]);

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true);
    try {
      await action();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">Detalhes do Gasto</h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[expense.status]}`}>
              {statusLabels[expense.status]}
            </span>
            <span className="text-xs text-stone-400">
              {new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>

          {/* Details Grid */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Descrição</p>
              <p className="text-sm text-stone-800 font-medium mt-0.5">{expense.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Valor</p>
                <p className="text-lg font-black text-stone-800 mt-0.5">
                  {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Categoria</p>
                <p className="text-sm text-stone-600 mt-0.5">{expense.categoryName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Cartão</p>
                <p className="text-sm text-stone-600 mt-0.5">{expense.cardName || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Parcelas</p>
                <p className="text-sm text-stone-600 mt-0.5">
                  {expense.installments > 1
                    ? `${expense.currentInstallment || 1}/${expense.installments}`
                    : 'À vista'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Registrado por</p>
                <p className="text-sm text-stone-600 mt-0.5">{expense.userName}</p>
              </div>
            </div>
            {expense.observation && (
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Observação</p>
                <p className="text-sm text-stone-600 mt-0.5">{expense.observation}</p>
              </div>
            )}
          </div>

          {/* Audit Trail */}
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Histórico</p>
            {loadingAudit ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
              </div>
            ) : audit.length === 0 ? (
              <p className="text-sm text-stone-400">Nenhum registro de auditoria.</p>
            ) : (
              <div className="space-y-2">
                {audit.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
                    <div className="mt-0.5">{auditIcons[entry.action] || <Clock className="w-4 h-4 text-stone-400" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700">
                        <span className="font-bold">{entry.userName}</span>
                        {' '}
                        {entry.action === 'criado' && 'registrou o gasto'}
                        {entry.action === 'conferido' && 'conferiu o gasto'}
                        {entry.action === 'aprovado' && 'aprovou o gasto'}
                        {entry.action === 'rejeitado' && 'rejeitou o gasto'}
                        {entry.action === 'editado' && 'editou o gasto'}
                        {entry.action === 'excluido' && 'excluiu o gasto'}
                      </p>
                      {entry.observation && (
                        <p className="text-xs text-stone-500 mt-0.5">"{entry.observation}"</p>
                      )}
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(entry.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reject form */}
          {rejectMode && (
            <div className="space-y-3 p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm font-bold text-red-700">Motivo da rejeição:</p>
              <textarea
                value={rejectObservation}
                onChange={(e) => setRejectObservation(e.target.value)}
                rows={3}
                className="w-full border border-red-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Descreva o motivo..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setRejectMode(false); setRejectObservation(''); }}
                  className="px-3 py-1.5 text-sm font-bold text-stone-500 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAction(() => onReject(rejectObservation))}
                  disabled={!rejectObservation.trim() || actionLoading}
                  className="px-4 py-1.5 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmar Rejeição
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isAdmin && !rejectMode && (expense.status === 'pendente' || expense.status === 'conferido') && (
          <div className="flex items-center justify-end gap-2 p-6 border-t border-stone-100">
            {expense.status === 'pendente' && (
              <button
                onClick={() => handleAction(onCheck)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                Conferir
              </button>
            )}
            <button
              onClick={() => handleAction(onApprove)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar
            </button>
            <button
              onClick={() => setRejectMode(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Rejeitar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
