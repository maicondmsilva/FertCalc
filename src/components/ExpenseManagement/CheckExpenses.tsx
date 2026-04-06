import React, { useState, useEffect, useCallback } from 'react';
import { CreditCardExpense, ExpenseCategory } from '../../types/expense.types';
import { User } from '../../types';
import { getExpenses, checkExpense, getExpenseAudit, getExpenseCategories } from '../../services/expenseService';
import { Eye, ClipboardCheck, Search, X } from 'lucide-react';

interface CheckExpensesProps {
  currentUser: User;
}

export default function CheckExpenses({ currentUser }: CheckExpensesProps) {
  const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [detailExpense, setDetailExpense] = useState<CreditCardExpense | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [all, cats] = await Promise.all([
        getExpenses(),
        getExpenseCategories(),
      ]);
      setExpenses(all.filter(e => e.status === 'pendente'));
      setCategories(cats);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheck = async (id: string) => {
    setProcessing(id);
    try {
      await checkExpense(id, currentUser.id, currentUser.name);
      setExpenses(prev => prev.filter(e => e.id !== id));
      setConfirmId(null);
    } catch (err) {
      console.error('Erro ao conferir:', err);
    } finally {
      setProcessing(null);
    }
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
            <ClipboardCheck className="w-7 h-7 text-purple-600" />
            Conferência
          </h1>
          <p className="text-stone-500 text-sm mt-1">Lançamentos pendentes de conferência</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
          {expenses.length} pendente{expenses.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar por descrição, usuário ou cartão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-bold">Nenhum lançamento pendente</p>
          <p className="text-sm mt-1">Todos os lançamentos foram conferidos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
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
                  <tr key={expense.id} className="hover:bg-stone-50 transition-colors">
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
                          onClick={() => setConfirmId(expense.id)}
                          disabled={processing === expense.id}
                          className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Conferir"
                        >
                          <ClipboardCheck className="w-4 h-4" />
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

      {/* Confirm Modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-stone-800 mb-3">Confirmar Conferência</h3>
            <p className="text-stone-600 text-sm mb-6">
              Confirma a conferência deste lançamento? O status será alterado para <span className="font-bold text-blue-700">Conferido</span>.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCheck(confirmId)}
                disabled={processing === confirmId}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {processing === confirmId ? 'Conferindo...' : 'Confirmar'}
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
              <button
                onClick={() => { setDetailExpense(null); setAuditLog([]); }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
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
              {detailExpense.observation && (
                <div className="flex justify-between">
                  <dt className="font-bold text-stone-500">Observação</dt>
                  <dd className="text-stone-800">{detailExpense.observation}</dd>
                </div>
              )}
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
              <button
                onClick={() => { setDetailExpense(null); setAuditLog([]); }}
                className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100"
              >
                Fechar
              </button>
              <button
                onClick={() => { setDetailExpense(null); setAuditLog([]); setConfirmId(detailExpense.id); }}
                disabled={processing === detailExpense.id}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                Conferir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
