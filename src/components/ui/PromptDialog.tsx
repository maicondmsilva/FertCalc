import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  isOpen,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset e foco quando abre
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-dialog-title"
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

            <h2 id="prompt-dialog-title" className="text-base font-semibold text-stone-800 mb-1">
              {title}
            </h2>
            {message && <p className="text-sm text-stone-500 mb-4">{message}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                required
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
                >
                  {cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {confirmLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
