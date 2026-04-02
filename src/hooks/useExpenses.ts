import { useState, useEffect, useCallback } from 'react';
import {
  CreditCardExpense,
  ExpenseCategory,
  ExpensePeriod,
  CategoryBudgetStatus,
} from '../types/expense.types';
import {
  getExpenses,
  getExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense as deleteExpenseService,
  checkExpense as checkExpenseService,
  approveExpense as approveExpenseService,
  rejectExpense as rejectExpenseService,
  getCategoryBudgetStatus,
} from '../services/expenseService';

export function useExpenses(userId: string, userName: string) {
  const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<CategoryBudgetStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ExpensePeriod>(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expensesData, categoriesData, budgetData] = await Promise.all([
        getExpenses(period),
        getExpenseCategories(),
        getCategoryBudgetStatus(period),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
      setBudgetStatus(budgetData);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError('Erro ao carregar gastos.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const addExpense = async (expense: Omit<CreditCardExpense, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>) => {
    try {
      await createExpense(expense, userId, userName);
      await loadExpenses();
    } catch (err) {
      console.error('Error creating expense:', err);
      throw err;
    }
  };

  const editExpense = async (id: string, data: Partial<CreditCardExpense>) => {
    try {
      await updateExpense(id, data, userId, userName);
      await loadExpenses();
    } catch (err) {
      console.error('Error updating expense:', err);
      throw err;
    }
  };

  const removeExpense = async (id: string) => {
    try {
      await deleteExpenseService(id, userId, userName);
      await loadExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
      throw err;
    }
  };

  const checkExpenseAction = async (id: string) => {
    try {
      await checkExpenseService(id, userId, userName);
      await loadExpenses();
    } catch (err) {
      console.error('Error checking expense:', err);
      throw err;
    }
  };

  const approveExpenseAction = async (id: string) => {
    try {
      await approveExpenseService(id, userId, userName);
      await loadExpenses();
    } catch (err) {
      console.error('Error approving expense:', err);
      throw err;
    }
  };

  const rejectExpenseAction = async (id: string, observation: string) => {
    try {
      await rejectExpenseService(id, userId, userName, observation);
      await loadExpenses();
    } catch (err) {
      console.error('Error rejecting expense:', err);
      throw err;
    }
  };

  return {
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
    checkExpense: checkExpenseAction,
    approveExpense: approveExpenseAction,
    rejectExpense: rejectExpenseAction,
    refetch: loadExpenses,
  };
}
