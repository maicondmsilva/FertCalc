import { describe, expect, it } from 'vitest';
import type { PedidoVenda } from '../../types';
import {
  buildPedidoTimeline,
  diasSemMovimento,
  formatDate,
  isPedidoParado,
  pedidoLabel,
  pedidoProgress,
} from './pedidosVendaModel';

const pedido = (overrides: Partial<PedidoVenda> = {}): PedidoVenda => ({
  id: 'p1',
  status: 'pendente',
  numero_pedido: '100',
  emitente: 2,
  quantidade_original: 100,
  quantidade_desmembrada: 10,
  quantidade_cancelada_definitiva: 5,
  quantidade_carregada: 25,
  saldo_a_carregar: 60,
  criado_em: '2026-10-01T12:00:00Z',
  ...overrides,
});

describe('carteira de pedidos', () => {
  it('identifica o pedido pela barra ou número/emitente', () => {
    expect(pedidoLabel({ barra_pedido: '100/3' })).toBe('100/3');
    expect(pedidoLabel({ numero_pedido: '100', emitente: 2 })).toBe('100/2');
    expect(pedidoLabel({})).toBe('Sem número');
  });

  it('calcula vendido, carregado, saldo e percentual descontando cancelamentos', () => {
    expect(pedidoProgress(pedido())).toEqual({
      total: 85,
      carregado: 25,
      saldo: 60,
      percent: (25 / 85) * 100,
    });
  });

  it('conta dias sem movimento pela última solicitação de carga', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(diasSemMovimento(pedido(), now)).toBe(54);
    expect(diasSemMovimento(pedido({ ultima_movimentacao: '2026-11-20T12:00:00Z' }), now)).toBe(4);
  });

  it('marca como parado só pedido ativo com saldo e sem movimento', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(isPedidoParado(pedido(), 30, now)).toBe(true);
    expect(isPedidoParado(pedido({ status: 'concluido' }), 30, now)).toBe(false);
    expect(isPedidoParado(pedido({ saldo_a_carregar: 0, quantidade_carregada: 85 }), 30, now)).toBe(
      false
    );
    expect(isPedidoParado(pedido({ ultima_movimentacao: '2026-11-20T12:00:00Z' }), 30, now)).toBe(
      false
    );
  });

  it('formata data sem trocar o dia pelo fuso', () => {
    expect(formatDate('2026-12-01')).toBe('01/12/2026');
    expect(formatDate(undefined)).toBe('—');
  });

  it('monta a linha do tempo do mais recente ao mais antigo', () => {
    const timeline = buildPedidoTimeline(
      pedido({ vendedor_nome: 'Ana' }),
      [
        {
          id: 'a1',
          pedido_venda_id: 'p1',
          usuario_id: 'u',
          motivo: 'Dados comerciais atualizados',
          campos_alterados: ['safra', 'numero_contrato'],
          criado_em: '2026-10-05T12:00:00Z',
        },
      ],
      [
        {
          id: 'c1',
          pedido_origem_id: 'p1',
          tipo: 'definitivo',
          quantidade: 5,
          motivo: 'Cliente desistiu',
          usuario_nome: 'Bruno',
          criado_em: '2026-10-10T12:00:00Z',
        },
      ]
    );
    expect(timeline.map((event) => event.title)).toEqual([
      'Cancelamento definitivo de 5 t',
      'Dados comerciais atualizados',
      'Pedido lançado',
    ]);
    expect(timeline[1].detail).toBe('Alterado: safra, contrato');
    expect(timeline[2].detail).toBe('por Ana');
  });
});
