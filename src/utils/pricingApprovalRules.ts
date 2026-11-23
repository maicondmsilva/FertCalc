import type { PricingRecord, User } from '../types';

/**
 * Mesma regra do banco (private.can_approve_pricing): gerente ou acima, ou quem
 * tem a permissão "Aprovar / Reprovar".
 */
export function canApprovePricings(user: User): boolean {
  return (
    user.role === 'master' ||
    user.role === 'admin' ||
    user.role === 'manager' ||
    (user.permissions as Record<string, unknown> | undefined)?.approvals_canApprove === true
  );
}

/** Ninguém aprova ou reprova a própria precificação, exceto o master. */
export function canDecidePricing(user: User, pricing: Pick<PricingRecord, 'userId'>): boolean {
  if (!canApprovePricings(user)) return false;
  return pricing.userId !== user.id || user.role === 'master';
}

/** Mensagem legível para falhas de aprovação (inclui o motivo devolvido pelo banco). */
export function describeApprovalError(error: unknown): string {
  const message =
    (error as { message?: string } | null)?.message ||
    (error as { error_description?: string } | null)?.error_description;
  return message ? `Não foi possível concluir: ${message}` : 'Erro ao processar aprovação.';
}
