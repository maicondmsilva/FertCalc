import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Carregamento } from '../../../types/carregamento';
const { getExecutions } = vi.hoisted(() => ({ getExecutions: vi.fn() }));
vi.mock('../../../services/execucaoCarregamentoService', () => ({
  getExecucoesByCarregamento: getExecutions,
}));
import PainelExecucoes from '../PainelExecucoes';

const loading = {
  id: 'car-1',
  quantidade_total: 100,
  quantidade_liberada: 20,
  quantidade_carregada: 0,
  quantidade_cancelada: 0,
  status: 'liberado_parcial',
} as Carregamento;
afterEach(cleanup);
describe('proteção dos saldos no painel', () => {
  it('bloqueia movimentações quando não consegue consultar reservas', async () => {
    getExecutions.mockRejectedValueOnce(new Error('offline'));
    render(<PainelExecucoes carregamento={loading} currentUserId="user-1" canManage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
    expect(screen.getByRole('button', { name: 'Agendar Veículo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar Saldo Restante' })).toBeDisabled();
    expect(screen.queryByText('Nenhuma execução agendada.')).not.toBeInTheDocument();
  });
  it('separa reserva de carga física e mantém apenas o saldo livre cancelável', async () => {
    getExecutions.mockResolvedValueOnce([
      {
        id: 'exec-1',
        status: 'agendado',
        quantidade_agendada: 20,
        quantidade_carregada: 0,
        placa_veiculo: 'TEST001',
        motorista_nome: 'Motorista',
      },
    ]);
    render(<PainelExecucoes carregamento={loading} currentUserId="user-1" canManage />);
    await waitFor(() =>
      expect(screen.getByText('Reservado em veículos: 20.000 t')).toBeInTheDocument()
    );
    expect(screen.getByText('Carregado: 0.000 t')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar Veículo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar Saldo Restante' })).toBeEnabled();
  });
});
