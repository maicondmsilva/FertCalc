import type { Agent, Client } from '../../types';

type Row = Record<string, unknown>;

export interface ImportResult<T> {
  items: T[];
  /** Linhas da planilha (numeração do Excel, cabeçalho = 1) sem campo obrigatório. */
  missingRequired: number[];
  /** Linhas com CPF/CNPJ já cadastrado ou repetido na própria planilha. */
  duplicated: number[];
}

/** Só os dígitos, para comparar "12.345.678/0001-90" com "12345678000190". */
export const normalizeDocument = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const text = (row: Row, key: string) => {
  const value = row[key];
  return value === undefined || value === null ? '' : String(value).trim();
};

const address = (row: Row) =>
  text(row, 'CEP') || text(row, 'Rua')
    ? {
        cep: text(row, 'CEP'),
        street: text(row, 'Rua'),
        number: text(row, 'Número'),
        neighborhood: text(row, 'Bairro'),
        city: text(row, 'Cidade'),
        state: text(row, 'Estado (UF)').toUpperCase(),
      }
    : undefined;

function parseRows<T>(
  rows: Row[],
  existingDocuments: Iterable<string>,
  nameKey: string,
  documentKey: string,
  build: (row: Row, name: string, document: string) => T
): ImportResult<T> {
  const seen = new Set<string>();
  for (const document of existingDocuments) {
    const digits = normalizeDocument(document);
    if (digits) seen.add(digits);
  }
  const result: ImportResult<T> = { items: [], missingRequired: [], duplicated: [] };
  rows.forEach((row, index) => {
    const line = index + 2;
    const name = text(row, nameKey);
    const document = text(row, documentKey);
    const digits = normalizeDocument(document);
    if (!name || !digits) {
      result.missingRequired.push(line);
      return;
    }
    if (seen.has(digits)) {
      result.duplicated.push(line);
      return;
    }
    seen.add(digits);
    result.items.push(build(row, name, document));
  });
  return result;
}

export const parseClientRows = (rows: Row[], existingDocuments: Iterable<string>) =>
  parseRows<Omit<Client, 'id'>>(
    rows,
    existingDocuments,
    'Razão Social / Nome*',
    'CNPJ / CPF*',
    (row, name, document) => ({
      name,
      document,
      code: text(row, 'Código'),
      email: text(row, 'E-mail'),
      phone: text(row, 'Telefone'),
      stateRegistration: text(row, 'Inscrição Estadual'),
      fazenda: text(row, 'Fazenda'),
      address: address(row),
    })
  );

export const parseAgentRows = (rows: Row[], existingDocuments: Iterable<string>) =>
  parseRows<Omit<Agent, 'id'>>(
    rows,
    existingDocuments,
    'Nome*',
    'Documento*',
    (row, name, document) => ({
      name,
      document,
      code: text(row, 'Código'),
      email: text(row, 'E-mail'),
      phone: text(row, 'Telefone'),
      ie: text(row, 'Inscrição Estadual'),
      address: address(row),
    })
  );

const formatLines = (lines: number[]) =>
  lines.length > 8
    ? `${lines.slice(0, 8).join(', ')} e mais ${lines.length - 8}`
    : lines.join(', ');

/** Resumo do que ficou de fora, para o aviso depois da importação. */
export function describeSkipped(result: ImportResult<unknown>): string {
  const parts: string[] = [];
  if (result.duplicated.length)
    parts.push(
      `${result.duplicated.length} já cadastrado(s) ou repetido(s) (linhas ${formatLines(result.duplicated)})`
    );
  if (result.missingRequired.length)
    parts.push(
      `${result.missingRequired.length} sem nome ou documento (linhas ${formatLines(result.missingRequired)})`
    );
  return parts.join('; ');
}
