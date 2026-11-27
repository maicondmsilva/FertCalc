import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createPedidoVenda: vi.fn(),
  listRegions: vi.fn(),
  listUserRegions: vi.fn(),
}));
vi.mock('../../services/db', () => ({ getClients: vi.fn().mockResolvedValue([]) }));
vi.mock('../../services/pedidosVendaService', () => ({
  checkPedidoDuplicado: vi.fn().mockResolvedValue(false),
  createPedidoVenda: mocks.createPedidoVenda,
  getEmitentesUsados: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/produtosFormuladosService', () => ({
  getProdutosFormulados: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/embalagensService', () => ({
  getEmbalagens: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/regionService', () => ({
  listRegions: mocks.listRegions,
  listUserRegions: mocks.listUserRegions,
}));
const toast = { showSuccess: vi.fn(), showError: vi.fn() };
vi.mock('../Toast', () => ({ useToast: () => toast }));

import NovoPedidoVendaModal from '../NovoPedidoVendaModal';

const pricing = {
  id: 'prec-1',
  cod: 7,
  formattedCod: '7',
  date: '2026-11-26',
  regionId: 'r1',
  factors: {
    client: { id: 'cli-1', name: 'GUSTAVO RODRIGUES' },
    branchId: 'fil-1',
    totalTons: 48,
  },
  calculations: [
    { formula: '35-00-00', factors: { totalTons: 48 }, summary: { finalPrice: 3230 } },
  ],
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createPedidoVenda.mockResolvedValue({ id: 'p1' });
  mocks.listRegions.mockResolvedValue([{ id: 'r1', name: 'Triângulo', ativo: true }]);
  mocks.listUserRegions.mockResolvedValue([{ userId: 'u1', regionId: 'r1', principal: true }]);
});

describe('Novo pedido a partir da precificação', () => {
  it('grava o cliente, a filial e a região da precificação', async () => {
    render(
      <NovoPedidoVendaModal
        pricing={pricing}
        currentUser={{ id: 'u1', name: 'Ana', role: 'user' }}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('600500'), {
      target: { value: '627859' },
    });
    await waitFor(() => expect(screen.getByText('sua região')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/ }));
    await waitFor(() => {
      expect(toast.showError).not.toHaveBeenCalled();
      expect(mocks.createPedidoVenda).toHaveBeenCalled();
    });
    expect(mocks.createPedidoVenda.mock.calls[0][0]).toMatchObject({
      cliente_id: 'cli-1',
      filial_id: 'fil-1',
      region_id: 'r1',
      precificacao_id: 'prec-1',
    });
  });
});
