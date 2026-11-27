import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getPropostaPublica = vi.fn();
const responderProposta = vi.fn();
vi.mock('../../../services/propostaService', () => ({
  getPropostaPublica: (...args: unknown[]) => getPropostaPublica(...args),
  responderProposta: (...args: unknown[]) => responderProposta(...args),
}));
vi.mock('../../../utils/pdfDelivery', () => ({ saveOrSharePdf: vi.fn() }));

import PropostaPublicaPage from '../PropostaPublicaPage';

const amanha = new Date(Date.now() + 86_400_000 * 3).toISOString().slice(0, 10);
const aberta = {
  encontrada: true,
  empresa: { nome: 'Fertigran', logo: '', mostrarNome: true },
  proposta: {
    numero: 123,
    clienteNome: 'Cliente A',
    vendedor: 'Maria',
    moeda: 'BRL',
    validaAte: amanha,
    situacao: 'vigente',
    podeResponder: true,
  },
  itens: [
    { id: 'i1', nome: '04-14-08 SOJA', precoTonelada: 1000, quantidadeSugerida: 10 },
    { id: 'i2', nome: '20-00-20', precoTonelada: 2000 },
  ],
  resposta: null,
};

describe('PropostaPublicaPage', () => {
  beforeEach(() => {
    getPropostaPublica.mockReset();
    responderProposta.mockReset();
  });

  it('mostra os produtos e envia o aceite com CPF e quantidades', async () => {
    getPropostaPublica.mockResolvedValue(aberta);
    responderProposta.mockResolvedValue(undefined);
    render(<PropostaPublicaPage token="tok" />);
    expect(await screen.findByText('04-14-08 SOJA')).toBeTruthy();
    expect(screen.getByText(/PROP-000123/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Quantidade em toneladas de 20-00-20/), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), { target: { value: '123.456.789-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }));
    await waitFor(() => expect(responderProposta).toHaveBeenCalled());
    expect(responderProposta.mock.calls[0][0]).toMatchObject({
      token: 'tok',
      tipo: 'aceite',
      itens: [
        { id: 'i1', quantidade: 10 },
        { id: 'i2', quantidade: 5 },
      ],
    });
  });

  it('não envia com CPF inválido', async () => {
    getPropostaPublica.mockResolvedValue(aberta);
    render(<PropostaPublicaPage token="tok" />);
    await screen.findByText('04-14-08 SOJA');
    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), { target: { value: '123.456.789-00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/CPF ou CNPJ válido/);
    expect(responderProposta).not.toHaveBeenCalled();
  });

  it('recusa com motivo', async () => {
    getPropostaPublica.mockResolvedValue(aberta);
    responderProposta.mockResolvedValue(undefined);
    render(<PropostaPublicaPage token="tok" />);
    await screen.findByText('04-14-08 SOJA');
    fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), {
      target: { value: '11.222.333/0001-81' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar proposta' }));
    fireEvent.change(screen.getByLabelText(/Motivo da recusa/), {
      target: { value: 'Preço alto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() => expect(responderProposta).toHaveBeenCalled());
    expect(responderProposta.mock.calls[0][0]).toMatchObject({
      tipo: 'recusa',
      motivo: 'Preço alto',
    });
  });

  it('proposta já respondida mostra o resultado e o comprovante', async () => {
    getPropostaPublica.mockResolvedValue({
      ...aberta,
      proposta: { ...aberta.proposta, podeResponder: false, situacao: 'aceita' },
      resposta: {
        tipo: 'aceite',
        documento: '12345678909',
        itens: [{ id: 'i1', nome: '04-14-08 SOJA', precoTonelada: 1000, quantidade: 10 }],
        valorTotal: 10000,
        toneladasTotal: 10,
        respondidoEm: new Date().toISOString(),
      },
    });
    render(<PropostaPublicaPage token="tok" />);
    expect(await screen.findByText(/Seu aceite foi registrado/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Baixar comprovante/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aceitar proposta' })).toBeNull();
  });

  it('link inválido', async () => {
    getPropostaPublica.mockResolvedValue({ encontrada: false });
    render(<PropostaPublicaPage token="tok" />);
    expect(await screen.findByText('Proposta não encontrada')).toBeTruthy();
  });
});
