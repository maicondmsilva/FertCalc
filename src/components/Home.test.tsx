import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import Home, { formatToday, getGreeting } from './Home';

afterEach(cleanup);

const user = (overrides: Partial<User> = {}) =>
  ({ id: 'u1', name: 'Maicon Silva', role: 'user', permissions: {}, ...overrides }) as User;

describe('Home', () => {
  it('cumprimenta conforme o horário e mostra a data com só a primeira letra maiúscula', () => {
    expect(getGreeting(new Date(2026, 10, 19, 8))).toBe('Bom dia');
    expect(getGreeting(new Date(2026, 10, 19, 14))).toBe('Boa tarde');
    expect(getGreeting(new Date(2026, 10, 19, 20))).toBe('Boa noite');
    expect(formatToday(new Date(2026, 10, 19, 12))).toBe('Quinta-feira, 19 de novembro');
  });

  it('mostra só os atalhos e módulos que o usuário pode acessar', () => {
    render(
      <MemoryRouter>
        <Home
          currentUser={user({
            permissions: {
              simplified_calculator: true,
              savedFormulas: true,
            } as User['permissions'],
          })}
          onSelectModule={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Calculadora Simplificada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Batidas Salvas' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Aprovações' })).toBeNull();
    expect(screen.getByText('Precificação')).toBeTruthy();
    expect(screen.queryByText('Configurações')).toBeNull();
    expect(screen.queryByText(/PRD/)).toBeNull();
  });
});
