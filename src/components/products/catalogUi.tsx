import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useModalBackNavigation } from '../../hooks/useModalBackNavigation';

/** Classes de campo do cadastro de matéria-prima (mesmo visual em toda a tela). */
export const fieldClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-500';

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactElement<{ id?: string }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {React.cloneElement(children, { id })}
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-stone-100 pb-5 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-black text-stone-800">{title}</h3>
        {description && <p className="text-xs text-stone-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Chave liga/desliga acessível (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'emerald',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: 'emerald' | 'blue';
}) {
  const on = tone === 'blue' ? 'bg-blue-600' : 'bg-emerald-600';
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? on : 'bg-stone-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-stone-700">
        {label}
        {description && (
          <span className="block text-xs font-normal text-stone-500">{description}</span>
        )}
      </span>
    </label>
  );
}

/** Faixa de explicação no topo de cada aba. */
export function InfoBar({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-stone-600">{children}</div>
      {action}
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
      Somente leitura: apenas admin ou master pode alterar este cadastro.
    </p>
  );
}

/**
 * Modal do cadastro: cabeçalho e rodapé fixos, conteúdo com rolagem; ocupa a
 * tela inteira no celular. Fecha com Esc, clique fora ou o botão voltar.
 */
export function CatalogModal({
  isOpen,
  title,
  subtitle,
  icon,
  onClose,
  footer,
  children,
  size = 'lg',
  busy = false,
}: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  busy?: boolean;
}) {
  const titleId = useId();
  const close = () => {
    if (!busy) onClose();
  };
  useModalBackNavigation(isOpen, close);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  if (!isOpen) return null;
  const width = size === 'md' ? 'sm:max-w-lg' : size === 'xl' ? 'sm:max-w-4xl' : 'sm:max-w-2xl';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl ${width}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-black text-stone-900">
                {title}
              </h2>
              {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export const primaryButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-700 hover:bg-stone-100';
