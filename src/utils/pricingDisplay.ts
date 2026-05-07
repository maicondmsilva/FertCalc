import { PedidoVenda, PricingRecord } from '../types';

type PricingFactorsLike = Partial<
  PricingRecord['factors'] & {
    tipo_frete?: string;
    valor_frete?: number;
    vencimento?: string;
    data_validade?: string;
    data_vencimento?: string;
  }
>;

function asIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function formatDatePtBr(value?: string | null): string {
  const normalized = asIsoDate(value);
  if (!normalized) return '—';
  return new Date(`${normalized}T00:00:00`).toLocaleDateString('pt-BR');
}

export function getPricingDueDate(pricing?: PricingRecord | null): string | undefined {
  const pricingLike = (pricing || {}) as PricingFactorsLike;
  const factors = (pricing?.factors || {}) as PricingFactorsLike;
  return asIsoDate(
    factors.dueDate ||
      factors.vencimento ||
      factors.data_validade ||
      factors.data_vencimento ||
      pricingLike.dueDate ||
      pricingLike.vencimento ||
      pricingLike.data_validade ||
      pricingLike.data_vencimento
  );
}

export function getPricingFreightType(pricing?: PricingRecord | null): 'CIF' | 'FOB' {
  const pricingLike = (pricing || {}) as PricingFactorsLike;
  const factors = (pricing?.factors || {}) as PricingFactorsLike;
  const rawType =
    factors.tipoFrete || factors.tipo_frete || pricingLike.tipoFrete || pricingLike.tipo_frete;
  if (typeof rawType === 'string') {
    const normalized = rawType.trim().toUpperCase();
    if (normalized === 'FOB') return 'FOB';
    if (normalized === 'CIF') return 'CIF';
  }

  const freight =
    Number(pricing?.summary?.freightValue ?? factors.freight ?? factors.valor_frete ?? 0) || 0;
  return freight > 0 ? 'CIF' : 'FOB';
}

export function getPricingFreightValue(pricing?: PricingRecord | null): number {
  if (getPricingFreightType(pricing) !== 'CIF') return 0;
  const pricingLike = (pricing || {}) as PricingFactorsLike;
  const factors = (pricing?.factors || {}) as PricingFactorsLike;
  return (
    Number(
      pricing?.summary?.freightValue ??
        factors.freight ??
        factors.valor_frete ??
        pricingLike.freight ??
        pricingLike.valor_frete ??
        0
    ) || 0
  );
}

export function formatPricingTransport(pricing?: PricingRecord | null): string {
  const tipoFrete = getPricingFreightType(pricing);
  if (tipoFrete === 'FOB') return 'FOB';

  return `CIF — R$ ${getPricingFreightValue(pricing).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/t`;
}

export function getPedidoVendaDueDate(pedido?: PedidoVenda | null): string | undefined {
  return asIsoDate(
    pedido?.data_vencimento ||
      (pedido?.dados_extraidos as { data_vencimento?: string } | undefined)?.data_vencimento ||
      pedido?.data_pedido
  );
}
