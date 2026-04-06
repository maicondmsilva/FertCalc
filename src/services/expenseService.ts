import { supabase } from './supabase';
import {
  CreditCardExpense,
  ExpenseCategory,
  ExpenseAudit,
  ExpensePeriod,
  CategoryBudgetStatus,
  ExpenseStatus,
  AuditAction,
} from '../types/expense.types';

// ============================================================
// HELPERS
// ============================================================
function mapExpense(d: any): CreditCardExpense {
  return {
    id: d.id,
    description: d.description,
    amount: Number(d.amount),
    date: d.date,
    categoryId: d.category_id,
    categoryName: d.category_name ?? d.expense_categories?.name,
    status: d.status as ExpenseStatus,
    cardName: d.card_name,
    installments: d.installments ?? 1,
    currentInstallment: d.current_installment,
    receipt: d.receipt,
    observation: d.observation,
    userId: d.user_id,
    userName: d.user_name,
    periodMonth: d.period_month,
    periodYear: d.period_year,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapCategory(d: any): ExpenseCategory {
  return {
    id: d.id,
    name: d.name,
    budgetLimit: d.budget_limit != null ? Number(d.budget_limit) : undefined,
    color: d.color,
    icon: d.icon,
    active: d.active ?? true,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapAudit(d: any): ExpenseAudit {
  return {
    id: d.id,
    expenseId: d.expense_id,
    action: d.action as AuditAction,
    userId: d.user_id,
    userName: d.user_name,
    observation: d.observation,
    createdAt: d.created_at,
  };
}

// ============================================================
// EXPENSES
// ============================================================
export async function getExpenses(period?: ExpensePeriod): Promise<CreditCardExpense[]> {
  let query = supabase
    .from('credit_card_expenses')
    .select('*, expense_categories(name)')
    .order('date', { ascending: false });

  if (period) {
    query = query.eq('period_month', period.month).eq('period_year', period.year);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapExpense);
}

export async function getExpenseById(id: string): Promise<CreditCardExpense | null> {
  const { data, error } = await supabase
    .from('credit_card_expenses')
    .select('*, expense_categories(name)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapExpense(data);
}

export async function createExpense(expense: Omit<CreditCardExpense, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>, auditUserId: string, auditUserName: string): Promise<CreditCardExpense> {
  const { data, error } = await supabase
    .from('credit_card_expenses')
    .insert({
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      category_id: expense.categoryId,
      status: expense.status || 'pendente',
      card_name: expense.cardName,
      installments: expense.installments || 1,
      current_installment: expense.currentInstallment,
      receipt: expense.receipt,
      observation: expense.observation,
      user_id: expense.userId,
      user_name: expense.userName,
      period_month: expense.periodMonth,
      period_year: expense.periodYear,
    })
    .select('*, expense_categories(name)')
    .single();
  if (error) throw error;

  // Create audit entry
  await createAuditEntry(data.id, 'criado', auditUserId, auditUserName);

  return mapExpense(data);
}

export async function updateExpense(id: string, expense: Partial<CreditCardExpense>, auditUserId: string, auditUserName: string): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (expense.description !== undefined) payload.description = expense.description;
  if (expense.amount !== undefined) payload.amount = expense.amount;
  if (expense.date !== undefined) payload.date = expense.date;
  if (expense.categoryId !== undefined) payload.category_id = expense.categoryId;
  if (expense.status !== undefined) payload.status = expense.status;
  if (expense.cardName !== undefined) payload.card_name = expense.cardName;
  if (expense.installments !== undefined) payload.installments = expense.installments;
  if (expense.currentInstallment !== undefined) payload.current_installment = expense.currentInstallment;
  if (expense.receipt !== undefined) payload.receipt = expense.receipt;
  if (expense.observation !== undefined) payload.observation = expense.observation;
  if (expense.periodMonth !== undefined) payload.period_month = expense.periodMonth;
  if (expense.periodYear !== undefined) payload.period_year = expense.periodYear;

  const { error } = await supabase.from('credit_card_expenses').update(payload).eq('id', id);
  if (error) throw error;

  await createAuditEntry(id, 'editado', auditUserId, auditUserName);
}

export async function deleteExpense(id: string, auditUserId: string, auditUserName: string): Promise<void> {
  await createAuditEntry(id, 'excluido', auditUserId, auditUserName);
  const { error } = await supabase.from('credit_card_expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function checkExpense(id: string, userId: string, userName: string): Promise<void> {
  const { error } = await supabase
    .from('credit_card_expenses')
    .update({ status: 'conferido', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await createAuditEntry(id, 'conferido', userId, userName);
}

export async function approveExpense(id: string, userId: string, userName: string): Promise<void> {
  const { error } = await supabase
    .from('credit_card_expenses')
    .update({ status: 'aprovado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await createAuditEntry(id, 'aprovado', userId, userName);
}

export async function rejectExpense(id: string, userId: string, userName: string, observation: string): Promise<void> {
  const { error } = await supabase
    .from('credit_card_expenses')
    .update({ status: 'rejeitado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await createAuditEntry(id, 'rejeitado', userId, userName, observation);
}

// ============================================================
// AUDIT
// ============================================================
export async function getExpenseAudit(expenseId: string): Promise<ExpenseAudit[]> {
  const { data, error } = await supabase
    .from('expense_audit')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(mapAudit);
}

async function createAuditEntry(expenseId: string, action: AuditAction, userId: string, userName: string, observation?: string): Promise<void> {
  const { error } = await supabase.from('expense_audit').insert({
    expense_id: expenseId,
    action,
    user_id: userId,
    user_name: userName,
    observation: observation || null,
  });
  if (error) {
    console.error('Failed to create audit entry:', error);
    throw new Error(`Falha ao registrar auditoria: ${error.message}`);
  }
}

// ============================================================
// CATEGORIES
// ============================================================
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapCategory);
}

export async function createExpenseCategory(category: Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseCategory> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({
      name: category.name,
      budget_limit: category.budgetLimit,
      color: category.color,
      icon: category.icon,
      active: category.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapCategory(data);
}

export async function updateExpenseCategory(id: string, category: Partial<ExpenseCategory>): Promise<void> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (category.name !== undefined) payload.name = category.name;
  if (category.budgetLimit !== undefined) payload.budget_limit = category.budgetLimit;
  if (category.color !== undefined) payload.color = category.color;
  if (category.icon !== undefined) payload.icon = category.icon;
  if (category.active !== undefined) payload.active = category.active;
  const { error } = await supabase.from('expense_categories').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// COUNTS (for sidebar badges)
// ============================================================
export async function getPendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('credit_card_expenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');
  if (error) return 0;
  return count || 0;
}

export async function getCheckedCount(): Promise<number> {
  const { count, error } = await supabase
    .from('credit_card_expenses')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'conferido');
  if (error) return 0;
  return count || 0;
}

// ============================================================
// BUDGET STATUS
// ============================================================
export async function getCategoryBudgetStatus(period: ExpensePeriod): Promise<CategoryBudgetStatus[]> {
  const [categories, expenses] = await Promise.all([
    getExpenseCategories(),
    getExpenses(period),
  ]);

  return categories
    .filter(c => c.active)
    .map(category => {
      const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
      const totalSpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const budgetLimit = category.budgetLimit || 0;
      return {
        category,
        totalSpent,
        budgetLimit,
        percentUsed: budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0,
        count: categoryExpenses.length,
      };
    });
}
