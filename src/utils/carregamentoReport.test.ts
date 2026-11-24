import { describe, expect, it } from 'vitest';
import type { Carregamento } from '../types/carregamento';
import {
  CARREGAMENTO_COLUMNS,
  buildCarregamentoSheetRows,
  carregamentoRowValues,
  createCarregamentoPdf,
  groupCarregamentos,
  summarizeCarregamentos,
} from './carregamentoReport';

const carga = (overrides: Partial<Carregamento>): Carregamento => ({
  id: 'c1',
  numero_carregamento: 'CAR-2026-0001',
  tipo_frete: 'CIF',
  status: 'carregado',
  quantidade_total: 30,
  quantidade_liberada: 30,
  quantidade_carregada: 30,
  valor_frete: 3000,
  criado_em: '2026-11-10T12:00:00Z',
  atualizado_em: '2026-11-10T12:00:00Z',
  transportadora: { id: 't1', nome: 'TransAgro', ativo: true },
  filial: { id: 'f1', nome: 'Uberaba', codigo: 'UBA', ativo: true },
  ...overrides,
});

const items = [
  carga({}),
  carga({
    id: 'c2',
    quantidade_total: 20,
    quantidade_liberada: 20,
    quantidade_carregada: 10,
    valor_frete: 1000,
  }),
  carga({
    id: 'c3',
    tipo_frete: 'FOB',
    transportadora: undefined,
    status: 'aguardando_liberacao',
    quantidade_liberada: 0,
    quantidade_carregada: 0,
    valor_frete: 0,
  }),
];

describe('relatório de carregamentos', () => {
  it('soma volumes, frete e frete médio por tonelada carregada', () => {
    expect(summarizeCarregamentos(items)).toEqual({
      registros: 3,
      solicitado: 80,
      liberado: 50,
      carregado: 40,
      frete: 4000,
      fretePorTonelada: 100,
    });
    expect(summarizeCarregamentos([]).fretePorTonelada).toBe(0);
  });

  it('agrupa por transportadora (FOB separado) e por status', () => {
    expect(
      groupCarregamentos(items, 'transportadora').map((group) => [
        group.label,
        group.summary.carregado,
      ])
    ).toEqual([
      ['TransAgro', 40],
      ['FOB (cliente retira)', 0],
    ]);
    expect(groupCarregamentos(items, 'status').map((group) => group.label)).toEqual([
      'Carregado',
      'Aguardando liberação',
    ]);
  });

  it('mantém as colunas do PDF alinhadas com as linhas', () => {
    expect(carregamentoRowValues(items[0])).toHaveLength(CARREGAMENTO_COLUMNS.length);
  });

  it('gera planilha com grupo e números', () => {
    const rows = buildCarregamentoSheetRows(groupCarregamentos(items, 'filial'), 'filial');
    expect(rows[0]).toMatchObject({
      Grupo: 'Uberaba',
      'Carregado (t)': 30,
      'Valor do frete (R$)': 3000,
    });
  });

  it('gera o PDF agrupado', () => {
    const doc = createCarregamentoPdf({
      groupBy: 'transportadora',
      groups: groupCarregamentos(items, 'transportadora'),
      filtersText: 'Nenhum filtro aplicado',
      settings: { companyName: 'Empresa', companyLogo: '' },
    });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('TransAgro');
  });
});
