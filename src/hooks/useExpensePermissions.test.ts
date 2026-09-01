import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { useExpensePermissions } from './useExpensePermissions';

const user = (role: string, creditCard: string): User =>
  ({
    id: 'user-1',
    idNumeric: 1,
    email: 'user@example.com',
    name: 'Usuário',
    nickname: 'usuario',
    ativo: true,
    role,
    permissions: { creditCard } as User['permissions'],
  }) as User;

describe('useExpensePermissions', () => {
  it('mantém administração completa para master e admin', () => {
    expect(useExpensePermissions(user('master', 'none')).canAdmin).toBe(true);
    expect(useExpensePermissions(user('admin', 'none')).canApprove).toBe(true);
  });

  it.each([
    ['launcher', true, false, false, false],
    ['checker', true, true, false, false],
    ['approver', true, true, true, false],
    ['admin', true, true, true, true],
    ['viewer', false, false, false, false],
  ] as const)('aplica o perfil %s corretamente', (profile, launch, check, approve, admin) => {
    const permissions = useExpensePermissions(user('user', profile));
    expect(permissions).toMatchObject({
      canLaunch: launch,
      canCheck: check,
      canApprove: approve,
      canAdmin: admin,
    });
  });

  it('nega o módulo quando não há perfil', () => {
    expect(useExpensePermissions(null).role).toBe('none');
    expect(useExpensePermissions(user('user', 'none')).canLaunch).toBe(false);
  });
});
