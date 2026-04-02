import React from 'react';
import { CreditCardExpense, CategoryBudgetStatus, ExpensePeriod } from '../../types/expense.types';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface ExpenseReportProps {
  expenses: CreditCardExpense[];
  budgetStatus: CategoryBudgetStatus[];
  period: ExpensePeriod;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExpenseReport({ expenses, budgetStatus, period }: ExpenseReportProps) {
  const totalMonth = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'aprovado').reduce((sum, e) => sum + e.amount, 0);
  const totalPending = expenses.filter(e => e.status === 'pendente' || e.status === 'conferido').reduce((sum, e) => sum + e.amount, 0);
  const totalRejected = expenses.filter(e => e.status === 'rejeitado').reduce((sum, e) => sum + e.amount, 0);

  const overBudgetCategories = budgetStatus.filter(b => b.percentUsed > 100);

  return (
    <div className="space-y-6">
      {/* Period Header */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Relatório — {monthNames[period.month - 1]} {period.year}
        </h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Geral</p>
          <p className="text-xl font-black text-stone-800 mt-1">
            {totalMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">{expenses.length} lançamentos</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Aprovados</p>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {totalApproved.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Pendentes</p>
          <p className="text-xl font-black text-amber-600 mt-1">
            {totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Rejeitados</p>
          <p className="text-xl font-black text-red-600 mt-1">
            {totalRejected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Over Budget Alerts */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Categorias Acima do Orçamento
          </h3>
          <div className="space-y-2">
            {overBudgetCategories.map(b => (
              <div key={b.category.id} className="flex items-center justify-between text-sm">
                <span className="text-red-700 font-medium">{b.category.name}</span>
                <span className="text-red-600 font-bold">
                  {b.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {b.budgetLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({Math.round(b.percentUsed)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget by Category */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Gastos por Categoria</h3>
        </div>
        {budgetStatus.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {budgetStatus.map((b) => (
              <div key={b.category.id} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-stone-700">{b.category.name}</span>
                    <span className="text-xs text-stone-400 ml-2">({b.count} itens)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-stone-800">
                      {b.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {b.budgetLimit > 0 && (
                      <span className="text-xs text-stone-400 ml-1">
                        / {b.budgetLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                </div>
                {b.budgetLimit > 0 && (
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        b.percentUsed > 100 ? 'bg-red-500' :
                        b.percentUsed > 80 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
