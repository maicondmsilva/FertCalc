import { describe, expect, it } from 'vitest';
import type { HistoricoPrecoFormulado } from '../services/historicoPrecoService';
import {
  buildPriceReportRows,
  filterByOrigin,
  summarizePriceHistory,
} from './formulatedPriceStats';

const entry = (
  preco: number,
  date: string,
  origem: HistoricoPrecoFormulado['origem'] = 'precificacao'
): HistoricoPrecoFormulado => ({
  id: `${preco}-${date}`,
  produto_formulado_id: 'p1',
  preco_final: preco,
  registrado_em: `${date}T12:00:00Z`,
  origem,
  local_carregamento_nome: 'Uberaba',
  price_list_name: 'Lista Nov',
});

describe('resumo do histórico de preços', () => {
  it('calcula último, mínimo, máximo, média e variação em relação ao anterior', () => {
    const summary = summarizePriceHistory([
      entry(2200, '2026-11-10'),
      entry(2000, '2026-10-01'),
      entry(2100, '2026-10-20'),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.last?.preco_final).toBe(2200);
    expect(summary.previous?.preco_final).toBe(2100);
    expect(summary.min).toBe(2000);
    expect(summary.max).toBe(2200);
    expect(summary.average).toBeCloseTo(2100, 6);
    expect(summary.variationPercent).toBeCloseTo(4.7619, 3);
  });

  it('não inventa números sem registros', () => {
    expect(summarizePriceHistory([])).toEqual({ count: 0, min: 0, max: 0, average: 0 });
  });

  it('filtra pela origem do registro', () => {
    const entries = [entry(1, '2026-01-01'), entry(2, '2026-01-02', 'relatorio_precos')];
    expect(filterByOrigin(entries, 'todas')).toHaveLength(2);
    expect(filterByOrigin(entries, 'relatorio_precos').map((item) => item.preco_final)).toEqual([
      2,
    ]);
  });

  it('monta uma linha por produto para o relatório', () => {
    const rows = buildPriceReportRows(
      [
        {
          id: 'p1',
          idFormatado: 'BAT-0001',
          nome: 'Soja',
          formula_npk: '04-14-08',
          linha_diferenciada: false,
        },
        {
          id: 'p2',
          idFormatado: 'BAT-0002',
          nome: 'Milho',
          formula_npk: '08-28-16',
          linha_diferenciada: true,
        },
      ],
      { p1: [entry(2000, '2026-10-01'), entry(2100.456, '2026-11-01')] }
    );
    expect(rows[0]).toMatchObject({
      codigo: 'BAT-0001',
      registros: 2,
      ultimoPreco: 2100.46,
      local: 'Uberaba',
      variacaoPercentual: 5.02,
    });
    expect(rows[1]).toMatchObject({
      produto: 'Milho',
      registros: 0,
      ultimoPreco: '',
      linhaDiferenciada: 'Sim',
    });
  });
});
