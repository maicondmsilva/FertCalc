import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig: Record<
  ConfirmVariant,
  { icon: React.ReactNode; btnClass: string; iconBg: string }
> = {
  danger: {
    icon: <Trash2 className="w-5 h-5 text-red-600" aria-hidden="true" />,
    btnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    iconBg: 'bg-red-100',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />,
    btnClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    iconBg: 'bg-amber-100',
  },
  info: {
    icon: <Info className="w-5 h-5 text-emerald-600" aria-hidden="true" />,
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    iconBg: 'bg-emerald-100',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const { icon, btnClass, iconBg } = variantConfig[variant];

  // Foco automático no botão de confirmação ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
              aria-label="Fechar diálogo"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="confirm-dialog-title"
                  className="text-base font-semibold text-stone-800 leading-snug"
                >
                  {title}
                </h2>
                <p
                  id="confirm-dialog-message"
                  className="mt-1 text-sm text-stone-500 leading-relaxed"
                >
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${btnClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
