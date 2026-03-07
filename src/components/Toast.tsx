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
        // 4 seconds duration as requested
        setToasts(prev => [...prev, { id, type, message, title, action }]);
        setTimeout(() => remove(id), 4000);
    }, [remove]);

    const showSuccess = useCallback((msg: string) => add('success', msg), [add]);
    const showError = useCallback((msg: string) => add('error', msg), [add]);
    const showInfo = useCallback((msg: string, title?: string, action?: ToastAction) => add('info', msg, title, action), [add]);

    return (
        <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
            {children}
            {/* Toast Container - Moved to top center for info/notifications */}
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-medium pointer-events-auto transition-all animate-slide-in
              ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-stone-800'}`}
                    >
                        <div className="mt-0.5">
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-200" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-200" />}
                            {toast.type === 'info' && <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400 animate-pulse" />}
                        </div>
                        <div className="flex-1">
                            {toast.title && <h4 className="font-bold text-base mb-1">{toast.title}</h4>}
                            <p className="text-stone-200 leading-relaxed text-xs">{toast.message}</p>
                            
                            {toast.action && (
                                <button
                                    onClick={() => {
                                        toast.action?.onClick();
                                        remove(toast.id);
                                    }}
                                    className="mt-3 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-black/20"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => remove(toast.id)}
                            className="ml-2 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-stone-300" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
