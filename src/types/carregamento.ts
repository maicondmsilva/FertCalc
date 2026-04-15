// ─────────────────────────────────────────────────────────────
//  Carregamento module — type definitions
// ─────────────────────────────────────────────────────────────

export type TipoFrete = 'CIF' | 'FOB';

export type StatusCarregamento =
  | 'aguardando_cotacao'
  | 'cotacao_solicitada'
  | 'cotacao_recebida'
  | 'aguardando_liberacao'
  | 'liberado_parcial'
  | 'liberado_total'
  | 'em_carregamento'
  | 'carregado'
  | 'cancelado';

export type TipoLiberacao = 'total' | 'parcial';

export type StatusCotacao = 'pendente' | 'aprovada' | 'reprovada' | 'expirada';

// ── Filial ────────────────────────────────────────────────────
export interface Filial {
  id: string;
  nome: string;
  codigo: string;
  cidade?: string;
  estado?: string;
  ativo: boolean;
  criado_em?: string;
}

// ── Transportadora ────────────────────────────────────────────
export interface Transportadora {
  id: string;
  id_numeric?: number;
  nome: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  ativo: boolean;
  criado_em?: string;
}

// ── Carregamento ──────────────────────────────────────────────
export interface Carregamento {
  id: string;
  pedido_precificacao_id?: string;
  numero_carregamento: string;
  numero?: number;
  filial_id?: string;
  filial?: Filial;
  tipo_frete: TipoFrete;
  status: StatusCarregamento;
  tipo_liberacao?: TipoLiberacao;
  quantidade_total: number;
  quantidade_liberada: number;
  quantidade_carregada: number;
  saldo_disponivel?: number;
  data_prevista_carregamento?: string;
  data_real_carregamento?: string;
  data_solicitacao_cotacao?: string;
  data_liberacao?: string;
  transportadora_id?: string;
  transportadora?: Transportadora;
  valor_frete?: number;
  valor_frete_unitario?: number;
  observacoes?: string;
  obs_logistica?: string;
  liberado_por?: string;
  criado_por?: string;
  criado_em: string;
  atualizado_em: string;
  // joined fields
  cliente_nome?: string;
  vendedor_nome?: string;
  local_carregamento_id?: string;
  local_carregamento?: LocalCarregamento;
}

// ── Cotação de Frete ──────────────────────────────────────────
export interface CotacaoFrete {
  id: string;
  carregamento_id: string;
  transportadora_id?: string;
  transportadora?: Transportadora;
  valor_cotado?: number;
  prazo_dias?: number;
  validade_cotacao?: string;
  status: StatusCotacao;
  observacoes?: string;
  arquivo_cotacao?: string;
  solicitado_por?: string;
  respondido_por?: string;
  criado_em: string;
  atualizado_em: string;
}

// ── Alerta de Carregamento ────────────────────────────────────
export interface AlertaCarregamento {
  id: string;
  carregamento_id: string;
  tipo: string;
  mensagem: string;
  lido: boolean;
  destinatario_id?: string;
  criado_em: string;
}

// ── Histórico de Status ───────────────────────────────────────
export interface HistoricoCarregamento {
  id: string;
  carregamento_id: string;
  status_anterior?: string;
  status_novo?: string;
  descricao?: string;
  alterado_por?: string;
  criado_em: string;
}

// ── Filtros de Relatório ──────────────────────────────────────
export interface FiltrosRelatorioCarregamento {
  filial_id?: string;
  tipo_frete?: TipoFrete | '';
  status?: StatusCarregamento | '';
  transportadora_id?: string;
  local_carregamento_id?: string;
  data_inicio?: string;
  data_fim?: string;
}

// ── KPIs ──────────────────────────────────────────────────────
export interface KPICarregamento {
  aguardando_cotacao: number;
  em_carregamento: number;
  carregados_hoje: number;
  valor_frete_mes: number;
}

// ── Local de Carregamento ─────────────────────────────────────
export interface LocalCarregamento {
  id: string;
  id_numeric: number;
  nome: string;
  filial_id?: string;
  filial?: Filial;
  endereco?: string;
  cidade?: string;
  estado?: string;
  maps_url?: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

// ── Cotação Solicitada (independente) ─────────────────────────
export type StatusCotacaoSolicitada =
  | 'aguardando'
  | 'em_analise'
  | 'cotado'
  | 'aprovado'
  | 'cancelado';

export interface CotacaoSolicitada {
  id: string;
  numero_cotacao: string;
  solicitado_por?: string;
  solicitante_nome?: string;
  cliente_id?: string;
  cliente_nome?: string;
  filial_id?: string;
  filial?: Filial;
  local_carregamento_id?: string;
  local_carregamento?: LocalCarregamento;
  endereco_entrega?: string;
  fazenda?: string;
  maps_url?: string;
  pedido_venda_id?: string;
  produto?: string;
  quantidade_ton?: number;
  observacoes?: string;
  status: StatusCotacaoSolicitada;
  responsavel_id?: string;
  transportadora_id?: string;
  transportadora?: Transportadora;
  transportadora_nome?: string;
  valor_frete?: number;
  valor_frete_unitario?: number;
  prazo_entrega_dias?: number;
  obs_responsavel?: string;
  cotado_em?: string;
  aprovado_em?: string;
  precificacao_id?: string;
  criado_em: string;
  atualizado_em: string;
}
