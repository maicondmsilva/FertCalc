import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

const service = vi.hoisted(() => ({
  listClients: vi.fn(),
  listAgents: vi.fn(),
  saveClient: vi.fn(),
  saveAgent: vi.fn(),
  removeRegistry: vi.fn(),
  countClientOrders: vi.fn(),
}));
vi.mock('../../../services/registryService', () => service);
vi.mock('../../Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock('../../../hooks/useModalBackNavigation', () => ({ useModalBackNavigation: () => {} }));
vi.mock('../../../services/cepService', () => ({ buscarCep: vi.fn().mockResolvedValue(null) }));

import ClientManager from '../../ClientManager';
import AgentManager from '../../AgentManager';

const admin = { id: 'a', name: 'Admin', role: 'admin', permissions: {} } as never;
const viewer = { id: 'v', name: 'Vendedor', role: 'user', permissions: {} } as never;

const client = {
  id: 'c1',
  code: '7',
  name: 'Fazenda Boa Vista',
  document: '529.982.247-25',
  stateRegistration: '123',
  address: {
    cep: '',
    street: 'Rua A',
    number: '1',
    neighborhood: '',
    city: 'Rio Verde',
    state: 'GO',
  },
};

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.listClients.mockResolvedValue([client]);
  service.listAgents.mockResolvedValue([
    { id: 'g1', code: '1', name: 'Carlos Representante', document: null },
    { id: 'g2', code: '2', name: 'Ana Agente', document: '11.222.333/0001-81' },
  ]);
  service.saveClient.mockResolvedValue(undefined);
  service.countClientOrders.mockResolvedValue(0);
});

describe('Agentes', () => {
  it('busca não trava com agente sem documento e aceita documento sem pontuação', async () => {
    render(<AgentManager currentUser={admin} />);
    expect(await screen.findAllByText('Carlos Representante')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar agente'), {
      target: { value: '11222333000181' },
    });
    expect(screen.queryAllByText('Carlos Representante')).toHaveLength(0);
    expect(screen.getAllByText('Ana Agente').length).toBeGreaterThan(0);
  });

  it('erro ao carregar mostra aviso com tentar de novo', async () => {
    service.listAgents.mockRejectedValueOnce(new Error('offline'));
    render(<AgentManager currentUser={admin} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    service.listAgents.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText(/Nenhum agente cadastrado/)).toBeTruthy();
  });
});

describe('Clientes', () => {
  it('quem não pode editar não vê Novo nem Editar (nem na ficha)', async () => {
    render(<ClientManager currentUser={viewer} />);
    await screen.findAllByText('Fazenda Boa Vista');
    expect(screen.queryByRole('button', { name: /Novo cliente/ })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver Fazenda Boa Vista' })[0]);
    expect(await screen.findByText('Rua A, 1 — Rio Verde/GO')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('CPF inválido e duplicado bloqueiam; válido salva sem código', async () => {
    render(<ClientManager currentUser={admin} />);
    await screen.findAllByText('Fazenda Boa Vista');
    fireEvent.click(screen.getByRole('button', { name: /Novo cliente/ }));
    fireEvent.change(screen.getByLabelText(/Nome \/ razão social/), {
      target: { value: 'Sítio Novo' },
    });
    fireEvent.change(screen.getByLabelText(/Inscrição estadual/), { target: { value: '123' } });
    const doc = screen.getByLabelText(/CPF \/ CNPJ|^CPF/);
    fireEvent.change(doc, { target: { value: '52998224724' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }));
    expect(await screen.findByText(/CPF inválido/)).toBeTruthy();
    expect(service.saveClient).not.toHaveBeenCalled();

    fireEvent.change(doc, { target: { value: '52998224725' } });
    expect(await screen.findByText(/Já existe: cód. 7/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Inscrição estadual/), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }));
    await waitFor(() => expect(service.saveClient).toHaveBeenCalledTimes(1));
    const [draft, id] = service.saveClient.mock.calls[0];
    expect(id).toBeUndefined();
    expect(draft).not.toHaveProperty('code');
    expect(draft).toMatchObject({ name: 'Sítio Novo', document: '529.982.247-25' });
  });

  it('exclusão avisa quando o cliente está em pedidos de venda', async () => {
    service.countClientOrders.mockResolvedValue(3);
    render(<ClientManager currentUser={admin} />);
    await screen.findAllByText('Fazenda Boa Vista');
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir Fazenda Boa Vista' })[0]);
    expect(await screen.findByText(/está em 3 pedido\(s\) de venda/)).toBeTruthy();
  });
});
