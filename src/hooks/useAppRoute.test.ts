import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { getAppRoute, useAppRoute } from './useAppRoute';

describe('app routing', () => {
  it('representa a página inicial sem módulo ativo', () => {
    expect(getAppRoute('/', '')).toEqual({
      activeTab: '',
      activeModule: null,
      isPasswordReset: false,
      isStandalone: false,
    });
  });

  it('identifica a aba e o módulo pelo primeiro segmento da URL', () => {
    expect(getAppRoute('/calculator/detalhes', '')).toMatchObject({
      activeTab: 'calculator',
      activeModule: 'pricing',
    });
    expect(getAppRoute('/expenses_aprovacao', '')).toMatchObject({
      activeTab: 'expenses_aprovacao',
      activeModule: 'expenses',
    });
  });

  it('reconhece somente o valor explícito do modo standalone', () => {
    expect(getAppRoute('/dashboard', '?standalone=true').isStandalone).toBe(true);
    expect(getAppRoute('/dashboard', '?standalone=false').isStandalone).toBe(false);
  });

  it('mantém a redefinição de senha disponível como rota pública', () => {
    expect(getAppRoute('/reset-password', '').isPasswordReset).toBe(true);
  });

  it('abre diretamente a calculadora na variante exclusiva de precificação', () => {
    expect(getAppRoute('/', '', 'pricing')).toMatchObject({
      activeTab: 'calculator',
      activeModule: 'pricing',
    });
  });

  it('bloqueia módulos externos à precificação na variante do aplicativo', () => {
    expect(getAppRoute('/users', '', 'pricing')).toMatchObject({
      activeTab: 'calculator',
      activeModule: 'pricing',
    });
    expect(getAppRoute('/carregamento_visao_geral', '', 'pricing')).toMatchObject({
      activeTab: 'calculator',
      activeModule: 'pricing',
    });
  });

  it('preserva as rotas do módulo de precificação na variante do aplicativo', () => {
    expect(getAppRoute('/saved_formulas', '', 'pricing')).toMatchObject({
      activeTab: 'saved_formulas',
      activeModule: 'pricing',
    });
  });

  it('não bloqueia a recuperação de senha na variante do aplicativo', () => {
    expect(getAppRoute('/reset-password', '', 'pricing')).toMatchObject({
      activeTab: 'reset-password',
      activeModule: null,
      isPasswordReset: true,
    });
  });

  it('acompanha a localização fornecida pelo roteador', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: ['/users?standalone=true'] }, children);
    const { result } = renderHook(() => useAppRoute(), { wrapper });

    expect(result.current).toMatchObject({
      activeTab: 'users',
      activeModule: 'config',
      isStandalone: true,
    });
  });
});
