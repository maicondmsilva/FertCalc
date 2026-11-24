import { describe, expect, it } from 'vitest';
import type { CancelamentoRelatorioRow } from '../services/pedidosVendaService';
import {
  buildCancelamentosSheetRows,
  createCancelamentosPdf,
  filterCancelamentos,
  groupCancelamentos,
  pedidoNumero,
  reportColumns,
  reportRowValues,
  summarizeCancelamentos,
} from './cancelamentosReport';

const row = (overrides: Partial<CancelamentoRelatorioRow>): CancelamentoRelatorioRow => ({
  id: 'c1',
  pedido_origem_id: 'p1',
  tipo: 'definitivo',
  quantidade: 10,
  criado_em: '2026-11-10T12:00:00Z',
  usuario_nome: 'Ana',
  motivo: 'Cliente desistiu',
  pedidoOrigemNome: '1045/1',
  pedidoOrigemCliente: 'Agropecuária Santa Rita',
  pedidoOrigemIe: '001',
  pedidoOrigemProduto: '05-25-15',
  pedidoOrigemQtd: 300,
  pedidoSaldoRestante: 120,
  pedidoOrigemDisponivel: true,
  pedidoDestinoDisponivel: false,
  ...overrides,
});

const rows = [
  row({ id: 'a' }),
  row({ id: 'b', quantidade: 5, pedidoOrigemNome: '1045/2' }),
  row({
    id: 'c',
    quantidade: 30,
    pedidoOrigemNome: '2001/1',
    pedidoOrigemCliente: 'Fazenda Boa Vista',
    pedidoOrigemIe: '',
  }),
];

describe('relatório de cancelamentos', () => {
  it('separa o número do pedido da barra', () => {
    expect(pedidoNumero('1045/2')).toBe('1045');
    expect(pedidoNumero(undefined)).toBe('Sem número');
  });

  it('busca sem diferenciar acentos em cliente, produto, usuário e motivo', () => {
    expect(filterCancelamentos(rows, 'agropecuaria').map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterCancelamentos(rows, 'desistiu')).toHaveLength(3);
    expect(filterCancelamentos(rows, '  ')).toHaveLength(3);
  });

  it('agrupa por cliente, por pedido e por barra com subtotal', () => {
    const byClient = groupCancelamentos(rows, 'cliente');
    expect(byClient.map((group) => [group.label, group.quantidade])).toEqual([
      ['Fazenda Boa Vista', 30],
      ['Agropecuária Santa Rita', 15],
    ]);
    const byOrder = groupCancelamentos(rows, 'pedido');
    expect(byOrder.map((group) => [group.label, group.rows.length])).toEqual([
      ['Pedido 2001', 1],
      ['Pedido 1045', 2],
    ]);
    expect(groupCancelamentos(rows, 'barra')).toHaveLength(3);
    expect(groupCancelamentos(rows, 'nenhum')).toHaveLength(1);
  });

  it('resume registros, toneladas, clientes e pedidos', () => {
    expect(summarizeCancelamentos(rows)).toEqual({
      registros: 3,
      quantidade: 45,
      clientes: 2,
      pedidos: 2,
    });
  });

  it('mantém as colunas iguais entre tela e PDF', () => {
    expect(reportRowValues(rows[0], 'definitivo')).toHaveLength(reportColumns('definitivo').length);
    expect(reportRowValues(rows[0], 'canc_substitui')).toHaveLength(
      reportColumns('canc_substitui').length
    );
  });

  it('gera planilha com o grupo e quantidade numérica', () => {
    const sheet = buildCancelamentosSheetRows(
      groupCancelamentos(rows, 'cliente'),
      'definitivo',
      'cliente'
    );
    expect(sheet[0]).toMatchObject({
      Grupo: 'Fazenda Boa Vista',
      Cliente: 'Fazenda Boa Vista',
      'Qtd cancelada (t)': 30,
    });
    const byOrder = buildCancelamentosSheetRows(
      groupCancelamentos(rows, 'pedido'),
      'definitivo',
      'pedido'
    );
    expect(byOrder[0]).toMatchObject({ Grupo: 'Pedido 2001', Pedido: '2001/1' });
  });

  it('gera o PDF agrupado', () => {
    const doc = createCancelamentosPdf({
      mode: 'definitivo',
      groupBy: 'cliente',
      groups: groupCancelamentos(rows, 'cliente'),
      filtersText: 'Nenhum filtro aplicado',
      settings: { companyName: 'Empresa', companyLogo: '' },
    });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('Fazenda Boa Vista');
  });
});
