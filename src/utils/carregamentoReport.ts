import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings } from '../types';
import type { Carregamento, StatusCarregamento } from '../types/carregamento';

export type CarregamentoGroupBy = 'nenhum' | 'transportadora' | 'status' | 'filial';

export const CARREGAMENTO_GROUP_LABEL: Record<CarregamentoGroupBy, string> = {
  nenhum: 'Sem agrupamento',
  transportadora: 'Por transportadora',
  status: 'Por status',
  filial: 'Por filial',
};

export const CARREGAMENTO_STATUS_LABEL: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'Aguardando cotação',
  cotacao_solicitada: 'Cotação solicitada',
  cotacao_recebida: 'Cotação recebida',
  aguardando_liberacao: 'Aguardando liberação',
  liberado_parcial: 'Liberado parcial',
  liberado_total: 'Liberado total',
  em_carregamento: 'Em carregamento',
  carregado: 'Carregado',
  cancelado: 'Cancelado',
};

const num = (value: unknown) => Number(value) || 0;
const ton = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const date = (value?: string) => {
  if (!value) return '—';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR');
};

export interface CarregamentoSummary {
  registros: number;
  solicitado: number;
  liberado: number;
  carregado: number;
  frete: number;
  /** Frete por tonelada carregada (ou solicitada, se nada foi carregado ainda). */
  fretePorTonelada: number;
}

export function summarizeCarregamentos(items: Carregamento[]): CarregamentoSummary {
  const solicitado = items.reduce((total, item) => total + num(item.quantidade_total), 0);
  const liberado = items.reduce((total, item) => total + num(item.quantidade_liberada), 0);
  const carregado = items.reduce((total, item) => total + num(item.quantidade_carregada), 0);
  const frete = items.reduce((total, item) => total + num(item.valor_frete), 0);
  const base = carregado > 0 ? carregado : solicitado;
  return {
    registros: items.length,
    solicitado,
    liberado,
    carregado,
    frete,
    fretePorTonelada: base > 0 ? frete / base : 0,
  };
}

export interface CarregamentoGroup {
  key: string;
  label: string;
  items: Carregamento[];
  summary: CarregamentoSummary;
}

function groupLabel(item: Carregamento, by: CarregamentoGroupBy): string {
  switch (by) {
    case 'transportadora':
      return (
        item.transportadora?.nome ||
        (item.tipo_frete === 'FOB' ? 'FOB (cliente retira)' : 'Sem transportadora')
      );
    case 'status':
      return CARREGAMENTO_STATUS_LABEL[item.status] || item.status;
    case 'filial':
      return item.filial?.nome || 'Sem filial';
    default:
      return 'Todos os carregamentos';
  }
}

/** Agrupa e ordena os grupos pelo volume carregado (maior primeiro). */
export function groupCarregamentos(
  items: Carregamento[],
  by: CarregamentoGroupBy
): CarregamentoGroup[] {
  const groups = new Map<string, Carregamento[]>();
  items.forEach((item) => {
    const label = groupLabel(item, by);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });
  return [...groups.entries()]
    .map(([label, groupItems]) => ({
      key: label,
      label,
      items: groupItems,
      summary: summarizeCarregamentos(groupItems),
    }))
    .sort(
      (left, right) =>
        right.summary.carregado - left.summary.carregado ||
        right.summary.solicitado - left.summary.solicitado ||
        left.label.localeCompare(right.label, 'pt-BR')
    );
}

export const CARREGAMENTO_COLUMNS = [
  'Nº',
  'Data',
  'Pedido',
  'Cliente',
  'Produto',
  'Filial / local',
  'Frete',
  'Transportadora',
  'Solicitado',
  'Carregado',
  'Valor do frete',
  'Status',
];

export function carregamentoRowValues(item: Carregamento): string[] {
  return [
    item.numero_carregamento || String(item.numero ?? '—'),
    date(item.data_real_carregamento || item.data_prevista_carregamento || item.criado_em),
    item.pedido_venda_numero || '—',
    item.pedido_cliente_nome || item.cliente_nome || '—',
    item.pedido_produto_nome || '—',
    [item.filial?.nome, item.local_carregamento?.nome].filter(Boolean).join(' / ') || '—',
    item.tipo_frete,
    item.transportadora?.nome || '—',
    ton(num(item.quantidade_total)),
    ton(num(item.quantidade_carregada)),
    item.valor_frete ? money(num(item.valor_frete)) : '—',
    CARREGAMENTO_STATUS_LABEL[item.status] || item.status,
  ];
}

/** Planilha: uma linha por carregamento, números como número, com o grupo na 1ª coluna. */
export function buildCarregamentoSheetRows(groups: CarregamentoGroup[], by: CarregamentoGroupBy) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...(by !== 'nenhum' ? { Grupo: group.label } : {}),
      Número: item.numero_carregamento || '',
      'Data prevista': date(item.data_prevista_carregamento),
      'Data do carregamento': date(item.data_real_carregamento),
      Pedido: item.pedido_venda_numero || '',
      Cliente: item.pedido_cliente_nome || item.cliente_nome || '',
      Produto: item.pedido_produto_nome || '',
      Filial: item.filial?.nome || '',
      Local: item.local_carregamento?.nome || '',
      Frete: item.tipo_frete,
      Transportadora: item.transportadora?.nome || '',
      'Solicitado (t)': num(item.quantidade_total),
      'Liberado (t)': num(item.quantidade_liberada),
      'Carregado (t)': num(item.quantidade_carregada),
      'Valor do frete (R$)': num(item.valor_frete),
      Status: CARREGAMENTO_STATUS_LABEL[item.status] || item.status,
    }))
  );
}

interface CarregamentoPdfInput {
  groupBy: CarregamentoGroupBy;
  groups: CarregamentoGroup[];
  filtersText: string;
  settings?: Pick<AppSettings, 'companyName' | 'companyLogo'> | null;
  now?: Date;
}

/** PDF do relatório de carregamentos no estilo do FertCalc. */
export function createCarregamentoPdf({
  groupBy,
  groups,
  filtersText,
  settings,
  now = new Date(),
}: CarregamentoPdfInput): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const summary = summarizeCarregamentos(groups.flatMap((group) => group.items));

  let logoDrawn = false;
  if (settings?.companyLogo) {
    try {
      const props = doc.getImageProperties(settings.companyLogo);
      const ratio = props.width > 0 && props.height > 0 ? props.width / props.height : 3;
      const width = Math.min(45, 15 * ratio);
      const height = width / ratio;
      const format = /image\/jpe?g/i.test(settings.companyLogo) ? 'JPEG' : 'PNG';
      doc.addImage(
        settings.companyLogo,
        format,
        margin,
        8 + (15 - height) / 2,
        width,
        height,
        undefined,
        'FAST'
      );
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(180, 83, 9);
    doc.text(settings?.companyName?.trim() || 'FertCalc', margin, 18);
  }
  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Relatório de Carregamentos', pageWidth - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${CARREGAMENTO_GROUP_LABEL[groupBy]} · Gerado em ${now.toLocaleString('pt-BR')}`,
    pageWidth - margin,
    20,
    { align: 'right' }
  );
  doc.text(
    doc.splitTextToSize(`Filtros: ${filtersText}`, pageWidth / 2)[0],
    pageWidth - margin,
    25,
    { align: 'right' }
  );
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.5);
  doc.line(margin, 28, pageWidth - margin, 28);

  const boxes: Array<[string, string]> = [
    ['Carregamentos', String(summary.registros)],
    ['Solicitado', ton(summary.solicitado)],
    ['Carregado', ton(summary.carregado)],
    ['Frete total', money(summary.frete)],
    ['Frete médio', `${money(summary.fretePorTonelada)}/t`],
  ];
  const boxWidth = (pageWidth - margin * 2 - 12) / boxes.length;
  boxes.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + 3);
    doc.setFillColor(245, 245, 244);
    doc.roundedRect(x, 32, boxWidth, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(label.toUpperCase(), x + 3, 37);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    doc.text(value, x + 3, 43.5);
  });

  let cursorY = 52;
  groups.forEach((group) => {
    if (groupBy !== 'nenhum') {
      if (cursorY > pageHeight - 35) {
        doc.addPage();
        cursorY = 14;
      }
      doc.setFillColor(28, 25, 23);
      doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(group.label, margin + 3, cursorY + 4.8);
      doc.text(
        `${group.summary.registros} carregamento(s) · ${ton(group.summary.carregado)} carregadas · frete ${money(group.summary.frete)}`,
        pageWidth - margin - 3,
        cursorY + 4.8,
        { align: 'right' }
      );
      cursorY += 8;
    }
    autoTable(doc, {
      startY: cursorY,
      head: [CARREGAMENTO_COLUMNS],
      body: group.items.map(carregamentoRowValues),
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 1.4,
        textColor: [30, 30, 30],
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: {
        8: { halign: 'right' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'right' },
      },
    });
    cursorY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) +
      6;
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('Relatório de Carregamentos', margin, pageHeight - 6);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }
  return doc;
}
