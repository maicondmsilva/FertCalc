import type { PriceReportRow } from './formulatedPriceStats';
import type { HistoricoPrecoFormulado } from '../services/historicoPrecoService';

const today = () => new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

/** Planilha "Relatório de preços dos produtos formulados" no padrão FertCalc. */
export async function exportPriceReportExcel(
  rows: PriceReportRow[],
  context: { currency: 'BRL' | 'USD'; filters: string; companyName?: string }
): Promise<void> {
  const XLSX = await import('xlsx');
  const money = `(${context.currency}/t)`;
  const header = [
    'Código',
    'Produto',
    'NPK',
    'Linha diferenciada',
    'Registros',
    `Último preço ${money}`,
    'Data do último preço',
    'Local',
    'Lista de preço',
    `Mínimo ${money}`,
    `Máximo ${money}`,
    `Média ${money}`,
    'Variação vs. anterior (%)',
  ];
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      `${context.companyName ? `${context.companyName} — ` : ''}Relatório de preços dos produtos formulados`,
    ],
    [`Emitido em ${new Date().toLocaleString('pt-BR')} · ${context.filters}`],
    [],
    header,
    ...rows.map((row) => [
      row.codigo,
      row.produto,
      row.npk,
      row.linhaDiferenciada,
      row.registros,
      row.ultimoPreco,
      row.dataUltimoPreco,
      row.local,
      row.lista,
      row.minimo,
      row.maximo,
      row.media,
      row.variacaoPercentual,
    ]),
  ]);
  sheet['!cols'] = [10, 34, 14, 12, 10, 16, 14, 18, 22, 14, 14, 14, 14].map((wch) => ({ wch }));
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
  ];
  sheet['!autofilter'] = { ref: `A4:M${rows.length + 4}` };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Preços');
  XLSX.writeFile(book, `relatorio-precos-produtos-${today()}.xlsx`);
}

/** Planilha com o histórico completo de um produto. */
export async function exportProductHistoryExcel(
  productName: string,
  entries: HistoricoPrecoFormulado[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([
    [`Histórico de preços — ${productName}`],
    [`Emitido em ${new Date().toLocaleString('pt-BR')}`],
    [],
    [
      'Data',
      'Origem',
      'Local',
      'Lista',
      'Moeda',
      'Preço base/t',
      'Preço final/t',
      'Câmbio',
      'Toneladas',
      'Total',
      'Registrado por',
    ],
    ...entries
      .slice()
      .sort(
        (left, right) =>
          new Date(right.registrado_em).getTime() - new Date(left.registrado_em).getTime()
      )
      .map((entry) => [
        new Date(entry.registrado_em).toLocaleString('pt-BR'),
        entry.origem === 'relatorio_precos' ? 'Relatório de preços' : 'Precificação',
        entry.local_carregamento_nome || '',
        entry.price_list_name || '',
        entry.moeda || 'BRL',
        entry.preco_base ?? '',
        entry.preco_final,
        entry.moeda === 'USD' ? (entry.taxa_cambio ?? '') : '',
        entry.quantidade_tons ?? '',
        entry.valor_total ?? '',
        entry.registrado_por || '',
      ]),
  ]);
  sheet['!cols'] = [18, 18, 18, 22, 8, 14, 14, 10, 10, 14, 20].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Histórico');
  const safeName = productName.replace(/[^\w\d-]+/g, '-').slice(0, 40);
  XLSX.writeFile(book, `historico-precos-${safeName}-${today()}.xlsx`);
}
