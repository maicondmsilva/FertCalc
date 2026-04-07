import { useState, useCallback } from 'react';
import type { ConfirmVariant } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

/**
 * Hook para usar ConfirmDialog de forma imperativa (assíncrona).
 *
 * Uso:
 *   const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
 *
 *   // No JSX:
 *   <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
 *
 *   // No handler:
 *   const ok = await confirm({ title: 'Excluir?', message: 'Isso não pode ser desfeito.' });
 *   if (ok) await deleteRecord(id);
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        resolve,
        ...options,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state]);

  return {
    confirmState: state,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
