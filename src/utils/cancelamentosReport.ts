import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings } from '../types';
import type { CancelamentoRelatorioRow } from '../services/pedidosVendaService';

export type CancelamentoReportMode = 'canc_substitui' | 'definitivo';
export type CancelamentoGroupBy = 'nenhum' | 'cliente' | 'pedido' | 'barra';

export const GROUP_LABEL: Record<CancelamentoGroupBy, string> = {
  nenhum: 'Sem agrupamento',
  cliente: 'Por cliente',
  pedido: 'Por pedido',
  barra: 'Por barra',
};

export const MODE_TITLE: Record<CancelamentoReportMode, string> = {
  canc_substitui: 'Relatório de Canc/Substitui',
  definitivo: 'Relatório de Saldos Cancelados',
};

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

export const formatQtd = (value?: number | null) =>
  `${(Number(value) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} t`;

export const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Número do pedido sem o emitente ("1045/2" → "1045"). */
export const pedidoNumero = (barra?: string) => (barra || '').split('/')[0].trim() || 'Sem número';

/** Busca livre em pedido, cliente, I.E., produto, usuário e motivo (sem acentos). */
export function filterCancelamentos(rows: CancelamentoRelatorioRow[], text: string) {
  const term = normalize(text.trim());
  if (!term) return rows;
  return rows.filter((row) =>
    normalize(
      [
        row.pedidoOrigemNome,
        row.pedidoDestinoNome,
        row.pedidoOrigemCliente,
        row.pedidoDestinoCliente,
        row.pedidoOrigemIe,
        row.pedidoOrigemProduto,
        row.usuario_nome,
        row.motivo,
      ]
        .filter(Boolean)
        .join(' ')
    ).includes(term)
  );
}

export interface CancelamentoGroup {
  key: string;
  label: string;
  subtitle?: string;
  rows: CancelamentoRelatorioRow[];
  quantidade: number;
}

function groupIdentity(row: CancelamentoRelatorioRow, by: CancelamentoGroupBy) {
  switch (by) {
    case 'cliente': {
      const name = row.pedidoOrigemCliente?.trim() || 'Cliente não informado';
      return {
        key: normalize(name),
        label: name,
        subtitle: row.pedidoOrigemIe ? `I.E. ${row.pedidoOrigemIe}` : undefined,
      };
    }
    case 'pedido': {
      const numero = pedidoNumero(row.pedidoOrigemNome);
      return { key: numero, label: `Pedido ${numero}`, subtitle: row.pedidoOrigemCliente };
    }
    case 'barra': {
      const barra = row.pedidoOrigemNome?.trim() || 'Sem número';
      return { key: barra, label: `Barra ${barra}`, subtitle: row.pedidoOrigemCliente };
    }
    default:
      return { key: 'todos', label: 'Todos os registros' };
  }
}

/** Agrupa os registros; grupos com mais toneladas primeiro, depois por nome. */
export function groupCancelamentos(
  rows: CancelamentoRelatorioRow[],
  by: CancelamentoGroupBy
): CancelamentoGroup[] {
  const groups = new Map<string, CancelamentoGroup>();
  rows.forEach((row) => {
    const identity = groupIdentity(row, by);
    const current = groups.get(identity.key);
    if (current) {
      current.rows.push(row);
      current.quantidade += Number(row.quantidade) || 0;
    } else {
      groups.set(identity.key, {
        ...identity,
        rows: [row],
        quantidade: Number(row.quantidade) || 0,
      });
    }
  });
  return [...groups.values()].sort(
    (left, right) =>
      right.quantidade - left.quantidade || left.label.localeCompare(right.label, 'pt-BR')
  );
}

export function summarizeCancelamentos(rows: CancelamentoRelatorioRow[]) {
  return {
    registros: rows.length,
    quantidade: rows.reduce((total, row) => total + (Number(row.quantidade) || 0), 0),
    clientes: new Set(rows.map((row) => normalize(row.pedidoOrigemCliente || '—'))).size,
    pedidos: new Set(rows.map((row) => pedidoNumero(row.pedidoOrigemNome))).size,
  };
}

/** Colunas do relatório, iguais na tela, no PDF e no Excel. */
export function reportColumns(mode: CancelamentoReportMode) {
  return mode === 'canc_substitui'
    ? [
        'Data',
        'Pedido origem',
        'Pedido destino',
        'Cliente origem',
        'Cliente destino',
        'Produto',
        'Qtd original',
        'Qtd substituída',
        'Saldo restante',
        'Usuário',
        'Motivo',
      ]
    : [
        'Data',
        'Pedido',
        'Cliente',
        'Produto',
        'Qtd original',
        'Qtd cancelada',
        'Saldo restante',
        'Usuário',
        'Motivo',
      ];
}

export function reportRowValues(
  row: CancelamentoRelatorioRow,
  mode: CancelamentoReportMode
): string[] {
  const cliente = (name?: string, ie?: string) => `${name || '—'}${ie ? ` (I.E. ${ie})` : ''}`;
  const common = {
    data: formatDateTime(row.criado_em),
    produto: row.pedidoOrigemProduto || '—',
    original: row.pedidoOrigemQtd != null ? formatQtd(row.pedidoOrigemQtd) : '—',
    quantidade: formatQtd(row.quantidade),
    saldo: row.pedidoSaldoRestante != null ? formatQtd(row.pedidoSaldoRestante) : '—',
    usuario: row.usuario_nome || '—',
    motivo: row.motivo || '—',
  };
  return mode === 'canc_substitui'
    ? [
        common.data,
        row.pedidoOrigemNome || '—',
        row.pedidoDestinoNome || '—',
        cliente(row.pedidoOrigemCliente, row.pedidoOrigemIe),
        cliente(row.pedidoDestinoCliente, row.pedidoDestinoIe),
        common.produto,
        common.original,
        common.quantidade,
        common.saldo,
        common.usuario,
        common.motivo,
      ]
    : [
        common.data,
        row.pedidoOrigemNome || '—',
        cliente(row.pedidoOrigemCliente, row.pedidoOrigemIe),
        common.produto,
        common.original,
        common.quantidade,
        common.saldo,
        common.usuario,
        common.motivo,
      ];
}

/** Linhas da planilha: uma por registro, com o grupo na primeira coluna e números como número. */
export function buildCancelamentosSheetRows(
  groups: CancelamentoGroup[],
  mode: CancelamentoReportMode,
  by: CancelamentoGroupBy
) {
  return groups.flatMap((group) =>
    group.rows.map((row) => {
      const base: Record<string, string | number> = {};
      if (by !== 'nenhum') base.Grupo = group.label;
      base.Data = formatDateTime(row.criado_em);
      if (mode === 'canc_substitui') {
        base['Pedido origem'] = row.pedidoOrigemNome || '';
        base['Pedido destino'] = row.pedidoDestinoNome || '';
        base['Cliente origem'] = row.pedidoOrigemCliente || '';
        base['I.E. origem'] = row.pedidoOrigemIe || '';
        base['Cliente destino'] = row.pedidoDestinoCliente || '';
        base['I.E. destino'] = row.pedidoDestinoIe || '';
      } else {
        base.Pedido = row.pedidoOrigemNome || '';
        base.Cliente = row.pedidoOrigemCliente || '';
        base['I.E.'] = row.pedidoOrigemIe || '';
      }
      base.Produto = row.pedidoOrigemProduto || '';
      base['Qtd original (t)'] = row.pedidoOrigemQtd ?? '';
      base[mode === 'canc_substitui' ? 'Qtd substituída (t)' : 'Qtd cancelada (t)'] =
        Number(row.quantidade) || 0;
      base['Saldo restante (t)'] = row.pedidoSaldoRestante ?? '';
      base.Usuário = row.usuario_nome || '';
      base.Motivo = row.motivo || '';
      return base;
    })
  );
}

interface CancelamentosPdfInput {
  mode: CancelamentoReportMode;
  groupBy: CancelamentoGroupBy;
  groups: CancelamentoGroup[];
  filtersText: string;
  settings?: Pick<AppSettings, 'companyName' | 'companyLogo'> | null;
  now?: Date;
}

/** PDF no estilo do FertCalc: logo, título, resumo, grupos com subtotal e total geral. */
export function createCancelamentosPdf({
  mode,
  groupBy,
  groups,
  filtersText,
  settings,
  now = new Date(),
}: CancelamentosPdfInput): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const rows = groups.flatMap((group) => group.rows);
  const summary = summarizeCancelamentos(rows);

  // Cabeçalho: logo da empresa (proporção original) ou nome.
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
    doc.setTextColor(5, 120, 85);
    doc.text(settings?.companyName?.trim() || 'FertCalc', margin, 18);
  }
  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(MODE_TITLE[mode], pageWidth - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${GROUP_LABEL[groupBy]} · Gerado em ${now.toLocaleString('pt-BR')}`,
    pageWidth - margin,
    20,
    {
      align: 'right',
    }
  );
  doc.text(
    doc.splitTextToSize(`Filtros: ${filtersText}`, pageWidth / 2)[0],
    pageWidth - margin,
    25,
    {
      align: 'right',
    }
  );
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.5);
  doc.line(margin, 28, pageWidth - margin, 28);

  // Resumo
  const boxes = [
    ['Registros', String(summary.registros)],
    [
      mode === 'canc_substitui' ? 'Quantidade substituída' : 'Quantidade cancelada',
      formatQtd(summary.quantidade),
    ],
    ['Clientes', String(summary.clientes)],
    ['Pedidos', String(summary.pedidos)],
  ];
  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  boxes.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + 3);
    doc.setFillColor(245, 245, 244);
    doc.roundedRect(x, 32, boxWidth, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(label.toUpperCase(), x + 3, 37);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(value, x + 3, 43.5);
  });

  let cursorY = 52;
  const head = [reportColumns(mode)];
  const quantityColumn = mode === 'canc_substitui' ? 7 : 5;
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
      doc.text(
        `${group.label}${group.subtitle ? ` · ${group.subtitle}` : ''}`,
        margin + 3,
        cursorY + 4.8
      );
      doc.text(
        `${group.rows.length} registro(s) · ${formatQtd(group.quantidade)}`,
        pageWidth - margin - 3,
        cursorY + 4.8,
        { align: 'right' }
      );
      cursorY += 8;
    }
    autoTable(doc, {
      startY: cursorY,
      head,
      body: group.rows.map((row) => reportRowValues(row, mode)),
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
      headStyles: { fillColor: [5, 120, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { [quantityColumn]: { fontStyle: 'bold', halign: 'right' } },
    });
    cursorY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) +
      6;
  });

  if (cursorY > pageHeight - 20) {
    doc.addPage();
    cursorY = 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text(
    `Total geral: ${summary.registros} registro(s) · ${formatQtd(summary.quantidade)}`,
    pageWidth - margin,
    cursorY,
    { align: 'right' }
  );

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(MODE_TITLE[mode], margin, pageHeight - 6);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }
  return doc;
}
