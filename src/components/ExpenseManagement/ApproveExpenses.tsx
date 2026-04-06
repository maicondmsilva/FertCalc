import React, { useState, useEffect, useCallback } from 'react';
import { CreditCardExpense } from '../../types/expense.types';
import { User } from '../../types';
import { getExpenses, approveExpense, rejectExpense, getExpenseAudit } from '../../services/expenseService';
import { Eye, CheckCircle, XCircle, Search, X } from 'lucide-react';

interface ApproveExpensesProps {
  currentUser: User;
}

export default function ApproveExpenses({ currentUser }: ApproveExpensesProps) {
  const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [detailExpense, setDetailExpense] = useState<CreditCardExpense | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'approve' | 'reject' | null>(null);
  const [batchNote, setBatchNote] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getExpenses();
      setExpenses(all.filter(e => e.status === 'conferido'));
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await approveExpense(id, currentUser.id, currentUser.name);
      setExpenses(prev => prev.filter(e => e.id !== id));
      setApproveId(null);
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('Erro ao aprovar:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    if (!note.trim()) return;
    setProcessing(id);
    try {
      await rejectExpense(id, currentUser.id, currentUser.name, note.trim());
      setExpenses(prev => prev.filter(e => e.id !== id));
      setRejectId(null);
      setRejectionNote('');
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('Erro ao rejeitar:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleBatchApprove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleApprove(id);
    }
    setSelectedIds(new Set());
    setBatchAction(null);
  };

  const handleBatchReject = async () => {
    if (!batchNote.trim()) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleReject(id, batchNote);
    }
    setSelectedIds(new Set());
    setBatchAction(null);
    setBatchNote('');
  };

  const handleOpenDetail = async (expense: CreditCardExpense) => {
    setDetailExpense(expense);
    try {
      const log = await getExpenseAudit(expense.id);
      setAuditLog(log);
    } catch {
      setAuditLog([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  };

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      e.userName.toLowerCase().includes(q) ||
      (e.cardName && e.cardName.toLowerCase().includes(q)) ||
      (e.categoryName && e.categoryName.toLowerCase().includes(q))
    );
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
            Aprovação
          </h1>
          <p className="text-stone-500 text-sm mt-1">Lançamentos conferidos aguardando aprovação</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
          {expenses.length} aguardando
        </span>
      </div>

      {/* Search + Batch Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, usuário ou cartão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setBatchAction('approve')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar ({selectedIds.size})
            </button>
            <button
              onClick={() => setBatchAction('reject')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              <XCircle className="w-4 h-4" />
              Rejeitar ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-bold">Nenhum lançamento aguardando aprovação</p>
          <p className="text-sm mt-1">Todos os lançamentos foram processados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Data</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Usuário</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Cartão</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Categoria</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Descrição</th>
                  <th className="text-right py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Valor</th>
                  <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((expense) => (
                  <tr key={expense.id} className={`hover:bg-stone-50 transition-colors ${selectedIds.has(expense.id) ? 'bg-purple-50' : ''}`}>
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(expense.id)}
                        onChange={() => toggleSelect(expense.id)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                    </td>
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">{formatDate(expense.date)}</td>
                    <td className="py-3 px-4 text-stone-700 font-medium">{expense.userName}</td>
                    <td className="py-3 px-4 text-stone-600">{expense.cardName || '—'}</td>
                    <td className="py-3 px-4 text-stone-600">{expense.categoryName || '—'}</td>
                    <td className="py-3 px-4 text-stone-800">{expense.description}</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-800 whitespace-nowrap">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetail(expense)}
                          className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setApproveId(expense.id)}
                          disabled={processing === expense.id}
                          className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Aprovar"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setRejectId(expense.id); setRejectionNote(''); }}
                          disabled={processing === expense.id}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Rejeitar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Confirm Modal */}
      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-stone-800 mb-3">Confirmar Aprovação</h3>
            <p className="text-stone-600 text-sm mb-6">
              Confirma a aprovação deste lançamento? O status será alterado para <span className="font-bold text-emerald-700">Aprovado</span>.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setApproveId(null)} className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100">
                Cancelar
              </button>
              <button
                onClick={() => handleApprove(approveId)}
                disabled={processing === approveId}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing === approveId ? 'Aprovando...' : 'Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-stone-800 mb-3">Rejeitar Lançamento</h3>
            <p className="text-stone-500 text-sm mb-4">Informe o motivo da rejeição (obrigatório):</p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={3}
              className="w-full border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setRejectId(null); setRejectionNote(''); }} className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100">
                Cancelar
              </button>
              <button
                onClick={() => handleReject(rejectId, rejectionNote)}
                disabled={!rejectionNote.trim() || processing === rejectId}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {processing === rejectId ? 'Rejeitando...' : 'Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Modal */}
      {batchAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-stone-800 mb-3">
              {batchAction === 'approve' ? 'Aprovar em Lote' : 'Rejeitar em Lote'}
            </h3>
            <p className="text-stone-600 text-sm mb-4">
              {batchAction === 'approve'
                ? `Confirma a aprovação de ${selectedIds.size} lançamento(s)?`
                : `Informe o motivo para rejeitar ${selectedIds.size} lançamento(s):`}
            </p>
            {batchAction === 'reject' && (
              <textarea
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="Motivo da rejeição..."
                rows={3}
                className="w-full border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mb-4"
              />
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setBatchAction(null); setBatchNote(''); }} className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100">
                Cancelar
              </button>
              <button
                onClick={batchAction === 'approve' ? handleBatchApprove : handleBatchReject}
                disabled={batchAction === 'reject' && !batchNote.trim()}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 ${batchAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {batchAction === 'approve' ? 'Aprovar Todos' : 'Rejeitar Todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">Detalhes do Lançamento</h3>
              <button onClick={() => { setDetailExpense(null); setAuditLog([]); }} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Descrição</dt>
                <dd className="text-stone-800">{detailExpense.description}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Usuário</dt>
                <dd className="text-stone-800">{detailExpense.userName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Valor</dt>
                <dd className="font-bold text-stone-800">{formatCurrency(detailExpense.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Data</dt>
                <dd className="text-stone-800">{formatDate(detailExpense.date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Categoria</dt>
                <dd className="text-stone-800">{detailExpense.categoryName || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold text-stone-500">Cartão</dt>
                <dd className="text-stone-800">{detailExpense.cardName || '—'}</dd>
              </div>
            </dl>
            {auditLog.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Histórico</h4>
                <div className="space-y-2">
                  {auditLog.map(entry => (
                    <div key={entry.id} className="text-xs text-stone-600 bg-stone-50 rounded-lg px-3 py-2">
                      <span className="font-bold">{entry.userName}</span> — {entry.action}
                      {entry.observation && <span className="text-stone-400"> ({entry.observation})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setDetailExpense(null); setAuditLog([]); }} className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100">
                Fechar
              </button>
              <button
                onClick={() => { setDetailExpense(null); setAuditLog([]); setApproveId(detailExpense.id); }}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
              >
                Aprovar
              </button>
              <button
                onClick={() => { setDetailExpense(null); setAuditLog([]); setRejectId(detailExpense.id); }}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
