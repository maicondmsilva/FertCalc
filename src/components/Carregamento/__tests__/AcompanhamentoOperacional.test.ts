import { describe, expect, it } from 'vitest';
import type { Carregamento } from '../../../types/carregamento';
import {
  calcularSaldoOperacional,
  diasEmAberto,
  obterCarregamentosComSaldoAntigo,
} from '../AcompanhamentoOperacional';

function carregamento(overrides: Partial<Carregamento> = {}): Carregamento {
  return {
    id: 'car-1',
    numero_carregamento: '1',
    tipo_frete: 'CIF',
    status: 'liberado_total',
    quantidade_total: 100,
    quantidade_liberada: 80,
    quantidade_carregada: 25,
    criado_em: '2026-09-01T12:00:00Z',
    atualizado_em: '2026-09-01T12:00:00Z',
    data_liberacao: '2026-09-02T12:00:00Z',
    ...overrides,
  };
}

describe('acompanhamento operacional de carregamentos', () => {
  it('calcula saldo liberado descontando carregado e cancelado', () => {
    expect(calcularSaldoOperacional(carregamento({ quantidade_cancelada: 5 }))).toBe(50);
  });

  it('nunca apresenta saldo negativo', () => {
    expect(
      calcularSaldoOperacional(carregamento({ quantidade_liberada: 20, quantidade_carregada: 30 }))
    ).toBe(0);
  });

  it('usa a data de liberação para calcular os dias em aberto', () => {
    expect(diasEmAberto(carregamento(), new Date('2026-09-14T12:00:00Z'))).toBe(12);
  });

  it('lista apenas saldos antigos ainda ativos e ordena pelo mais antigo', () => {
    const resultado = obterCarregamentosComSaldoAntigo(
      [
        carregamento({ id: 'recente', data_liberacao: '2026-09-12T12:00:00Z' }),
        carregamento({ id: 'antigo', data_liberacao: '2026-09-01T12:00:00Z' }),
        carregamento({ id: 'medio', data_liberacao: '2026-09-05T12:00:00Z' }),
        carregamento({ id: 'finalizado', status: 'carregado', data_liberacao: '2026-08-01T12:00:00Z' }),
      ],
      7,
      new Date('2026-09-14T12:00:00Z')
    );

    expect(resultado.map((item) => item.id)).toEqual(['antigo', 'medio']);
  });
});
