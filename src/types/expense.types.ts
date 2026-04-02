export type ExpenseStatus = 'pendente' | 'conferido' | 'aprovado' | 'rejeitado';

export type AuditAction = 'criado' | 'conferido' | 'aprovado' | 'rejeitado' | 'editado' | 'excluido';

export interface ExpenseCategory {
  id: string;
  name: string;
  budgetLimit?: number;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditCardExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryId: string;
  categoryName?: string;
  status: ExpenseStatus;
  cardName?: string;
  installments: number;
  currentInstallment?: number;
  receipt?: string;
  observation?: string;
  userId: string;
  userName: string;
  periodMonth: number;
  periodYear: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseAudit {
  id: string;
  expenseId: string;
  action: AuditAction;
  userId: string;
  userName: string;
  observation?: string;
  createdAt: string;
}

export interface ExpensePeriod {
  month: number;
  year: number;
  label?: string;
}

export interface CategoryBudgetStatus {
  category: ExpenseCategory;
  totalSpent: number;
  budgetLimit: number;
  percentUsed: number;
  count: number;
}
