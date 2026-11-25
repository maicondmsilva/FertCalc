import { describe, expect, it } from 'vitest';
import type { Carregamento } from '../../../types/carregamento';
import { obterCarregamentosAtrasados } from '../AcompanhamentoOperacional';

const carga = (id: string, status: Carregamento['status'], prevista?: string) =>
  ({ id, status, data_prevista_carregamento: prevista }) as Carregamento;

describe('carregamentos atrasados', () => {
  it('data prevista antes de hoje e carga ainda aberta', () => {
    const hoje = new Date(2026, 10, 25, 15, 0);
    const lista = [
      carga('a', 'liberado_total', '2026-11-20'),
      carga('b', 'aguardando_liberacao', '2026-11-25'),
      carga('c', 'carregado', '2026-11-01'),
      carga('d', 'em_carregamento', '2026-11-24T10:00:00Z'),
      carga('e', 'liberado_parcial'),
    ];
    expect(obterCarregamentosAtrasados(lista, hoje).map((c) => c.id)).toEqual(['a', 'd']);
  });
});
