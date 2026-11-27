import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const verificar = vi.fn();
vi.mock('../../../services/propostaService', () => ({
  verificarAssinatura: (...args: unknown[]) => verificar(...args),
}));

import VerificacaoAssinaturaPage from '../VerificacaoAssinaturaPage';

const base = {
  encontrada: true,
  integra: true,
  codigo: '7694-CBC6-B7F7',
  hash: 'abc',
  proposta: 'PROP-000003',
  cliente: 'Cliente A',
  documento: '***.456.789-**',
  resposta: 'aceite',
  respondidoEm: '2026-11-27T14:32:00Z',
  moeda: 'BRL',
  valorTotal: 12500,
  itens: [{ nome: 'SOJA', quantidade: 12.5, precoTonelada: 1000 }],
};

describe('VerificacaoAssinaturaPage', () => {
  it('mostra documento autêntico com o documento mascarado', async () => {
    verificar.mockResolvedValue(base);
    render(<VerificacaoAssinaturaPage codigo="7694-CBC6-B7F7" />);
    expect(await screen.findByText('Documento autêntico')).toBeTruthy();
    expect(screen.getByText('***.456.789-**')).toBeTruthy();
    expect(screen.getByText('PROP-000003')).toBeTruthy();
  });

  it('acusa registro alterado', async () => {
    verificar.mockResolvedValue({ ...base, integra: false });
    render(<VerificacaoAssinaturaPage codigo="X" />);
    expect(await screen.findByText(/o registro foi alterado/)).toBeTruthy();
  });

  it('código inexistente', async () => {
    verificar.mockResolvedValue({ encontrada: false });
    render(<VerificacaoAssinaturaPage codigo="AAAA" />);
    expect(await screen.findByText('Código não encontrado')).toBeTruthy();
  });
});
