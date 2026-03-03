import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface Toast {
    id: string;
    type: 'success' | 'error';
    message: string;
}

interface ToastContextValue {
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
}

export const ToastContext = React.createContext<ToastContextValue>({
    showSuccess: () => { },
    showError: () => { },
});

export function useToast() {
    const ctx = React.useContext(ToastContext);
    return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const remove = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const add = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => remove(id), 3500);
    }, [remove]);

    const showSuccess = useCallback((msg: string) => add('success', msg), [add]);
    const showError = useCallback((msg: string) => add('error', msg), [add]);

    return (
        <ToastContext.Provider value={{ showSuccess, showError }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-white text-sm font-medium pointer-events-auto transition-all animate-slide-in
              ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            : <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        }
                        <span>{toast.message}</span>
                        <button
                            onClick={() => remove(toast.id)}
                            className="ml-2 hover:opacity-70 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
