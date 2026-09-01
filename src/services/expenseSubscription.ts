import { supabase } from './supabase';

export function subscribeToExpenseChanges(onChange: () => void) {
  const channel = supabase
    .channel(`expenses-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'credit_card_expenses' },
      onChange
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_audit' }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
