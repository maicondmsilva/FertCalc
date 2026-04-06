import React, { useState } from 'react';
import { CreditCardExpense, ExpenseCategory, ExpenseStatus } from '../../types/expense.types';
import { User } from '../../types';
import { Search, Trash2, Edit3, Eye, CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { useExpensePermissions } from '../../hooks/useExpensePermissions';

interface ExpenseListProps {
  expenses: CreditCardExpense[];
  categories: ExpenseCategory[];
  loading: boolean;
  currentUser: User;
  onSelect: (expense: CreditCardExpense) => void;
  onEdit: (expense: CreditCardExpense) => void;
  onDelete: (id: string) => void;
  onCheck: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, observation: string) => void;
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

export default function ExpenseList({
  expenses,
  categories,
  loading,
  currentUser,
  onSelect,
  onEdit,
  onDelete,
  onCheck,
  onApprove,
  onReject,
}: ExpenseListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectObservation, setRejectObservation] = useState('');

  const { canLaunch, canCheck, canApprove, canAdmin } = useExpensePermissions(currentUser);

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.userName.toLowerCase().includes(search.toLowerCase()) ||
      (e.cardName && e.cardName.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || e.status === statusFilter;
    const matchCategory = !categoryFilter || e.categoryId === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const handleReject = (id: string) => {
    if (rejectObservation.trim()) {
      onReject(id, rejectObservation.trim());
      setRejectingId(null);
      setRejectObservation('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | '')}
          className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
        >
          <option value="">Todos os Status</option>
          <option value="pendente">Pendente</option>
          <option value="conferido">Conferido</option>
          <option value="aprovado">Aprovado</option>
          <option value="rejeitado">Rejeitado</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
        >
          <option value="">Todas Categorias</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg font-bold">Nenhum gasto encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou adicione um novo gasto.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Data</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Descrição</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Categoria</th>
                  <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Cartão</th>
                  <th className="text-right py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Valor</th>
                  <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Parcela</th>
                  <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((expense) => (
                  <tr key={expense.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-stone-800">{expense.description}</p>
                        <p className="text-xs text-stone-400">{expense.userName}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600">{expense.categoryName || '—'}</td>
                    <td className="py-3 px-4 text-stone-600">{expense.cardName || '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-stone-800 whitespace-nowrap">
                      {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-3 px-4 text-center text-stone-600">
                      {expense.installments > 1
                        ? `${expense.currentInstallment || 1}/${expense.installments}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[expense.status]}`}>
                        {statusLabels[expense.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelect(expense)}
                          className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {((expense.userId === currentUser.id && canLaunch) || canAdmin) && expense.status === 'pendente' && (
                          <button
                            onClick={() => onEdit(expense)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canCheck && expense.status === 'pendente' && (
                          <button
                            onClick={() => onCheck(expense.id)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Conferir"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                          </button>
                        )}
                        {canApprove && (expense.status === 'pendente' || expense.status === 'conferido') && (
                          <button
                            onClick={() => onApprove(expense.id)}
                            className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Aprovar"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {canApprove && (expense.status === 'pendente' || expense.status === 'conferido') && (
                          <button
                            onClick={() => setRejectingId(expense.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Rejeitar"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(expense.userId === currentUser.id || canAdmin) && expense.status === 'pendente' && (
                          <button
                            onClick={() => { if (window.confirm('Deseja excluir este gasto?')) onDelete(expense.id); }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Rejeitar Gasto</h3>
            <textarea
              value={rejectObservation}
              onChange={(e) => setRejectObservation(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={3}
              className="w-full border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectingId(null); setRejectObservation(''); }}
                className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={!rejectObservation.trim()}
                className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
