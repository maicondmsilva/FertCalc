import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings } from '../types';
import type { Proposta, PropostaItem } from '../types/proposta';
import { drawCompanyLogo } from './pdfBranding';
import { getCompanyDisplayName } from './companyBranding';
import {
  diasParaVencer,
  formatDataBr,
  formatNumeroProposta,
  hojeIso,
  propostaVencida,
} from './propostaModel';

export const MARCA_DAGUA_VENCIDA = 'PREÇOS FORA DA VALIDADE';

const BRAND: [number, number, number] = [16, 94, 58];
const BRAND_LIGHT: [number, number, number] = [236, 246, 240];
const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [110, 105, 100];

export const moedaProposta = (value: number, moeda: 'BRL' | 'USD') =>
  value.toLocaleString(moeda === 'USD' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: moeda,
    minimumFractionDigits: 2,
  });

const toneladas = (value?: number) =>
  value && value > 0 ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t` : '—';

export interface PropostaTotais {
  toneladas: number;
  valor: number;
}

export function totaisProposta(itens: PropostaItem[]): PropostaTotais {
  return itens.reduce(
    (acc, item) => {
      const quantidade = item.quantidadeSugerida || 0;
      return {
        toneladas: acc.toneladas + quantidade,
        valor: acc.valor + quantidade * item.precoTonelada,
      };
    },
    { toneladas: 0, valor: 0 }
  );
}

/** Linhas da tabela de produtos (PDF e prévia). */
export function linhasProdutosProposta(proposta: Proposta, itens: PropostaItem[]): string[][] {
  return itens.map((item, index) => {
    const quantidade = item.quantidadeSugerida || 0;
    return [
      String(index + 1),
      [item.formulaNome, item.codigo].filter(Boolean).join('\n'),
      item.npk || '—',
      item.embalagem || '—',
      toneladas(quantidade),
      moedaProposta(item.precoTonelada, proposta.moeda),
      quantidade > 0 ? moedaProposta(quantidade * item.precoTonelada, proposta.moeda) : '—',
    ];
  });
}

interface PropostaPdfInput {
  proposta: Proposta;
  itens: PropostaItem[];
  settings?: Pick<AppSettings, 'companyLogo' | 'companyName' | 'showCompanyName'> | null;
  hoje?: string;
  now?: Date;
}

function desenharMarcaDagua(doc: jsPDF) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const gState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  const setGState = (doc as unknown as { setGState?: (state: unknown) => void }).setGState;
  if (gState && setGState) {
    doc.saveGraphicsState();
    setGState.call(doc, new gState({ opacity: 0.14 }));
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(185, 28, 28);
  // Texto girado 35°: parte de baixo à esquerda e sobe até o canto oposto, centralizado na página.
  const textWidth = doc.getTextWidth(MARCA_DAGUA_VENCIDA);
  const angle = (35 * Math.PI) / 180;
  const x = (width - textWidth * Math.cos(angle)) / 2;
  const y = (height + textWidth * Math.sin(angle)) / 2;
  doc.text(MARCA_DAGUA_VENCIDA, x, y, { angle: 35 });
  if (gState && setGState) doc.restoreGraphicsState();
}

/** PDF da proposta. Vencida: marca d'água em todas as páginas. */
export function createPropostaPdf({
  proposta,
  itens,
  settings,
  hoje = hojeIso(),
  now = new Date(),
}: PropostaPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const vencida = propostaVencida(proposta, hoje);
  const numero = formatNumeroProposta(proposta.numero);

  // Cabeçalho: faixa da marca com logo, empresa e número.
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 30, 'F');
  let textX = margin;
  if (settings?.companyLogo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 6, 40, 18, 2, 2, 'F');
    const used = drawCompanyLogo(doc, settings, {
      x: margin + 2,
      y: 7,
      maxWidth: 36,
      maxHeight: 16,
    });
    textX = used > 0 ? margin + 46 : margin;
  }
  // Nome ao lado da logo só se a Personalização mandar mostrar (sem logo, sempre).
  const nomeEmpresa = getCompanyDisplayName(settings ?? undefined);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  if (nomeEmpresa) {
    doc.setFontSize(15);
    doc.text(nomeEmpresa, textX, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Proposta de preços', textX, 21);
  } else {
    doc.setFontSize(14);
    doc.text('Proposta de preços', textX, 17.5);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(numero, pageWidth - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Emitida em ${formatDataBr(proposta.createdAt)}`, pageWidth - margin, 20, {
    align: 'right',
  });
  doc.text(`Impressa em ${now.toLocaleString('pt-BR')}`, pageWidth - margin, 25, {
    align: 'right',
  });

  // Quadros: cliente, condições e validade.
  const top = 36;
  const gap = 4;
  const validadeWidth = 46;
  const colWidth = (pageWidth - margin * 2 - validadeWidth - gap * 2) / 2;
  const boxHeight = 36;
  const box = (x: number, width: number, title: string, lines: string[]) => {
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(231, 229, 228);
    doc.roundedRect(x, top, width, boxHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND);
    doc.text(title.toUpperCase(), x + 3, top + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    let y = top + 10.5;
    lines.filter(Boolean).forEach((line, index) => {
      // A primeira linha (nome) pode ocupar duas linhas; as demais, uma.
      if (index === 0) doc.setFont('helvetica', 'bold');
      const parts = (doc.splitTextToSize(line, width - 6) as string[]).slice(
        0,
        index === 0 ? 2 : 1
      );
      parts.forEach((part) => {
        if (y < top + boxHeight - 1.5) doc.text(part, x + 3, y);
        y += 4.2;
      });
      if (index === 0) doc.setFont('helvetica', 'normal');
    });
  };
  const dados = proposta.clienteDados || {};
  box(margin, colWidth, 'Cliente', [
    proposta.clienteNome,
    proposta.clienteDocumento ? `CPF/CNPJ: ${proposta.clienteDocumento}` : '',
    dados.inscricaoEstadual ? `IE: ${dados.inscricaoEstadual}` : '',
    dados.fazenda ? `Fazenda: ${dados.fazenda}` : '',
    dados.cidade ? `${dados.cidade}${dados.estado ? ` / ${dados.estado}` : ''}` : '',
  ]);
  box(margin + colWidth + gap, colWidth, 'Condições', [
    proposta.localNome ? `Local: ${proposta.localNome}` : 'Local não informado',
    proposta.priceListNome ? `Lista: ${proposta.priceListNome}` : '',
    proposta.moeda === 'USD'
      ? `Moeda: US$${proposta.taxaCambio ? ` · câmbio ${proposta.taxaCambio.toLocaleString('pt-BR')}` : ''}`
      : 'Moeda: R$',
    `Vendedor: ${proposta.criadoPorNome || '—'}`,
  ]);
  const vx = pageWidth - margin - validadeWidth;
  if (vencida) doc.setFillColor(254, 242, 242);
  else doc.setFillColor(...BRAND_LIGHT);
  if (vencida) doc.setDrawColor(254, 202, 202);
  else doc.setDrawColor(187, 222, 200);
  doc.roundedRect(vx, top, validadeWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  if (vencida) doc.setTextColor(185, 28, 28);
  else doc.setTextColor(...BRAND);
  doc.text('VÁLIDA ATÉ', vx + validadeWidth / 2, top + 6, { align: 'center' });
  doc.setFontSize(15);
  doc.text(formatDataBr(proposta.validaAte), vx + validadeWidth / 2, top + 15.5, {
    align: 'center',
  });
  doc.setFontSize(8);
  const dias = diasParaVencer(proposta.validaAte, hoje);
  doc.text(
    vencida
      ? 'Fora da validade'
      : dias === 0
        ? 'Vence hoje'
        : `${dias} dia${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}`,
    vx + validadeWidth / 2,
    top + 23,
    { align: 'center' }
  );

  // Produtos.
  const totais = totaisProposta(itens);
  autoTable(doc, {
    startY: top + boxHeight + 6,
    head: [['#', 'Produto', 'NPK', 'Embalagem', 'Quantidade', `Preço/t`, 'Total']],
    body: linhasProdutosProposta(proposta, itens),
    foot:
      totais.toneladas > 0
        ? [
            [
              '',
              'Total',
              '',
              '',
              toneladas(totais.toneladas),
              '',
              moedaProposta(totais.valor, proposta.moeda),
            ],
          ]
        : undefined,
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: INK,
      valign: 'middle',
    },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 244], textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    didParseCell: (data) => {
      // Cabeçalho e total alinhados como a coluna.
      const align = ['center', 'left', 'center', 'left', 'right', 'right', 'right'][
        data.column.index
      ];
      if (data.section !== 'body') data.cell.styles.halign = align as 'left' | 'center' | 'right';
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', textColor: MUTED },
      1: { fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 26 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: BRAND },
      6: { cellWidth: 30, halign: 'right' },
    },
  });
  let cursorY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;

  // Composição (o usuário escolhe se aparece).
  if (proposta.incluirComposicao) {
    itens
      .filter((item) => item.composicao.length > 0)
      .forEach((item) => {
        if (cursorY > pageHeight - 50) {
          doc.addPage();
          cursorY = 16;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(
          `Composição — ${item.formulaNome}${item.npk ? ` (${item.npk})` : ''}`,
          margin,
          cursorY + 8
        );
        autoTable(doc, {
          startY: cursorY + 10,
          head: [['Matéria-prima', 'Tipo', 'Quantidade por tonelada']],
          body: item.composicao.map((material) => [
            material.nome,
            material.tipo || '—',
            `${Math.round(material.kg).toLocaleString('pt-BR')} kg`,
          ]),
          theme: 'grid',
          margin: { left: margin, right: margin, bottom: 18 },
          styles: { fontSize: 7.5, cellPadding: 1.6, textColor: INK },
          headStyles: { fillColor: [87, 83, 78], textColor: 255 },
          columnStyles: { 2: { halign: 'right', cellWidth: 45 }, 1: { cellWidth: 25 } },
        });
        cursorY =
          (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          cursorY + 20;
      });
  }

  // Observações.
  if (proposta.observacoes) {
    const linhas = doc.splitTextToSize(
      proposta.observacoes,
      pageWidth - margin * 2 - 6
    ) as string[];
    const altura = 9 + linhas.length * 4.2;
    if (cursorY + altura > pageHeight - 22) {
      doc.addPage();
      cursorY = 10;
    }
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(margin, cursorY + 6, pageWidth - margin * 2, altura, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    doc.text('OBSERVAÇÕES', margin + 3, cursorY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(linhas, margin + 3, cursorY + 16);
  }

  // Rodapé e marca d'água em todas as páginas.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (vencida) desenharMarcaDagua(doc);
    doc.setDrawColor(231, 229, 228);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `${numero} · Preços válidos até ${formatDataBr(proposta.validaAte)} · Valores por tonelada, sujeitos à disponibilidade.`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
  return doc;
}

export type CelulaPlanilha = string | number | null;

/** Planilha da proposta (aba Proposta e, se escolhido, aba Composição). */
export function planilhaProposta(
  proposta: Proposta,
  itens: PropostaItem[],
  hoje: string = hojeIso()
): { proposta: CelulaPlanilha[][]; composicao: CelulaPlanilha[][] | null } {
  const vencida = propostaVencida(proposta, hoje);
  const totais = totaisProposta(itens);
  const dados = proposta.clienteDados || {};
  const linhas: CelulaPlanilha[][] = [
    [`Proposta de preços ${formatNumeroProposta(proposta.numero)}`],
    ...(vencida ? [[MARCA_DAGUA_VENCIDA] as CelulaPlanilha[]] : []),
    [],
    ['Cliente', proposta.clienteNome],
    ['CPF/CNPJ', proposta.clienteDocumento || ''],
    ['Fazenda', dados.fazenda || ''],
    ['Cidade/UF', [dados.cidade, dados.estado].filter(Boolean).join(' / ')],
    ['Local de carregamento', proposta.localNome || ''],
    ['Lista de preço', proposta.priceListNome || ''],
    ['Moeda', proposta.moeda === 'USD' ? 'US$' : 'R$'],
    ...(proposta.moeda === 'USD' ? [['Câmbio', proposta.taxaCambio ?? '']] : []),
    ['Emitida em', formatDataBr(proposta.createdAt)],
    ['Válida até', formatDataBr(proposta.validaAte)],
    ['Vendedor', proposta.criadoPorNome],
    [],
    ['#', 'Produto', 'Código', 'NPK', 'Embalagem', 'Quantidade (t)', 'Preço por tonelada', 'Total'],
    ...itens.map((item, index) => {
      const quantidade = item.quantidadeSugerida || 0;
      return [
        index + 1,
        item.formulaNome,
        item.codigo || '',
        item.npk || '',
        item.embalagem || '',
        quantidade || null,
        item.precoTonelada,
        quantidade ? Math.round(quantidade * item.precoTonelada * 100) / 100 : null,
      ];
    }),
    [
      '',
      'Total',
      '',
      '',
      '',
      totais.toneladas || null,
      null,
      totais.valor ? Math.round(totais.valor * 100) / 100 : null,
    ],
    ...(proposta.observacoes ? [[], ['Observações', proposta.observacoes]] : []),
  ];
  const composicao = proposta.incluirComposicao
    ? [
        ['Produto', 'NPK', 'Matéria-prima', 'Tipo', 'kg por tonelada'],
        ...itens.flatMap((item) =>
          item.composicao.map((material) => [
            item.formulaNome,
            item.npk || '',
            material.nome,
            material.tipo || '',
            Math.round(material.kg),
          ])
        ),
      ]
    : null;
  return { proposta: linhas, composicao };
}

/** Gera e baixa o Excel da proposta, com a logo da empresa no topo. */
export async function baixarExcelProposta(
  proposta: Proposta,
  itens: PropostaItem[],
  settings?: Pick<AppSettings, 'companyLogo' | 'companyName' | 'showCompanyName'> | null
) {
  const buffer = await gerarExcelProposta(proposta, itens, settings);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formatNumeroProposta(proposta.numero)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const HEX_BRAND = 'FF105E3A';

/** Tamanho da logo no Excel mantendo a proporção (lê largura/altura do PNG). */
export function tamanhoLogoExcel(base64: string, maxWidth = 150, maxHeight = 60) {
  try {
    const bytes = atob(base64.slice(0, 64));
    if (bytes.slice(1, 4) === 'PNG') {
      const read = (offset: number) =>
        ((bytes.charCodeAt(offset) << 24) |
          (bytes.charCodeAt(offset + 1) << 16) |
          (bytes.charCodeAt(offset + 2) << 8) |
          bytes.charCodeAt(offset + 3)) >>>
        0;
      const width = read(16);
      const height = read(20);
      if (width > 0 && height > 0) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        return { width: Math.round(width * scale), height: Math.round(height * scale) };
      }
    }
  } catch {
    // Sem leitura do tamanho: usa a caixa padrão.
  }
  return { width: maxWidth, height: maxHeight };
}

/** Monta o arquivo .xlsx (logo, cabeçalho, produtos formatados e composição opcional). */
export async function gerarExcelProposta(
  proposta: Proposta,
  itens: PropostaItem[],
  settings?: Pick<AppSettings, 'companyLogo' | 'companyName' | 'showCompanyName'> | null,
  hoje: string = hojeIso()
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = settings?.companyName || 'FertCalc';
  const nomeEmpresa = getCompanyDisplayName(settings ?? undefined);
  const sheet = book.addWorksheet('Proposta', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [
    { width: 5 },
    { width: 34 },
    { width: 13 },
    { width: 11 },
    { width: 16 },
    { width: 15 },
    { width: 18 },
    { width: 18 },
  ];
  const vencida = propostaVencida(proposta, hoje);
  const formatoMoeda = proposta.moeda === 'USD' ? '"US$" #,##0.00' : '"R$" #,##0.00';

  // Logo (Configurações → Personalização) nas linhas 1–4, à esquerda.
  const logo = settings?.companyLogo;
  const match = logo ? /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(logo) : null;
  let tituloCol = 1;
  if (match) {
    const imageId = book.addImage({
      base64: match[2],
      extension: match[1].toLowerCase().startsWith('jp') ? 'jpeg' : 'png',
    });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: tamanhoLogoExcel(match[2]) });
    tituloCol = 3;
  }
  for (let row = 1; row <= 4; row += 1) sheet.getRow(row).height = 16;
  // Nome da empresa só se a Personalização mandar mostrar (sem logo, sempre).
  const cabecalho: Array<[string, Partial<import('exceljs').Font>]> = [
    ...(nomeEmpresa
      ? [
          [nomeEmpresa, { bold: true, size: 15, color: { argb: HEX_BRAND } }] as [
            string,
            Partial<import('exceljs').Font>,
          ],
        ]
      : []),
    [
      `Proposta de preços ${formatNumeroProposta(proposta.numero)}`,
      { bold: true, size: nomeEmpresa ? 11 : 14 },
    ],
    [
      `Emitida em ${formatDataBr(proposta.createdAt)} · Válida até ${formatDataBr(proposta.validaAte)}`,
      { size: 10, color: { argb: 'FF6E6964' } },
    ],
    ...(vencida
      ? [
          [MARCA_DAGUA_VENCIDA, { bold: true, size: 12, color: { argb: 'FFB91C1C' } }] as [
            string,
            Partial<import('exceljs').Font>,
          ],
        ]
      : []),
  ];
  cabecalho.forEach(([texto, fonte], index) => {
    const cell = sheet.getCell(index + 1, tituloCol);
    cell.value = texto;
    cell.font = fonte;
  });

  // Dados do cliente e condições.
  const dados = proposta.clienteDados || {};
  const info: Array<[string, string]> = [
    ['Cliente', proposta.clienteNome],
    ['CPF/CNPJ', proposta.clienteDocumento || ''],
    ['Fazenda', dados.fazenda || ''],
    ['Cidade/UF', [dados.cidade, dados.estado].filter(Boolean).join(' / ')],
    ['Local de carregamento', proposta.localNome || ''],
    ['Lista de preço', proposta.priceListNome || ''],
    [
      'Moeda',
      proposta.moeda === 'USD'
        ? `US$${proposta.taxaCambio ? ` (câmbio ${proposta.taxaCambio.toLocaleString('pt-BR')})` : ''}`
        : 'R$',
    ],
    ['Vendedor', proposta.criadoPorNome],
  ];
  let row = 6;
  info
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      const labelCell = sheet.getCell(row, 1);
      labelCell.value = label;
      labelCell.font = { bold: true, color: { argb: 'FF6E6964' } };
      sheet.mergeCells(row, 1, row, 2);
      const valueCell = sheet.getCell(row, 3);
      valueCell.value = value;
      sheet.mergeCells(row, 3, row, 8);
      row += 1;
    });

  // Tabela de produtos.
  row += 1;
  const header = sheet.getRow(row);
  header.values = [
    '#',
    'Produto',
    'Código',
    'NPK',
    'Embalagem',
    'Quantidade (t)',
    'Preço por tonelada',
    'Total',
  ];
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX_BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  header.height = 22;
  const firstItemRow = row + 1;
  itens.forEach((item, index) => {
    row += 1;
    const quantidade = item.quantidadeSugerida || 0;
    const linha = sheet.getRow(row);
    linha.values = [
      index + 1,
      item.formulaNome,
      item.codigo || '',
      item.npk || '',
      item.embalagem || '',
      quantidade || null,
      item.precoTonelada,
      quantidade ? Math.round(quantidade * item.precoTonelada * 100) / 100 : null,
    ];
    linha.getCell(6).numFmt = '#,##0.000';
    linha.getCell(7).numFmt = formatoMoeda;
    linha.getCell(8).numFmt = formatoMoeda;
    linha.getCell(7).font = { bold: true, color: { argb: HEX_BRAND } };
    if (index % 2 === 1)
      linha.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F5' } };
      });
  });
  row += 1;
  const totais = totaisProposta(itens);
  const totalRow = sheet.getRow(row);
  totalRow.getCell(2).value = 'Total';
  totalRow.getCell(6).value = totais.toneladas || null;
  totalRow.getCell(6).numFmt = '#,##0.000';
  totalRow.getCell(8).value = totais.valor ? Math.round(totais.valor * 100) / 100 : null;
  totalRow.getCell(8).numFmt = formatoMoeda;
  totalRow.font = { bold: true };
  for (let col = 1; col <= 8; col += 1) {
    totalRow.getCell(col).border = { top: { style: 'thin', color: { argb: 'FF57534E' } } };
  }
  void firstItemRow;

  if (proposta.observacoes) {
    row += 2;
    sheet.getCell(row, 1).value = 'Observações';
    sheet.getCell(row, 1).font = { bold: true, color: { argb: 'FF92400E' } };
    row += 1;
    sheet.mergeCells(row, 1, row + 2, 8);
    const obs = sheet.getCell(row, 1);
    obs.value = proposta.observacoes;
    obs.alignment = { wrapText: true, vertical: 'top' };
  }

  // Composição (o usuário escolhe se aparece).
  if (proposta.incluirComposicao) {
    const comp = book.addWorksheet('Composição', { views: [{ showGridLines: false }] });
    comp.columns = [
      { header: 'Produto', width: 32 },
      { header: 'NPK', width: 11 },
      { header: 'Matéria-prima', width: 30 },
      { header: 'Tipo', width: 9 },
      { header: 'kg por tonelada', width: 16 },
    ];
    comp.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF57534E' } };
    });
    itens.forEach((item) =>
      item.composicao.forEach((material) =>
        comp.addRow([
          item.formulaNome,
          item.npk || '',
          material.nome,
          material.tipo || '',
          Math.round(material.kg),
        ])
      )
    );
  }

  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}
