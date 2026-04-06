import { User } from '../types';
import { ExpenseRole } from '../types/expense.types';

export interface ExpensePermissions {
  canLaunch: boolean;
  canCheck: boolean;
  canApprove: boolean;
  canAdmin: boolean;
  role: ExpenseRole;
}

export function useExpensePermissions(currentUser: User | null): ExpensePermissions {
  if (!currentUser) {
    return { canLaunch: false, canCheck: false, canApprove: false, canAdmin: false, role: 'none' };
  }

  if (currentUser.role === 'master' || currentUser.role === 'admin') {
    return { canLaunch: true, canCheck: true, canApprove: true, canAdmin: true, role: 'admin' };
  }

  const expenseRole = (currentUser.permissions as any)?.creditCard as ExpenseRole | undefined;

  switch (expenseRole) {
    case 'admin':
      return { canLaunch: true, canCheck: true, canApprove: true, canAdmin: true, role: 'admin' };
    case 'approver':
      return { canLaunch: true, canCheck: true, canApprove: true, canAdmin: false, role: 'approver' };
    case 'checker':
      return { canLaunch: true, canCheck: true, canApprove: false, canAdmin: false, role: 'checker' };
    case 'launcher':
      return { canLaunch: true, canCheck: false, canApprove: false, canAdmin: false, role: 'launcher' };
    case 'viewer':
      return { canLaunch: false, canCheck: false, canApprove: false, canAdmin: false, role: 'viewer' };
    default:
      return { canLaunch: false, canCheck: false, canApprove: false, canAdmin: false, role: 'none' };
  }
}
