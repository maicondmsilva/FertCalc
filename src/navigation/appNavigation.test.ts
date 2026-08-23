import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { getActiveModule, getNavigationItems, hasUserPermission } from './appNavigation';

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    idNumeric: 1,
    email: 'user@example.com',
    name: 'Usuário',
    nickname: 'usuario',
    ativo: true,
    role: 'user',
    permissions: {},
    ...overrides,
  }) as User;

describe('app navigation', () => {
  it.each([
    ['calculator', 'pricing'],
    ['users', 'config'],
    ['prd', 'prd'],
    ['managementReports_dashboard', 'managementReports'],
    ['expenses_aprovacao', 'expenses'],
    ['carregamento_logistica', 'carregamento'],
    ['relatorios', 'relatorios'],
    ['', null],
    ['rota_inexistente', null],
  ] as const)('associa a rota %s ao módulo correto', (route, expectedModule) => {
    expect(getActiveModule(route)).toBe(expectedModule);
  });

  it('concede todas as permissões somente à hierarquia administrativa', () => {
    expect(hasUserPermission(user({ role: 'admin' }), 'qualquer_permissao')).toBe(true);
    expect(hasUserPermission(user({ role: 'master' }), 'qualquer_permissao')).toBe(true);
    expect(hasUserPermission(user(), 'dashboard')).toBe(false);
    expect(
      hasUserPermission(user({ permissions: { dashboard: true } as User['permissions'] }), 'dashboard')
    ).toBe(true);
  });

  it('filtra os itens principais pelas permissões do usuário', () => {
    const items = getNavigationItems('pricing', (permission) => permission === 'calculator');
    expect(items.map(({ id }) => id)).toEqual([
      'calculator',
      'simplified_calculator',
      'saved_formulas',
    ]);
  });

  it('injeta as contagens do workflow de despesas nos badges corretos', () => {
    const items = getNavigationItems('expenses', () => true, {
      pendingExpenses: 4,
      checkedExpenses: 2,
    });
    const workflow = items.find(({ id }) => id === 'expenses_workflow_group');

    expect(workflow?.children?.find(({ id }) => id === 'expenses_conferencia')?.badge).toBe(4);
    expect(workflow?.children?.find(({ id }) => id === 'expenses_aprovacao')?.badge).toBe(2);
  });

  it('mantém a entrada de relatórios gerais disponível', () => {
    expect(getNavigationItems('relatorios', () => false).map(({ id }) => id)).toEqual([
      'relatorios',
    ]);
  });
});
