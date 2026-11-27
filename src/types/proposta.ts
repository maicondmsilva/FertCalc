export type PropostaStatus = 'vigente' | 'aceita' | 'recusada' | 'convertida' | 'cancelada';
/** Situação exibida: "vencida" é uma proposta vigente que passou da validade. */
export type PropostaSituacao = PropostaStatus | 'vencida';

export interface PropostaComposicaoItem {
  nome: string;
  kg: number;
  tipo?: 'Macro' | 'Micro';
}

/** Batida como fechou na proposta: base da precificação depois do aceite. */
export interface PropostaFormulaSnapshot {
  targetFormula: string;
  category?: string;
  targetCa?: number;
  targetS?: number;
  targetMicros?: Record<string, number>;
  macros: import('../types').RawMaterial[];
  micros: import('../types').RawMaterial[];
}

export interface PropostaItem {
  id?: string;
  ordem?: number;
  savedFormulaId?: string;
  codigo?: string;
  formulaNome: string;
  npk?: string;
  garantias?: string;
  embalagem?: string;
  precoTonelada: number;
  quantidadeSugerida?: number;
  composicao: PropostaComposicaoItem[];
  fatores?: Record<string, unknown>;
  formula?: PropostaFormulaSnapshot;
}

export interface PropostaClienteDados {
  documento?: string;
  inscricaoEstadual?: string;
  fazenda?: string;
  cidade?: string;
  estado?: string;
}

export interface PropostaEvento {
  id: string;
  tipo: string;
  descricao: string;
  criadoPorNome?: string;
  createdAt: string;
}

export interface PropostaRespostaItem {
  id: string;
  nome: string;
  npk?: string;
  savedFormulaId?: string;
  precoTonelada: number;
  quantidade: number;
}

/** Resposta do cliente pelo link (aceite ou recusa). */
export interface PropostaResposta {
  tipo: 'aceite' | 'recusa';
  documento: string;
  motivo?: string;
  itens: PropostaRespostaItem[];
  valorTotal: number;
  toneladasTotal: number;
  ip?: string;
  userAgent?: string;
  respondidoEm: string;
}

export interface Proposta {
  id: string;
  numero: number;
  criadoPor: string;
  criadoPorNome: string;
  regionId?: string;
  clientId?: string;
  clienteNome: string;
  clienteDocumento?: string;
  clienteDados: PropostaClienteDados;
  priceListId?: string;
  priceListNome?: string;
  localCarregamentoId?: string;
  localNome?: string;
  moeda: 'BRL' | 'USD';
  taxaCambio?: number;
  /** AAAA-MM-DD */
  validaAte: string;
  incluirComposicao: boolean;
  observacoes?: string;
  status: PropostaStatus;
  pricingId?: string;
  valorTotal: number;
  toneladasTotal: number;
  quantidadeItens: number;
  createdAt: string;
  itens?: PropostaItem[];
  eventos?: PropostaEvento[];
  resposta?: PropostaResposta | null;
  linkAbertoEm?: string;
}

/** Dados para criar uma proposta (a fotografia dos preços daquele momento). */
export interface NovaProposta {
  clientId?: string;
  clienteNome: string;
  clienteDocumento?: string;
  clienteDados: PropostaClienteDados;
  regionId?: string;
  priceListId?: string;
  priceListNome?: string;
  localCarregamentoId?: string;
  localNome?: string;
  moeda: 'BRL' | 'USD';
  taxaCambio?: number;
  validaAte: string;
  incluirComposicao: boolean;
  observacoes?: string;
  itens: PropostaItem[];
}
