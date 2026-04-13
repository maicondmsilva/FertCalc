import type { DadosExtraidosPDF } from '../types/pedidoVenda';

/**
 * Extract text from a PDF file using pdfjs-dist (browser-side).
 * Returns the concatenated text from all pages.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // Configure the worker (use the bundled worker from the package)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item): item is { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n');
}

/**
 * Parse extracted PDF text using regex patterns common in Brazilian
 * invoices / pedidos de venda.
 */
export function parsePedidoData(text: string): DadosExtraidosPDF {
  const result: DadosExtraidosPDF = {};

  // Nº do pedido: "Pedido: 1234", "Nº 1234", "Pedido Nº 1234", "PEDIDO DE FORNECIMENTO Nº 1234"
  const pedidoMatch = text.match(/(?:pedido(?:\s+de\s+\w+)?\s*(?:n[ºo°]?\.?\s*)?[:.]?\s*)(\d+)/i);
  if (pedidoMatch) result.numero_pedido = pedidoMatch[1];

  // Barra: "1234/1", "1234/01"
  const barraMatch = text.match(/(\d{3,})\s*\/\s*(\d+)/);
  if (barraMatch) {
    if (!result.numero_pedido) result.numero_pedido = barraMatch[1];
    result.barra_pedido = barraMatch[2];
  }

  // Data: dd/mm/yyyy
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    result.data_pedido = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // Quantity: "1.000 ton", "500 kg", "1000,00 TON", "Quantidade: 1.000,000"
  const qtyMatch = text.match(
    /(?:quantidade|qtd|qtde|quant)\.?\s*(?::)?\s*([\d.,]+)\s*(?:ton|kg|t\b)?/i
  );
  if (qtyMatch) {
    result.quantidade_real = parseBRNumber(qtyMatch[1]);
  } else {
    // Try pattern like "1.000,000 TON"
    const tonMatch = text.match(/([\d.,]+)\s*(?:ton|TON)/i);
    if (tonMatch) result.quantidade_real = parseBRNumber(tonMatch[1]);
  }

  // Valor unitário: "Valor Unitário: R$ 1.500,00" or "R$ 1.500,00/ton"
  const unitMatch = text.match(
    /(?:valor\s+unit[aá]rio|pre[çc]o\s+unit[aá]rio|vl\.?\s+unit)\.?\s*(?::)?\s*R?\$?\s*([\d.,]+)/i
  );
  if (unitMatch) result.valor_unitario = parseBRNumber(unitMatch[1]);

  // Valor total: "Valor Total: R$ 1.500.000,00" or "Total: R$ ..."
  const totalMatch = text.match(
    /(?:valor\s+total|total\s+(?:geral|do\s+pedido))\.?\s*(?::)?\s*R?\$?\s*([\d.,]+)/i
  );
  if (totalMatch) result.valor_total = parseBRNumber(totalMatch[1]);

  // Generic R$ value as fallback for valor_total if not found
  if (!result.valor_total && !result.valor_unitario) {
    const valMatches = [...text.matchAll(/R\$\s*([\d.,]+)/g)];
    if (valMatches.length > 0) {
      const parsed = valMatches.map((m) => parseBRNumber(m[1])).filter((n) => n > 0);
      if (parsed.length >= 2) {
        parsed.sort((a, b) => a - b);
        result.valor_unitario = parsed[0];
        result.valor_total = parsed[parsed.length - 1];
      } else if (parsed.length === 1) {
        result.valor_total = parsed[0];
      }
    }
  }

  // Embalagem: "Embalagem: Big Bag", "EMBALAGEM: GRANEL"
  const embMatch = text.match(/embalagem\s*(?::)?\s*(\S+(?:\s+\S+)?)/i);
  if (embMatch) result.embalagem = embMatch[1].trim();

  // Tipo de frete: CIF / FOB
  const freteTypeMatch = text.match(/\b(CIF|FOB)\b/i);
  if (freteTypeMatch) result.tipo_frete = freteTypeMatch[1].toUpperCase();

  // Valor do frete: "Frete: R$ 150,00"
  const freteValMatch = text.match(
    /(?:valor\s+(?:do\s+)?frete|frete)\s*(?::)?\s*R?\$?\s*([\d.,]+)/i
  );
  if (freteValMatch) result.valor_frete = parseBRNumber(freteValMatch[1]);

  return result;
}

/** Parse a Brazilian-formatted number string like "1.500,00" → 1500.00 */
function parseBRNumber(raw: string): number {
  // Remove dots (thousands) then replace comma (decimal) with dot
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
