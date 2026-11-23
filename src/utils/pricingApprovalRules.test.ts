import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import {
  canApprovePricings,
  canDecidePricing,
  describeApprovalError,
} from './pricingApprovalRules';

const user = (overrides: Partial<User>): User => ({ id: 'u1', role: 'user', ...overrides }) as User;

describe('regras de aprovação de precificação', () => {
  it('só gerente ou acima, ou quem tem a permissão, aprova', () => {
    expect(canApprovePricings(user({ role: 'comercial' }))).toBe(false);
    expect(canApprovePricings(user({ role: 'manager' }))).toBe(true);
    expect(
      canApprovePricings(
        user({ role: 'user', permissions: { approvals_canApprove: true } as never })
      )
    ).toBe(true);
  });

  it('ninguém decide sobre a própria precificação, exceto o master', () => {
    expect(canDecidePricing(user({ role: 'manager' }), { userId: 'u1' })).toBe(false);
    expect(canDecidePricing(user({ role: 'manager' }), { userId: 'u2' })).toBe(true);
    expect(canDecidePricing(user({ role: 'master' }), { userId: 'u1' })).toBe(true);
    expect(canDecidePricing(user({ role: 'comercial' }), { userId: 'u2' })).toBe(false);
  });

  it('mostra o motivo devolvido pelo banco', () => {
    expect(describeApprovalError({ message: 'Não é permitido' })).toContain('Não é permitido');
    expect(describeApprovalError(undefined)).toBe('Erro ao processar aprovação.');
  });
});
