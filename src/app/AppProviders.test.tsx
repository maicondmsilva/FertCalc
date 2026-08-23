import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import AppProviders from './AppProviders';

function ProviderProbe() {
  const location = useLocation();
  const { showSuccess } = useToast();

  return (
    <>
      <span>Rota: {location.pathname}</span>
      <button onClick={() => showSuccess('Alteração salva')}>Notificar</button>
    </>
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('AppProviders', () => {
  it('disponibiliza o roteador para toda a aplicação', () => {
    window.history.replaceState({}, '', '/dashboard');

    render(
      <AppProviders>
        <ProviderProbe />
      </AppProviders>
    );

    expect(screen.getByText('Rota: /dashboard')).toBeInTheDocument();
  });

  it('disponibiliza notificações globais para os componentes filhos', () => {
    render(
      <AppProviders>
        <ProviderProbe />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notificar' }));

    expect(screen.getByText('Alteração salva')).toBeInTheDocument();
  });
});
