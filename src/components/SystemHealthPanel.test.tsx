import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SystemHealthPanel from './SystemHealthPanel';
import { runSystemHealthChecks } from '../services/healthCheckService';

vi.mock('../services/healthCheckService', () => ({
  runSystemHealthChecks: vi.fn(),
}));

describe('SystemHealthPanel', () => {
  it('shows the result and latency of the operational checks', async () => {
    vi.mocked(runSystemHealthChecks).mockResolvedValue({
      status: 'operational',
      checkedAt: '2026-08-23T12:00:00.000Z',
      checks: [
        {
          id: 'database',
          label: 'Banco de dados',
          status: 'operational',
          latencyMs: 42,
          detail: 'Consulta segura de leitura concluída.',
        },
      ],
    });

    render(<SystemHealthPanel />);

    await waitFor(() => expect(screen.getByText('Sistema operacional')).toBeInTheDocument());
    expect(screen.getByText('Banco de dados')).toBeInTheDocument();
    expect(screen.getByText('42 ms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificar novamente' })).toBeInTheDocument();
  });
});
