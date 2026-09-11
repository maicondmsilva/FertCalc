import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, PriceList, RawMaterial } from '../types';
import type { PriceListPdfGroup } from './priceListPdfSelection';

interface PriceListPdfDocumentInput {
  group: PriceListPdfGroup;
  lists: PriceList[];
  locationNames: Map<string, string>;
  settings?: AppSettings | null;
}

const nutrientPriority = ['N', 'P', 'K', 'Ca', 'S', 'Mg', 'B', 'Zn', 'Cu', 'Mn', 'Fe', 'Mo'];

const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

const formatNumber = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatPrice = (value: number, currency: 'BRL' | 'USD') => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const materialNutrients = (material: RawMaterial) => {
  const nutrients = new Map<string, number>();
  if (material.n) nutrients.set('N', material.n);
  if (material.p) nutrients.set('P', material.p);
  if (material.k) nutrients.set('K', material.k);
  if (material.ca) nutrients.set('Ca', material.ca);
  if (material.s) nutrients.set('S', material.s);
  material.microGuarantees?.forEach((guarantee) => {
    if (guarantee.value) nutrients.set(guarantee.name.trim(), guarantee.value);
  });
  return nutrients;
};

const uniqueMaterials = (lists: PriceList[], selector: (list: PriceList) => RawMaterial[]) => {
  const materials = new Map<string, RawMaterial>();
  lists.forEach((list) => {
    selector(list).forEach((material) => {
      const key = material.id || normalize(material.name);
      if (!materials.has(key)) materials.set(key, material);
    });
  });
  return Array.from(materials.values());
};

const findMaterial = (list: PriceList, source: RawMaterial) =>
  [...list.macros, ...list.micros].find(
    (material) => material.id === source.id || normalize(material.name) === normalize(source.name)
  );

const collectNutrients = (materials: RawMaterial[]) => {
  const names = new Set<string>();
  materials.forEach((material) => {
    materialNutrients(material).forEach((_, name) => names.add(name));
  });
  return Array.from(names).sort((a, b) => {
    const aIndex = nutrientPriority.indexOf(a);
    const bIndex = nutrientPriority.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, 'pt-BR');
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
};

export function createPriceListPdfDocument({
  group,
  lists,
  locationNames,
  settings,
}: PriceListPdfDocumentInput): jsPDF {
  const orderedLists = [...lists].sort((a, b) => {
    const aName = locationNames.get(a.local_carregamento_id || '') || '';
    const bName = locationNames.get(b.local_carregamento_id || '') || '';
    return aName.localeCompare(bName, 'pt-BR');
  });
  const landscape = orderedLists.length > 3;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  if (settings?.companyLogo) {
    try {
      const logoFormat = settings.companyLogo.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(settings.companyLogo, logoFormat, margin, 9, 39, 16, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(178, 24, 31);
      doc.setFontSize(18);
      doc.text(settings.companyName || 'FERTIGran', margin, 19);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(178, 24, 31);
    doc.setFontSize(18);
    doc.text(settings?.companyName || 'FERTIGran', margin, 19);
  }

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(group.label, pageWidth - margin, 15, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const details = [
    `Moeda: ${group.currency}`,
    `Competência: ${formatDate(group.competence)}`,
    group.revision ? `Revisão: ${group.revision}` : '',
    group.exchangeRate ? `Câmbio: R$ ${formatNumber(group.exchangeRate)}` : '',
    group.validFrom || group.validUntil
      ? `Validade: ${formatDate(group.validFrom)} a ${formatDate(group.validUntil)}`
      : '',
  ].filter(Boolean);
  doc.text(details.join('  |  '), pageWidth - margin, 21, { align: 'right' });
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.5);
  doc.line(margin, 28, pageWidth - margin, 28);

  let cursorY = 33;
  const sections = [
    {
      title: 'Linha Convencional',
      materials: uniqueMaterials(orderedLists, (list) => list.macros.filter((item) => !item.isPremiumLine)),
    },
    {
      title: 'Linha Diferenciada',
      materials: uniqueMaterials(orderedLists, (list) => list.macros.filter((item) => item.isPremiumLine)),
    },
    {
      title: 'Micronutrientes',
      materials: uniqueMaterials(orderedLists, (list) => list.micros),
    },
  ].filter((section) => section.materials.length > 0);

  sections.forEach((section) => {
    const nutrients = collectNutrients(section.materials);
    const head = [
      'Produto',
      ...nutrients,
      ...orderedLists.map(
        (list) => locationNames.get(list.local_carregamento_id || '') || 'Sem local'
      ),
    ];
    const body = section.materials.map((material) => {
      const guarantees = materialNutrients(material);
      return [
        material.name,
        ...nutrients.map((nutrient) =>
          guarantees.has(nutrient) ? formatNumber(guarantees.get(nutrient) || 0) : ''
        ),
        ...orderedLists.map((list) => {
          const listedMaterial = findMaterial(list, material);
          return formatPrice(listedMaterial?.price || 0, group.currency);
        }),
      ];
    });

    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = 14;
    }
    doc.setFillColor(25, 25, 25);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(section.title, margin + 3, cursorY + 4.8);
    cursorY += 8;

    const nutrientWidth = nutrients.length > 7 ? 7 : 8;
    const priceWidth = Math.max(24, Math.min(34, (pageWidth - margin * 2) / (orderedLists.length + 3)));
    const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right'; fontStyle?: 'normal' | 'bold' }> = {
      0: { cellWidth: 'auto' as unknown as number, halign: 'left', fontStyle: 'bold' },
    };
    nutrients.forEach((_, index) => {
      columnStyles[index + 1] = { cellWidth: nutrientWidth, halign: 'center' };
    });
    orderedLists.forEach((_, index) => {
      columnStyles[nutrients.length + index + 1] = { cellWidth: priceWidth, halign: 'right' };
    });

    autoTable(doc, {
      startY: cursorY,
      head: [head],
      body,
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: 15 },
      styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.35, textColor: [25, 25, 25], lineColor: [80, 80, 80], lineWidth: 0.15, overflow: 'linebreak' },
      headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center', lineColor: [20, 20, 20], lineWidth: 0.25 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles,
      rowPageBreak: 'avoid',
    });
    cursorY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 6;
  });

  if (group.notes?.trim()) {
    const notes = group.notes.split(/\r?\n|;/).map((note) => note.trim()).filter(Boolean);
    const wrappedNotes = notes.map((note) =>
      doc.splitTextToSize(`- ${note}`, pageWidth - margin * 2)
    );
    const requiredHeight = 10 + wrappedNotes.reduce((height, lines) => height + lines.length * 4, 0);
    if (cursorY + requiredHeight > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage();
      cursorY = 14;
    }
    doc.setTextColor(178, 24, 31);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Atenção', margin, cursorY);
    doc.setTextColor(35, 35, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let noteY = cursorY + 5;
    wrappedNotes.forEach((lines) => {
      if (noteY + lines.length * 4 > doc.internal.pageSize.getHeight() - 14) {
        doc.addPage();
        noteY = 14;
      }
      doc.text(lines, margin, noteY);
      noteY += lines.length * 4;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(110, 110, 110);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margin, doc.internal.pageSize.getHeight() - 6);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  return doc;
}

export function downloadPriceListPdf(input: PriceListPdfDocumentInput): void {
  const doc = createPriceListPdfDocument(input);
  const safeName = input.group.label.replace(/[^a-zA-Z0-9À-ÿ]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`lista-precos-${safeName || 'fertigran'}.pdf`);
}
