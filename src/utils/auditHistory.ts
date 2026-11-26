/**
 * Traduz um registro do histórico (audit_log) em mensagens para o usuário.
 * O banco guarda nomes de colunas, códigos de status, ids e datas ISO; aqui isso
 * vira "Cotação aprovada · Válida até 10/12/2026", "Frete por tonelada:
 * R$ 100,00 → R$ 120,00" e assim por diante. Ids e campos internos não aparecem.
 */

export type AuditTable = 'carregamentos' | 'cotacoes_solicitadas';

export interface AuditEntryLike {
  tabela?: AuditTable | string;
  acao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  campos_alterados?: string[] | null;
  motivo?: string | null;
}

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface AuditDescription {
  title: string;
  tone: 'created' | 'progress' | 'approved' | 'returned' | 'cancelled' | 'edited' | 'deleted';
  details: string[];
  changes: AuditChange[];
  note?: string;
}

/** Nomes já conhecidos para ids (transportadora, filial, local...). */
export type AuditNameLookup = Record<string, string>;

const COTACAO_STATUS: Record<string, string> = {
  aguardando: 'Aguardando cotação',
  em_analise: 'Em análise',
  cotado: 'Cotado',
  aprovado: 'Aprovado',
  cancelado: 'Cancelado',
};

const CARREGAMENTO_STATUS: Record<string, string> = {
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

type Kind = 'text' | 'money' | 'moneyPerTon' | 'tons' | 'days' | 'date' | 'datetime' | 'bool';

const FIELDS: Record<string, { label: string; kind: Kind }> = {
  status: { label: 'Situação', kind: 'text' },
  cliente_nome: { label: 'Cliente', kind: 'text' },
  fazenda: { label: 'Fazenda', kind: 'text' },
  produto: { label: 'Produto', kind: 'text' },
  quantidade_ton: { label: 'Quantidade', kind: 'tons' },
  quantidade_total: { label: 'Quantidade total', kind: 'tons' },
  quantidade_liberada: { label: 'Quantidade liberada', kind: 'tons' },
  endereco_entrega: { label: 'Endereço de entrega', kind: 'text' },
  cidade_entrega: { label: 'Cidade de entrega', kind: 'text' },
  estado_entrega: { label: 'Estado de entrega', kind: 'text' },
  inscricao_estadual: { label: 'Inscrição estadual', kind: 'text' },
  maps_url: { label: 'Link do mapa', kind: 'text' },
  observacoes: { label: 'Observações', kind: 'text' },
  obs_responsavel: { label: 'Observações da logística', kind: 'text' },
  transportadora_id: { label: 'Transportadora', kind: 'text' },
  transportadora_nome: { label: 'Transportadora', kind: 'text' },
  filial_id: { label: 'Filial', kind: 'text' },
  local_carregamento_id: { label: 'Local de carregamento', kind: 'text' },
  valor_frete: { label: 'Frete total', kind: 'money' },
  valor_frete_unitario: { label: 'Frete por tonelada', kind: 'moneyPerTon' },
  prazo_entrega_dias: { label: 'Prazo de entrega', kind: 'days' },
  validade_ate: { label: 'Válida até', kind: 'date' },
  cotado_em: { label: 'Cotada em', kind: 'datetime' },
  aprovado_em: { label: 'Aprovada em', kind: 'datetime' },
  motivo_recusa: { label: 'Motivo da devolução', kind: 'text' },
  tipo_liberacao: { label: 'Tipo de liberação', kind: 'text' },
  data_carregamento: { label: 'Data do carregamento', kind: 'date' },
  ativo: { label: 'Ativo', kind: 'bool' },
};

// Campos que só o sistema usa: nunca aparecem no histórico.
const HIDDEN = new Set([
  'id',
  'organization_id',
  'criado_em',
  'atualizado_em',
  'updated_at',
  'created_at',
  'solicitado_por',
  'responsavel_id',
  'recusado_por_id',
  'cliente_id',
  'pedido_venda_id',
  'precificacao_id',
  'numero_cotacao',
  'filial',
  'local_carregamento',
  'transportadora',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDate(value: string, withTime: boolean): string {
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(onlyDate ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime && !onlyDate
    ? date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('pt-BR');
}

function statusLabel(table: string | undefined, value: unknown): string {
  const key = String(value ?? '');
  const labels = table === 'carregamentos' ? CARREGAMENTO_STATUS : COTACAO_STATUS;
  return labels[key] || CARREGAMENTO_STATUS[key] || COTACAO_STATUS[key] || key;
}

export function formatAuditValue(
  field: string,
  value: unknown,
  table?: string,
  names: AuditNameLookup = {}
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status') return statusLabel(table, value);
  if (typeof value === 'string' && UUID.test(value)) return names[value] || 'outro cadastro';
  const kind = FIELDS[field]?.kind ?? 'text';
  const numeric = typeof value === 'number' ? value : Number(value);
  switch (kind) {
    case 'money':
      return Number.isFinite(numeric) ? brl(numeric) : String(value);
    case 'moneyPerTon':
      return Number.isFinite(numeric) ? `${brl(numeric)}/t` : String(value);
    case 'tons':
      return Number.isFinite(numeric)
        ? `${numeric.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t`
        : String(value);
    case 'days':
      return Number.isFinite(numeric) ? `${numeric} ${numeric === 1 ? 'dia' : 'dias'}` : '—';
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? formatDate(value, kind === 'datetime') : String(value);
    case 'bool':
      return value ? 'Sim' : 'Não';
    default:
      if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
      if (typeof value === 'object') return '—';
      return String(value);
  }
}

const fieldLabel = (field: string) =>
  FIELDS[field]?.label ?? field.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

function transportadoraName(data: Record<string, unknown>, names: AuditNameLookup) {
  const nested = data.transportadora as { nome?: string } | undefined;
  const id = String(data.transportadora_id ?? '');
  return (data.transportadora_nome as string) || nested?.nome || (id && names[id]) || '';
}

export function describeAuditEntry(
  entry: AuditEntryLike,
  names: AuditNameLookup = {}
): AuditDescription {
  const table = entry.tabela;
  const before = entry.dados_anteriores || {};
  const after = entry.dados_novos || {};
  const isQuote = table !== 'carregamentos';
  const newStatus = after.status !== undefined ? String(after.status) : '';
  const statusChanged = newStatus !== '' && newStatus !== String(before.status ?? '');

  if (entry.acao === 'INSERT') {
    const details = [
      after.cliente_nome ? `Cliente: ${after.cliente_nome}` : '',
      after.fazenda ? `Fazenda: ${after.fazenda}` : '',
      after.quantidade_ton != null || after.quantidade_total != null
        ? `Quantidade: ${formatAuditValue('quantidade_ton', after.quantidade_ton ?? after.quantidade_total)}`
        : '',
    ].filter(Boolean);
    return {
      title: isQuote ? 'Cotação solicitada' : 'Carregamento criado',
      tone: 'created',
      details,
      changes: [],
    };
  }

  if (entry.acao === 'DELETE') {
    return {
      title: isQuote ? 'Cotação excluída' : 'Carregamento excluído',
      tone: 'deleted',
      details: [
        before.cliente_nome ? `Cliente: ${before.cliente_nome}` : '',
        before.status ? `Situação na exclusão: ${statusLabel(table, before.status)}` : '',
      ].filter(Boolean),
      changes: [],
      note: entry.motivo || undefined,
    };
  }

  // UPDATE — título pelo que aconteceu com a situação.
  let title = 'Dados alterados';
  let tone: AuditDescription['tone'] = 'edited';
  const details: string[] = [];
  if (statusChanged && isQuote) {
    if (newStatus === 'cotado') {
      title = 'Cotação informada pela logística';
      tone = 'progress';
      const carrier = transportadoraName(after, names);
      if (carrier) details.push(`Transportadora: ${carrier}`);
      if (after.valor_frete_unitario != null)
        details.push(
          `Frete: ${formatAuditValue('valor_frete_unitario', after.valor_frete_unitario)}`
        );
      if (after.valor_frete != null)
        details.push(`Total: ${formatAuditValue('valor_frete', after.valor_frete)}`);
      if (after.prazo_entrega_dias != null)
        details.push(`Prazo: ${formatAuditValue('prazo_entrega_dias', after.prazo_entrega_dias)}`);
      if (after.validade_ate)
        details.push(`Válida até ${formatAuditValue('validade_ate', after.validade_ate)}`);
    } else if (newStatus === 'aprovado') {
      title = 'Cotação aprovada';
      tone = 'approved';
      if (after.validade_ate)
        details.push(
          `Disponível para o solicitante até ${formatAuditValue('validade_ate', after.validade_ate)}`
        );
    } else if (newStatus === 'em_analise') {
      title = before.status === 'aguardando' ? 'Cotação em análise' : 'Devolvida para revisão';
      tone = before.status === 'aguardando' ? 'progress' : 'returned';
      if (after.motivo_recusa) details.push(`Motivo: ${after.motivo_recusa}`);
    } else if (newStatus === 'cancelado') {
      title = 'Cotação cancelada';
      tone = 'cancelled';
    } else {
      title = `Situação: ${statusLabel(table, newStatus)}`;
      tone = 'progress';
    }
  } else if (statusChanged) {
    title = `Situação: ${statusLabel(table, before.status)} → ${statusLabel(table, newStatus)}`;
    tone = newStatus === 'cancelado' ? 'cancelled' : 'progress';
  }

  // Na mudança de situação os detalhes acima já contam a história; nas demais
  // edições, lista o antes → depois de cada campo que a pessoa entende.
  const fields = (
    entry.campos_alterados && entry.campos_alterados.length > 0
      ? entry.campos_alterados
      : Object.keys(after)
  ).filter((field) => !HIDDEN.has(field) && field !== 'status');
  const shownInDetails = statusChanged && isQuote;
  const changes: AuditChange[] = [];
  const seenLabels = new Set<string>();
  for (const field of fields) {
    if (shownInDetails) continue;
    const label = fieldLabel(field);
    if (seenLabels.has(label)) continue;
    const valueBefore =
      field === 'transportadora_id'
        ? transportadoraName(before, names) || formatAuditValue(field, before[field], table, names)
        : formatAuditValue(field, before[field], table, names);
    const valueAfter =
      field === 'transportadora_id'
        ? transportadoraName(after, names) || formatAuditValue(field, after[field], table, names)
        : formatAuditValue(field, after[field], table, names);
    if (valueBefore === valueAfter) continue;
    seenLabels.add(label);
    changes.push({ field, label, before: valueBefore, after: valueAfter });
  }

  // O motivo gravado repete o título ("Cotação aprovada por Fulano"): só mostra
  // quando traz algo além disso.
  const note =
    entry.motivo && !/^cota[cç][aã]o (aprovada|informada) por /i.test(entry.motivo)
      ? entry.motivo
      : undefined;

  if (!statusChanged && changes.length === 0 && !note) {
    return { title: 'Registro atualizado', tone: 'edited', details, changes, note };
  }
  return { title, tone, details, changes, note };
}
