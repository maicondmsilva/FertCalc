import React from 'react';
import { clsx } from 'clsx';

interface SpinnerProps {
  /** Tamanho do spinner em classes Tailwind (ex: 'w-4 h-4', 'w-6 h-6', 'w-8 h-8') */
  size?: 'sm' | 'md' | 'lg';
  /** Cor do spinner */
  color?: 'emerald' | 'white' | 'stone';
  /** Label acessível */
  label?: string;
  /** Classes extras */
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-4',
};

const colorMap = {
  emerald: 'border-emerald-200 border-t-emerald-600',
  white: 'border-white/30 border-t-white',
  stone: 'border-stone-200 border-t-stone-600',
};

/**
 * Spinner de carregamento acessível.
 *
 * Uso:
 *   <Spinner size="md" label="Carregando dados..." />
 */
export function Spinner({
  size = 'md',
  color = 'emerald',
  label = 'Carregando...',
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx(
        'inline-block rounded-full animate-spin',
        sizeMap[size],
        colorMap[color],
        className
      )}
    />
  );
}

/**
 * Overlay de tela cheia para operações de carregamento pesado.
 */
export function LoadingOverlay({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Spinner size="lg" color="emerald" />
      <p className="mt-4 text-sm text-stone-500">{label}</p>
    </div>
  );
}

/**
 * Inline loading placeholder – substitui conteúdo enquanto carrega.
 */
export function InlineLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 py-4 justify-center text-stone-400"
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" color="stone" label={label} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
