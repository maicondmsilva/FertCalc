/**
 * Formata um ID numérico com prefixo e zero-padding.
 *
 * @param id     - Número sequencial (ex: 3)
 * @param prefix - Prefixo opcional (ex: 'COT-2026-', '#', 'CAR-')
 * @param pad    - Quantidade de dígitos com zero à esquerda (padrão: 4)
 * @returns string formatada (ex: 'COT-2026-0003', '#0007', 'CAR-0012')
 *
 * @example
 * formatId(3, 'COT-2026-') // → 'COT-2026-0003'
 * formatId(7, '#')         // → '#0007'
 * formatId(12, 'CAR-')     // → 'CAR-0012'
 * formatId(1)              // → '0001'
 */
export function formatId(id: number | undefined | null, prefix = '', pad = 4): string {
  if (id == null || isNaN(id)) return '—';
  return `${prefix}${String(id).padStart(pad, '0')}`;
}

/**
 * Formata o número de um carregamento.
 * @example formatCarregamentoId(7) → 'CAR-0007'
 */
export function formatCarregamentoId(numero: number | undefined | null): string {
  return formatId(numero, 'CAR-');
}

/**
 * Formata o número de uma cotação de frete.
 * @example formatCotacaoId(3) → 'COT-2026-0003'
 */
export function formatCotacaoId(numero: number | undefined | null): string {
  const year = new Date().getFullYear();
  return formatId(numero, `COT-${year}-`);
}

/**
 * Formata o número de uma lista de preços.
 * @example formatPriceListId(5) → 'LP-0005'
 */
export function formatPriceListId(id: number | undefined | null): string {
  return formatId(id, 'LP-');
}
