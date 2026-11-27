import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  alterar: vi.fn(),
  cotacao: vi.fn(),
  locais: vi.fn(),
  pedidoItens: vi.fn(),
}));
vi.mock('../../../services/pedidosVendaService', () => ({
  alterarEnderecoEntrega: mocks.alterar,
  getPedidosVenda: vi.fn().mockResolvedValue([]),
  getPedidoVendaItens: mocks.pedidoItens,
}));
vi.mock('../../../services/cotacaoSolicitadaService', () => ({ getCotacaoById: mocks.cotacao }));
vi.mock('../../../services/locaisCarregamentoService', () => ({ getLocaisAtivos: mocks.locais }));
vi.mock('../../../services/carregamentoService', () => ({
  getFiliais: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/db', () => ({ getPricingRecords: vi.fn().mockResolvedValue([]) }));
const toast = { showSuccess: vi.fn(), showError: vi.fn() };
vi.mock('../../Toast', () => ({ useToast: () => toast }));

import EntregaCarregamento from '../EntregaCarregamento';
import { ModalNovoCarregamento } from '../../Carregamento/ModalNovoCarregamento';

const pedido = {
  id: 'p1',
  numero_pedido: '627859',
  emitente: 1,
  barra_pedido: '627859/1',
  cliente_nome: 'GUSTAVO RODRIGUES',
  regiao_nome: 'Sul de Goiás',
  filial_id: 'f1',
  local_carregamento_id: 'l1',
  previsao_entrega: '2026-12-31',
  endereco_entrega: 'Fazenda Barroso II',
  cidade_entrega: 'Uruaçu',
  estado_entrega: 'GO',
  cotacao_frete_id: 'c1',
  tipo_frete: 'CIF',
  quantidade_real: 48,
  saldo_disponivel: 48,
  status: 'pendente',
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locais.mockResolvedValue([{ id: 'l1', nome: 'Pátio Catalão', ativo: true }]);
  mocks.cotacao.mockResolvedValue({
    id: 'c1',
    numero_cotacao: 'COT-0042',
    transportadora_nome: 'Translog',
    valor_frete_unitario: 100,
    validade_ate: '2999-12-31',
  });
  mocks.pedidoItens.mockResolvedValue([]);
  mocks.alterar.mockResolvedValue(undefined);
});

describe('Entrega e carregamento do pedido', () => {
  it('mostra local, endereço e a transportadora da cotação', async () => {
    render(
      <EntregaCarregamento
        pedido={pedido}
        filialNome="FERTIGRAN CATALÃO"
        podeAlterar
        onChanged={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Pátio Catalão')).toBeTruthy());
    expect(screen.getByText('Fazenda Barroso II')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Translog')).toBeTruthy());
    expect(screen.getByText(/R\$\s?100,00\/t/)).toBeTruthy();
  });

  it('alterar endereço exige motivo e chama o banco', async () => {
    const onChanged = vi.fn();
    render(<EntregaCarregamento pedido={pedido} podeAlterar onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /Alterar endereço/ }));
    fireEvent.change(screen.getByLabelText(/Endereço \(fazenda/), {
      target: { value: 'Fazenda Barroso III' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar endereço' }));
    expect(toast.showError).toHaveBeenCalledWith('Informe o motivo da alteração.');
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'cliente pediu outra fazenda' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar endereço' }));
    await waitFor(() => expect(mocks.alterar).toHaveBeenCalled());
    expect(mocks.alterar.mock.calls[0][1]).toMatchObject({
      endereco: 'Fazenda Barroso III',
      motivo: 'cliente pediu outra fazenda',
    });
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('Solicitar carregamento a partir do pedido', () => {
  it('mostra o pedido como número/emitente, sem busca, com a entrega preenchida', async () => {
    render(
      <ModalNovoCarregamento
        filiais={[{ id: 'f1', nome: 'FERTIGRAN CATALÃO', codigo: '1', ativo: true }]}
        pedidoVinculado={pedido}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Pedido 627859/1')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar por cliente/)).toBeNull();
    expect(screen.getByText(/Fazenda Barroso II · Uruaçu\/GO/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Translog')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Solicitar e abrir no Carregamento' })).toBeTruthy();
  });
});
