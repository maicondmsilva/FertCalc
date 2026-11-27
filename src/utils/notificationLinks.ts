/**
 * Para onde cada aviso leva ao ser clicado (card no canto da tela e sino).
 * Usado ao gravar o aviso (quando quem criou não informou o link) e ao abrir
 * avisos antigos, que foram gravados sem link ou com endereços que mudaram.
 */

export interface NotificationLinkInput {
  type?: string | null;
  group_type?: string | null;
  title?: string | null;
  action_url?: string | null;
  data_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const entityId = (input: NotificationLinkInput): string | null => {
  const candidates = [
    input.data_id,
    input.metadata?.entityId,
    input.metadata?.propostaId,
    input.metadata?.pricingId,
  ];
  const found = candidates.find((value) => typeof value === 'string' && UUID.test(value));
  return (found as string | undefined) ?? null;
};

const normalize = (text?: string | null) =>
  (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Link padrão pelo tipo do aviso (sem olhar o action_url gravado). */
export function defaultNotificationUrl(input: NotificationLinkInput): string | null {
  const type = input.type || '';
  const title = normalize(input.title);
  const id = entityId(input);
  const pricing = id ? `/history?pricing=${id}` : '/history';

  switch (type) {
    case 'PROPOSTA_ACEITA':
    case 'PROPOSTA_RECUSADA':
      return `/saved_formulas?aba=propostas${id ? `&proposta=${id}` : ''}`;
    case 'pricing_deletion_request':
      return '/approvals?aba=deletions';
    case 'pricing_transfer':
    case 'TRANSFER_INITIATED':
    case 'TRANSFER_ACCEPTED':
    case 'PRICING_CREATED':
    case 'PRICING_UPDATED':
      return pricing;
    case 'PRICING_DELETED':
      return '/history';
    case 'goal_approval':
      return title.includes('pendente') ? '/approvals?aba=goals' : '/goals';
    case 'pricing_approval':
      if (title.includes('garantia')) return '/approvals?aba=guarantees';
      // Para quem aprova: nova, alterada ou reenviada.
      if (title.includes('pendente') || title.includes('alterada') || title.includes('reenvio'))
        return '/approvals';
      // Para o vendedor: resultado da aprovação ou da exclusão.
      return title.includes('exclusao') ? '/history' : pricing;
    default:
      break;
  }

  switch (input.group_type) {
    case 'CARREGAMENTO':
      return type.startsWith('COTACAO') ? '/carregamento_solicitacao' : '/carregamento_visao_geral';
    case 'PRICING':
    case 'TRANSFER':
      return pricing;
    case 'PROPOSTAS':
      return '/saved_formulas?aba=propostas';
    default:
      return null;
  }
}

/** Link final do aviso: o gravado (corrigido se for endereço antigo) ou o padrão. */
export function notificationTarget(input: NotificationLinkInput): string | null {
  const url = (input.action_url || '').trim();
  if (!url) return defaultNotificationUrl(input);
  if (url === '/carregamento' || url.startsWith('/carregamento?'))
    return '/carregamento_visao_geral';
  const calculator = /^\/calculator\?id=([0-9a-f-]{36})/i.exec(url);
  if (calculator) return `/history?pricing=${calculator[1]}`;
  if (url === '/saved_formulas' && input.type?.startsWith('PROPOSTA_')) {
    return defaultNotificationUrl(input);
  }
  return url;
}
