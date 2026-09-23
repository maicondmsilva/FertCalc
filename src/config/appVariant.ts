export type AppVariant = 'full' | 'pricing';

const normalizeAppVariant = (value: unknown): AppVariant =>
  String(value ?? '')
    .trim()
    .toLowerCase() === 'pricing'
    ? 'pricing'
    : 'full';

export const APP_VARIANT = normalizeAppVariant(import.meta.env.VITE_APP_VARIANT);

export const isPricingApp = (variant: AppVariant = APP_VARIANT) => variant === 'pricing';
