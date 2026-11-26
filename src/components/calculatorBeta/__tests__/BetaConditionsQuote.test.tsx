import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { quotesMock } = vi.hoisted(() => ({ quotesMock: vi.fn() }));
vi.mock('../../../services/cotacaoSolicitadaService', () => ({
  getMinhasCotacoesDisponiveis: quotesMock,
}));

import BetaConditionsPanel from '../BetaConditionsPanel';

const calculation = {
  id: 'f1',
  formula: '08-20-18',
  selected: true,
  macros: [],
  micros: [],
  factors: { factor: 1, tipoFrete: 'CIF', freight: 0 },
} as never;

function setup() {
  const updateCalculationFactors = vi.fn();
  const calculator = {
    factors: { priceListCurrency: 'BRL', client: { id: 'cli-1', name: 'Fazenda Boa Vista' } },
    updateCalculationFactors,
  } as never;
  render(
    <BetaConditionsPanel
      calculation={calculation}
      calculator={calculator}
      embalagens={[]}
      canSimulateReduction={false}
      onSimulateReduction={() => undefined}
      onClose={() => undefined}
    />
  );
  return updateCalculationFactors;
}

describe('Condições: vincular cotação de frete', () => {
  it('busca as cotações do cliente e preenche o frete ao vincular', async () => {
    quotesMock.mockResolvedValue([
      {
        id: 'cot-1',
        numero_cotacao: 'COT-0042',
        cliente_nome: 'Fazenda Boa Vista',
        transportadora_nome: 'Translog',
        valor_frete_unitario: 120,
        validade_ate: '2999-12-31',
        status: 'aprovado',
        criado_em: '',
        atualizado_em: '',
      },
    ]);
    const update = setup();

    fireEvent.click(screen.getByRole('button', { name: /Vincular cotação aprovada/ }));
    await waitFor(() => expect(screen.getByText('COT-0042')).toBeTruthy());
    expect(quotesMock).toHaveBeenCalledWith('cli-1');

    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }));
    expect(update).toHaveBeenCalledWith('f1', 'freight', 120);
    expect(update).toHaveBeenCalledWith('f1', 'cotacaoFreteId', 'cot-1');
    expect(update).toHaveBeenCalledWith('f1', 'cotacaoFreteNumero', 'COT-0042');
    expect(update).toHaveBeenCalledWith('f1', 'tipoFrete', 'CIF');
  });

  it('avisa quando não há cotação disponível', async () => {
    quotesMock.mockResolvedValue([]);
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Vincular cotação aprovada/ }));
    await waitFor(() =>
      expect(screen.getByText(/Nenhuma cotação aprovada e dentro da validade/)).toBeTruthy()
    );
  });
});
