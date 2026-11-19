import type { HistoricoPrecoFormulado } from '../services/historicoPrecoService';

export type HistoryOrigin = 'todas' | 'precificacao' | 'relatorio_precos';

export interface PriceHistorySummary {
  count: number;
  last?: HistoricoPrecoFormulado;
  previous?: HistoricoPrecoFormulado;
  min: number;
  max: number;
  average: number;
  /** Variação percentual do último registro em relação ao anterior. */
  variationPercent?: number;
}

const byDate = (left: HistoricoPrecoFormulado, right: HistoricoPrecoFormulado) =>
  new Date(left.registrado_em).getTime() - new Date(right.registrado_em).getTime();

export function filterByOrigin(
  entries: HistoricoPrecoFormulado[],
  origin: HistoryOrigin
): HistoricoPrecoFormulado[] {
  if (origin === 'todas') return entries;
  return entries.filter((entry) => (entry.origem || 'precificacao') === origin);
}

/** Resumo dos preços registrados (os registros devem estar na mesma moeda). */
export function summarizePriceHistory(entries: HistoricoPrecoFormulado[]): PriceHistorySummary {
  const sorted = entries.slice().sort(byDate);
  const prices = sorted.map((entry) => Number(entry.preco_final) || 0);
  if (prices.length === 0) return { count: 0, min: 0, max: 0, average: 0 };
  const last = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  return {
    count: sorted.length,
    last,
    previous,
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: prices.reduce((total, price) => total + price, 0) / prices.length,
    variationPercent:
      previous && Number(previous.preco_final) > 0
        ? ((Number(last.preco_final) - Number(previous.preco_final)) /
            Number(previous.preco_final)) *
          100
        : undefined,
  };
}

export interface PriceReportRow {
  codigo: string;
  produto: string;
  npk: string;
  linhaDiferenciada: string;
  registros: number;
  ultimoPreco: number | '';
  dataUltimoPreco: string;
  local: string;
  lista: string;
  minimo: number | '';
  maximo: number | '';
  media: number | '';
  variacaoPercentual: number | '';
}

/** Uma linha por produto com o último preço e o resumo no período filtrado. */
export function buildPriceReportRows(
  products: Array<{
    id: string;
    idFormatado?: string;
    nome: string;
    formula_npk?: string;
    linha_diferenciada: boolean;
  }>,
  historyByProduct: Record<string, HistoricoPrecoFormulado[]>
): PriceReportRow[] {
  return products.map((product) => {
    const summary = summarizePriceHistory(historyByProduct[product.id] || []);
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      codigo: product.idFormatado || '',
      produto: product.nome,
      npk: product.formula_npk || '',
      linhaDiferenciada: product.linha_diferenciada ? 'Sim' : 'Não',
      registros: summary.count,
      ultimoPreco: summary.last ? round(Number(summary.last.preco_final)) : '',
      dataUltimoPreco: summary.last
        ? new Date(summary.last.registrado_em).toLocaleDateString('pt-BR')
        : '',
      local: summary.last?.local_carregamento_nome || '',
      lista: summary.last?.price_list_name || '',
      minimo: summary.count ? round(summary.min) : '',
      maximo: summary.count ? round(summary.max) : '',
      media: summary.count ? round(summary.average) : '',
      variacaoPercentual:
        summary.variationPercent === undefined ? '' : round(summary.variationPercent),
    };
  });
}
