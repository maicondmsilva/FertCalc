/**
 * Validade da cotação de frete aprovada. Quem cota (logística) define até
 * quando o valor vale; depois disso a cotação some da busca da precificação.
 * Cotações antigas, sem data, continuam disponíveis.
 */

const toLocalDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const todayKey = (now = new Date()) => toLocalDateKey(now);

/** Data padrão sugerida para a validade: hoje + dias. */
export const defaultValidity = (days = 7, now = new Date()) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
};

export interface QuoteValidity {
  /** Data no formato AAAA-MM-DD, ou vazio se a cotação não tem validade. */
  until: string;
  expired: boolean;
  /** Dias restantes (0 = vence hoje); null sem validade. */
  daysLeft: number | null;
  label: string;
}

export function quoteValidity(validadeAte?: string | null, now = new Date()): QuoteValidity {
  const until = (validadeAte || '').slice(0, 10);
  if (!until) return { until: '', expired: false, daysLeft: null, label: 'Sem prazo definido' };
  const today = new Date(`${todayKey(now)}T12:00:00`);
  const end = new Date(`${until}T12:00:00`);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  const shown = end.toLocaleDateString('pt-BR');
  if (daysLeft < 0) return { until, expired: true, daysLeft, label: `Vencida em ${shown}` };
  if (daysLeft === 0) return { until, expired: false, daysLeft, label: 'Vence hoje' };
  return {
    until,
    expired: false,
    daysLeft,
    label: `Válida até ${shown} (${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'})`,
  };
}

/** Problema com a validade informada pela logística, ou null se estiver certa. */
export function validityProblem(value: string, now = new Date()): string | null {
  if (!value) return 'Informe até quando a cotação fica disponível para o solicitante.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data de validade inválida.';
  if (value < todayKey(now)) return 'A validade não pode ser uma data que já passou.';
  return null;
}
