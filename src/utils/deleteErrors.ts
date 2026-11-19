/**
 * Erros de exclusão traduzidos para o usuário. O banco recusa excluir um registro
 * que ainda tem dados ligados (chave estrangeira, código 23503) e, quando o usuário
 * não tem permissão, simplesmente não exclui nada (RLS), sem devolver erro.
 */
export type DeleteBlockedReason = 'linked' | 'not_allowed';

export class DeleteBlockedError extends Error {
  readonly reason: DeleteBlockedReason;
  readonly linkedTo?: string;

  constructor(reason: DeleteBlockedReason, linkedTo?: string) {
    super(
      reason === 'linked'
        ? `Existem ${linkedTo || 'registros'} ligados a este cadastro.`
        : 'Seu usuário não tem permissão para excluir este cadastro.'
    );
    this.name = 'DeleteBlockedError';
    this.reason = reason;
    this.linkedTo = linkedTo;
  }
}

const LINKED_TABLE_LABELS: Record<string, string> = {
  price_lists: 'listas de preço',
  locais_carregamento: 'locais de carregamento',
  carregamentos: 'carregamentos',
  cotacoes_frete: 'cotações de frete',
  pedidos_venda: 'pedidos de venda',
  management_reports: 'relatórios gerenciais',
  calculator_extra_product_locations: 'produtos extras da calculadora',
  historico_precos_formulados: 'históricos de preço',
};

export function describeLinkedTable(table: string | undefined): string {
  if (!table) return 'registros';
  if (LINKED_TABLE_LABELS[table]) return LINKED_TABLE_LABELS[table];
  if (table.startsWith('management_report') || table.startsWith('relatorio')) {
    return 'relatórios gerenciais';
  }
  return `registros em "${table.replace(/_/g, ' ')}"`;
}

interface DatabaseError {
  code?: string;
  details?: string;
  message?: string;
}

/** Converte o erro do banco em DeleteBlockedError quando houver dados ligados. */
export function toDeleteError(error: DatabaseError): Error {
  if (error?.code === '23503') {
    const table = /table "([^"]+)"/.exec(`${error.details || ''} ${error.message || ''}`)?.[1];
    return new DeleteBlockedError('linked', describeLinkedTable(table));
  }
  return error instanceof Error ? error : new Error(error?.message || 'Erro ao excluir.');
}

/** Garante que a exclusão realmente removeu a linha; senão, faltou permissão. */
export function assertDeleted(rows: unknown[] | null | undefined): void {
  if (!rows || rows.length === 0) throw new DeleteBlockedError('not_allowed');
}
