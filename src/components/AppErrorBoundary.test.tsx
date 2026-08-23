import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from './AppErrorBoundary';
import { reportRuntimeError } from '../utils/errorReporter';

vi.mock('../utils/errorReporter', () => ({
  createIncidentId: () => 'FERT-TEST-1234',
  reportRuntimeError: vi.fn(),
}));

function BrokenScreen(): never {
  throw new Error('falha simulada');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.mocked(reportRuntimeError).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('keeps rendering healthy children', () => {
    render(
      <AppErrorBoundary>
        <p>Aplicação saudável</p>
      </AppErrorBoundary>
    );
    expect(screen.getByText('Aplicação saudável')).toBeInTheDocument();
  });

  it('shows recovery actions and reports an incident when rendering fails', () => {
    render(
      <AppErrorBoundary>
        <BrokenScreen />
      </AppErrorBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível exibir esta tela');
    expect(screen.getByText('Incidente: FERT-TEST-1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(reportRuntimeError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ incidentId: 'FERT-TEST-1234', source: 'react-error-boundary' })
    );
  });
});
