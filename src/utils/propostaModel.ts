import type { Proposta, PropostaSituacao } from '../types/proposta';

/** Hoje no formato AAAA-MM-DD (horário local). */
export function hojeIso(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function somarDias(iso: string, dias: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + dias);
  return hojeIso(date);
}

/** Validade sugerida ao criar (o usuário pode mudar). */
export const VALIDADE_PADRAO_DIAS = 7;

export const formatNumeroProposta = (numero: number) => `PROP-${String(numero).padStart(6, '0')}`;

export const formatDataBr = (iso?: string) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

export function situacaoProposta(
  proposta: Pick<Proposta, 'status' | 'validaAte'>,
  hoje: string = hojeIso()
): PropostaSituacao {
  if (proposta.status === 'vigente' && proposta.validaAte < hoje) return 'vencida';
  return proposta.status;
}

/** Proposta fora da validade: só consulta, e o PDF sai com marca d'água. */
export const propostaVencida = (proposta: Pick<Proposta, 'validaAte'>, hoje: string = hojeIso()) =>
  proposta.validaAte < hoje;

/** Dias até vencer (0 = vence hoje; negativo = já venceu). */
export function diasParaVencer(validaAte: string, hoje: string = hojeIso()): number {
  const start = new Date(`${hoje}T12:00:00`).getTime();
  const end = new Date(`${validaAte}T12:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export const SITUACAO_PROPOSTA: Record<PropostaSituacao, { label: string; className: string }> = {
  vigente: { label: 'Vigente', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  vencida: { label: 'Vencida', className: 'bg-stone-100 text-stone-600 ring-stone-300' },
  aceita: { label: 'Aceita', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  recusada: { label: 'Recusada', className: 'bg-red-50 text-red-700 ring-red-200' },
  convertida: { label: 'Convertida', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  cancelada: { label: 'Cancelada', className: 'bg-stone-100 text-stone-500 ring-stone-200' },
};

export interface PropostaFiltros {
  busca: string;
  situacao: PropostaSituacao | '';
  regiao: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarPropostas(
  propostas: Proposta[],
  filtros: PropostaFiltros,
  hoje: string = hojeIso()
): Proposta[] {
  const termo = normalize(filtros.busca.trim());
  const digits = filtros.busca.replace(/\D/g, '');
  return propostas.filter((proposta) => {
    if (filtros.situacao && situacaoProposta(proposta, hoje) !== filtros.situacao) return false;
    if (filtros.regiao === 'none' && proposta.regionId) return false;
    if (filtros.regiao && filtros.regiao !== 'none' && proposta.regionId !== filtros.regiao)
      return false;
    if (!termo) return true;
    const texto = normalize(
      [
        formatNumeroProposta(proposta.numero),
        proposta.clienteNome,
        proposta.criadoPorNome,
        proposta.priceListNome || '',
      ].join(' ')
    );
    return (
      texto.includes(termo) ||
      (digits.length >= 3 && (proposta.clienteDocumento || '').replace(/\D/g, '').includes(digits))
    );
  });
}

export function estatisticasPropostas(propostas: Proposta[], hoje: string = hojeIso()) {
  const situacoes = propostas.map((proposta) => situacaoProposta(proposta, hoje));
  const decididas = situacoes.filter(
    (situacao) => situacao === 'aceita' || situacao === 'convertida' || situacao === 'recusada'
  ).length;
  const aceitas = situacoes.filter(
    (situacao) => situacao === 'aceita' || situacao === 'convertida'
  ).length;
  return {
    vigentes: situacoes.filter((situacao) => situacao === 'vigente').length,
    vencendo: propostas.filter(
      (proposta) =>
        situacaoProposta(proposta, hoje) === 'vigente' &&
        diasParaVencer(proposta.validaAte, hoje) <= 3
    ).length,
    aceitas,
    conversao: decididas > 0 ? (aceitas / decididas) * 100 : null,
    valorAceito: propostas.reduce((total, proposta) => total + (proposta.aceite?.valor || 0), 0),
    toneladasAceitas: propostas.reduce(
      (total, proposta) => total + (proposta.aceite?.toneladas || 0),
      0
    ),
  };
}

/**
 * Totais exibidos: depois do aceite, o que o cliente aceitou (quantidades
 * dele); antes, o que foi proposto (pode ser só preço/t, sem quantidade).
 */
export function totaisExibidos(
  proposta: Pick<Proposta, 'aceite' | 'valorTotal' | 'toneladasTotal'>
): { valor: number; toneladas: number; origem: 'aceite' | 'proposta' } {
  if (proposta.aceite) return { ...proposta.aceite, origem: 'aceite' };
  return { valor: proposta.valorTotal, toneladas: proposta.toneladasTotal, origem: 'proposta' };
}

/** Problema que impede criar a proposta (ou null). */
export function problemaNovaProposta(input: {
  validaAte: string;
  quantidadeItens: number;
  itensSemPreco: string[];
  hoje?: string;
}): string | null {
  const hoje = input.hoje ?? hojeIso();
  if (!input.validaAte) return 'Informe a validade da proposta.';
  if (input.validaAte < hoje) return 'A validade não pode ser anterior a hoje.';
  if (input.quantidadeItens === 0) return 'Selecione ao menos uma batida.';
  if (input.itensSemPreco.length > 0)
    return `Sem preço calculado: ${input.itensSemPreco.join(', ')}. Confira a lista de preço.`;
  return null;
}
