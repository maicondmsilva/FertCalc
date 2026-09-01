import { supabase } from './supabase';

export function subscribeToOrderLoadingChanges(onChange: () => void) {
  const channel = supabase
    .channel(`pedidos-carregamentos-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_venda' }, onChange)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos_venda_itens' },
      onChange
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'carregamentos' }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
