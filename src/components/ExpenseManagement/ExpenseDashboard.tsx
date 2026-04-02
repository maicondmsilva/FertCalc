import React, { useState } from 'react';
import { User } from '../../types';
import { useExpenses } from '../../hooks/useExpenses';
import { ExpensePeriod } from '../../types/expense.types';
import ExpenseList from './ExpenseList';
import NewExpenseForm from './NewExpenseForm';
import ExpenseDetailModal from './ExpenseDetailModal';
import ExpenseReport from './ExpenseReport';
import ExpenseCategoryManager from './ExpenseCategoryManager';
import { CreditCardExpense } from '../../types/expense.types';
import { CreditCard, Plus, BarChart3, Settings, List } from 'lucide-react';

interface ExpenseDashboardProps {
  currentUser: User;
}

type DashboardView = 'list' | 'new' | 'report' | 'categories';

export default function ExpenseDashboard({ currentUser }: ExpenseDashboardProps) {
  const [view, setView] = useState<DashboardView>('list');
  const [selectedExpense, setSelectedExpense] = useState<CreditCardExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<CreditCardExpense | null>(null);

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

  const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';

  const totalMonth = expenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = expenses.filter(e => e.status === 'pendente').length;
  const approvedCount = expenses.filter(e => e.status === 'aprovado').length;

  const handlePeriodChange = (direction: number) => {
    setPeriod(prev => {
      let m = prev.month + direction;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { month: m, year: y };
    });
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-purple-600" />
            Gastos Cartão
          </h1>
          <p className="text-stone-500 text-sm mt-1">Controle de despesas do cartão de crédito corporativo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePeriodChange(-1)}
            className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-stone-700 min-w-[140px] text-center">
            {monthNames[period.month - 1]} {period.year}
          </span>
          <button
            onClick={() => handlePeriodChange(1)}
            className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total do Mês</p>
          <p className="text-2xl font-black text-stone-800 mt-1">
            {totalMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Pendentes</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Aprovados</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <List className="w-4 h-4" />
          Gastos
        </button>
        <button
          onClick={() => { setView('new'); setEditingExpense(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'new' ? 'bg-white text-purple-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Plus className="w-4 h-4" />
          Novo Gasto
        </button>
        <button
          onClick={() => setView('report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'report' ? 'bg-white text-purple-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <BarChart3 className="w-4 h-4" />
          Relatório
        </button>
        {isAdmin && (
          <button
            onClick={() => setView('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'categories' ? 'bg-white text-purple-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Settings className="w-4 h-4" />
            Categorias
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {view === 'list' && (
        <ExpenseList
          expenses={expenses}
          categories={categories}
          loading={loading}
          currentUser={currentUser}
          onSelect={setSelectedExpense}
          onEdit={(expense) => { setEditingExpense(expense); setView('new'); }}
          onDelete={removeExpense}
          onCheck={checkExpense}
          onApprove={approveExpense}
          onReject={rejectExpense}
        />
      )}

      {view === 'new' && (
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
            setView('list');
            setEditingExpense(null);
          }}
          onCancel={() => { setView('list'); setEditingExpense(null); }}
        />
      )}

      {view === 'report' && (
        <ExpenseReport
          expenses={expenses}
          budgetStatus={budgetStatus}
          period={period}
        />
      )}

      {view === 'categories' && isAdmin && (
        <ExpenseCategoryManager
          onCategoriesChanged={refetch}
        />
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
