import { describe, expect, it } from 'vitest';
import { HistoricoPrecoFormulado } from '../services/historicoPrecoService';
import { filterFormulatedPriceHistory } from './formulatedPriceHistory';

const history: HistoricoPrecoFormulado[] = [
  {
    id: '1',
    produto_formulado_id: 'produto',
    preco_final: 1000,
    registrado_em: '2026-08-01T12:00:00Z',
    local_carregamento_id: 'local-a',
    price_list_id: 'lista-a',
  },
  {
    id: '2',
    produto_formulado_id: 'produto',
    preco_final: 1100,
    registrado_em: '2026-08-15T12:00:00Z',
    local_carregamento_id: 'local-b',
    price_list_id: 'lista-b',
  },
];

describe('filterFormulatedPriceHistory', () => {
  it('filtra por local e lista de preço', () => {
    expect(
      filterFormulatedPriceHistory(history, { localId: 'local-a', priceListId: 'lista-a' })
    ).toEqual([history[0]]);
  });

  it('inclui todo o dia nos filtros de período', () => {
    expect(
      filterFormulatedPriceHistory(history, { dateFrom: '2026-08-15', dateTo: '2026-08-15' })
    ).toEqual([history[1]]);
  });
});
