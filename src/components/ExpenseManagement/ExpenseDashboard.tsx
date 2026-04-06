import React, { useState } from 'react';
import { User } from '../../types';
import { useExpenses } from '../../hooks/useExpenses';
import ExpenseList from './ExpenseList';
import NewExpenseForm from './NewExpenseForm';
import ExpenseDetailModal from './ExpenseDetailModal';
import ExpenseReport from './ExpenseReport';
import ExpenseCategoryManager from './ExpenseCategoryManager';
import { CreditCardExpense } from '../../types/expense.types';
import { CreditCard } from 'lucide-react';

interface ExpenseDashboardProps {
  currentUser: User;
  view?: 'lancamentos' | 'novo' | 'relatorios' | 'categorias';
}

export default function ExpenseDashboard({ currentUser, view = 'lancamentos' }: ExpenseDashboardProps) {
  const [selectedExpense, setSelectedExpense] = useState<CreditCardExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<CreditCardExpense | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const {
    expenses,
    categories,
    budgetStatus,
    loading,
    error,
    period,
    setPeriod,
    addExpense,
    editExpense,
    removeExpense,
    checkExpense,
    approveExpense,
    rejectExpense,
    refetch,
  } = useExpenses(currentUser.id, currentUser.name);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const handlePeriodChange = (direction: number) => {
    setPeriod(prev => {
      let m = prev.month + direction;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { month: m, year: y };
    });
  };

  return (
    <div className="space-y-6">
      {/* Period selector — shown only on list and report views */}
      {(view === 'lancamentos' || view === 'relatorios') && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-purple-600" />
              {view === 'lancamentos' ? 'Gastos' : 'Relatórios'}
            </h1>
            <p className="text-stone-500 text-sm mt-1">Controle de despesas do cartão de crédito corporativo</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePeriodChange(-1)} className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">‹</button>
            <span className="text-sm font-bold text-stone-700 min-w-[140px] text-center">{monthNames[period.month - 1]} {period.year}</span>
            <button onClick={() => handlePeriodChange(1)} className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">›</button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* Views */}
      {view === 'lancamentos' && !showNewForm && (
        <ExpenseList
          expenses={expenses}
          categories={categories}
          loading={loading}
          currentUser={currentUser}
          onSelect={setSelectedExpense}
          onEdit={(expense) => { setEditingExpense(expense); setShowNewForm(true); }}
          onDelete={removeExpense}
          onCheck={checkExpense}
          onApprove={approveExpense}
          onReject={rejectExpense}
        />
      )}

      {(view === 'novo' || showNewForm) && (
        <NewExpenseForm
          currentUser={currentUser}
          categories={categories}
          period={period}
          initialData={editingExpense}
          onSave={async (data) => {
            if (editingExpense) {
              await editExpense(editingExpense.id, data);
            } else {
              await addExpense(data as any);
            }
            setShowNewForm(false);
            setEditingExpense(null);
          }}
          onCancel={() => { setShowNewForm(false); setEditingExpense(null); }}
        />
      )}

      {view === 'relatorios' && (
        <ExpenseReport
          expenses={expenses}
          budgetStatus={budgetStatus}
          period={period}
        />
      )}

      {view === 'categorias' && (
        <ExpenseCategoryManager onCategoriesChanged={refetch} />
      )}

      {/* Detail Modal */}
      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          currentUser={currentUser}
          onClose={() => setSelectedExpense(null)}
          onCheck={async () => { await checkExpense(selectedExpense.id); setSelectedExpense(null); }}
          onApprove={async () => { await approveExpense(selectedExpense.id); setSelectedExpense(null); }}
          onReject={async (obs) => { await rejectExpense(selectedExpense.id, obs); setSelectedExpense(null); }}
        />
      )}
    </div>
  );
}

