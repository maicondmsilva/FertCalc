import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    title?: string;
    action?: ToastAction;
}

interface ToastContextValue {
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showInfo: (message: string, title?: string, action?: ToastAction) => void;
}

export const ToastContext = React.createContext<ToastContextValue>({
    showSuccess: () => { },
    showError: () => { },
    showInfo: () => { },
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

    const add = useCallback((type: 'success' | 'error' | 'info', message: string, title?: string, action?: ToastAction) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message, title, action }]);
        setTimeout(() => remove(id), 5000);
    }, [remove]);

    const showSuccess = useCallback((msg: string) => add('success', msg), [add]);
    const showError = useCallback((msg: string) => add('error', msg), [add]);
    const showInfo = useCallback((msg: string, title?: string, action?: ToastAction) => add('info', msg, title, action), [add]);

    return (
        <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
            {children}
            {/* Toast Container - Card style notifications */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-md">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium pointer-events-auto transition-all animate-slide-in backdrop-blur-sm
              ${toast.type === 'success' ? 'bg-emerald-600/95 border border-emerald-500/50' : toast.type === 'error' ? 'bg-red-600/95 border border-red-500/50' : 'bg-stone-800/95 border border-stone-700/50'}`}
                    >
                        <div className="mt-0.5 flex-shrink-0">
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-200" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-200" />}
                            {toast.type === 'info' && <div className="w-3 h-3 rounded-full bg-stone-400 animate-pulse" />}
                        </div>
                        <div className="flex-1">
                            {toast.title && <h4 className="font-bold text-base mb-1">{toast.title}</h4>}
                            <p className="leading-relaxed text-xs opacity-95">{toast.message}</p>

                            {toast.action && (
                                <button
                                    onClick={() => {
                                        toast.action?.onClick();
                                        remove(toast.id);
                                    }}
                                    className="mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => remove(toast.id)}
                            className="ml-2 flex-shrink-0 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                            title="Fechar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
