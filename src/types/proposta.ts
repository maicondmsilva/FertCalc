export type PropostaStatus = 'vigente' | 'aceita' | 'recusada' | 'convertida' | 'cancelada';
/** Situação exibida: "vencida" é uma proposta vigente que passou da validade. */
export type PropostaSituacao = PropostaStatus | 'vencida';

export interface PropostaComposicaoItem {
  nome: string;
  kg: number;
  tipo?: 'Macro' | 'Micro';
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
