import React from 'react';

export type NutrientType = 'macro' | 'micro' | 'finished';

export interface FinishedProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  price?: number;
  minQuantity?: number;
}

export interface UnifiedProduct {
  id: string;
  name: string;
  code: string;
  type: NutrientType;
  minQuantity: number;
  categories: string[];

  // Specific fields mapped from macro/micro/finished
  n?: number;
  p?: number;
  k?: number;
  s?: number;
  ca?: number;
  microGuarantees?: MicroGuarantee[];
  brandId?: string;
  formulaSuffix?: string;
  isPremiumLine?: boolean;
  description?: string;
  price?: number;
}

export interface MicroGuarantee {
  name: string;
  value: number;
}

export interface IncompatibilityRule {
  id: string;
  materialAId: string;
  materialBId: string;
  materialAName: string;
  materialBName: string;
}

export interface RawMaterial {
  id: string;
  code?: string;
  type: NutrientType;
  name: string;
  price: number;
  n: number;
  p: number;
  k: number;
  s: number;
  ca: number;
  microGuarantees: MicroGuarantee[];
  minQty: number;
  maxQty: number;
  selected: boolean;
  quantity: number;
  categories?: string[];
  formulaSuffix?: string;
  isPremiumLine?: boolean;
  isFertigranP?: boolean;
  minQuantity?: number;
}

export interface CompatibilityCategory {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  organizationId?: string;
  idNumeric: number;
  email: string;
  name: string;
  nickname: string;
  ativo: boolean;
  role: string;
  managedUserIds?: string[];
  filiais_permitidas?: string[]; // array de UUIDs de branches permitidas
  requer_alteracao_senha?: boolean;
  permissions?: {
    // Módulos (acesso à página)
    dashboard: boolean;
    calculator: boolean;
    history: boolean;
    clients: boolean;
    agents: boolean;
    goals: boolean;
    priceLists: boolean;
    branches: boolean;
    users: boolean;
    accessProfiles?: boolean;
    accessLevels?: boolean;
    settings: boolean;
    approvals: boolean;
    reports: boolean;
    managementReports: boolean;
    savedFormulas?: boolean;
    savedFormulas_delete?: boolean;
    savedFormulas_report?: boolean;
    pricingReport?: boolean;
    commissionReport?: boolean;
    prd?: boolean;
    pricingBySeller?: boolean;
    produtosFormulados?: boolean;
    produtosFormulados_edit?: boolean;
    // Sub-permissões da Calculadora
    calculator_savePricing?: boolean;
    calculator_generatePDF?: boolean;
    calculator_saveFormula?: boolean;
    calculator_fertigranP?: boolean;
    calculator_profitabilityCheck?: boolean;
    // Sub-permissões de Histórico
    history_changeStatus?: boolean;
    history_editPricing?: boolean;
    // Sub-permissões de Aprovações
    approvals_canApprove?: boolean;
    // Sub-permissões CRUD
    clients_create?: boolean;
    clients_edit?: boolean;
    clients_delete?: boolean;
    agents_create?: boolean;
    agents_edit?: boolean;
    agents_delete?: boolean;
    priceLists_create?: boolean;
    priceLists_edit?: boolean;
    priceLists_delete?: boolean;
    branches_create?: boolean;
    branches_edit?: boolean;
    branches_delete?: boolean;
    macro_create?: boolean;
    macro_edit?: boolean;
    macro_delete?: boolean;
    micro_create?: boolean;
    micro_edit?: boolean;
    micro_delete?: boolean;
    macro?: boolean;
    micro?: boolean;
    expenses?: boolean;
    creditCard?: import('./types/expense.types').ExpenseRole;
    // Módulo Carregamento
    carregamento?: boolean;
    carregamento_solicitar_cotacao?: boolean;
    carregamento_liberar?: boolean;
    carregamento_logistica?: boolean;
    carregamento_informar_transportador?: boolean;
    carregamento_relatorios?: boolean;
    carregamento_admin?: boolean;
    carregamento_all_filiais?: boolean;
    carregamento_cancelar?: boolean;
    carregamento_configurar_filiais?: boolean;
    carregamento_tratar_cotacao?: boolean;
    carregamento_aprovar_cotacao?: boolean;
    carregamento_ver_arquivadas?: boolean;
    carregamento_filial_ids?: string[];
  };
}

export interface Unidade {
  id: string;
  id_numeric?: number;
  nome: string;
  ordem_exibicao: number;
  ativo: boolean;
}

export type IndicadorCategoria = string;

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  visivel_capa?: boolean;
}

export interface Indicador {
  id: string;
  nome: string;
  categoria: IndicadorCategoria;
  unidade_medida: string;
  digitavel: boolean;
  ordem?: number;
  formula?: string;
}

export interface Lancamento {
  id: string;
  data: string; // ISO date string
  unidade_id: string;
  indicador_id: string;
  valor: number;
  observacao?: string;
  usuario_id: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface MetaMensal {
  id: string;
  unidade_id: string;
  ano: number;
  mes: number; // 1-12
  indicador_id: string;
  valor_meta: number;
}

export interface ConfiguracaoIndicador {
  unidade_id: string;
  indicador_id: string;
  nome_personalizado: string;
  visivel: boolean;
  cor_fundo?: string;
}

export interface DiasUteisMes {
  unidade_id: string;
  ano: number;
  mes: number;
  total_dias_uteis: number;
}

export const DEFAULT_CATEGORIAS: string[] = [
  'Faturamento',
  'Carregamento',
  'Rentabilidade',
  'Cancelamentos',
  'Entrada de Pedidos',
  'Carteira de Pedidos',
  'Produção',
];

export interface AppSettings {
  companyName: string;
  companyLogo: string; // Base64
  companyCnpj?: string;
  pricingTerms?: string;
}

export interface Address {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface Client {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  document: string; // CPF or CNPJ
  email?: string;
  phone?: string;
  stateRegistration?: string;
  fazenda?: string;
  address?: Address;
  // Endereço de Entrega
  deliveryAddress?: Address;
  deliverySameAsAddress?: boolean;
}

export interface Agent {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  document: string;
  email?: string;
  phone?: string;
  ie?: string;
  address?: Address;
}

export interface PriceList {
  id: string;
  organizationId?: string;
  name: string;
  branchId?: string;
  local_carregamento_id?: string;
  date: string;
  currency?: 'BRL' | 'USD';
  exchangeRate?: number;
  dollarRate?: number; // Para efeito de conhecimento em listas BRL
  macros: RawMaterial[];
  micros: RawMaterial[];
}

export interface Branch {
  id: string;
  organizationId?: string;
  id_numeric?: number;
  name: string;
  ativo?: boolean;
}

export interface Brand {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
}

export interface MacroMaterial {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  n: number;
  p: number;
  k: number;
  s: number;
  ca: number;
  microGuarantees: MicroGuarantee[];
  brandId: string;
  categories?: string[];
  formulaSuffix?: string;
  isPremiumLine?: boolean;
  minQuantity?: number;
}

export interface MicroMaterial {
  id: string;
  organizationId?: string;
  code: string;
  name: string;
  microGuarantees: MicroGuarantee[];
  categories?: string[];
  formulaSuffix?: string;
  minQuantity?: number;
  isPremiumLine?: boolean;
}

export interface ProfitabilityAnalysis {
  pricingRecordId: string;
  calculationIndex: number;
  formulaName: string;
  unitaryPrice: number;
  factor: number;
  baseCost: number;
  baseCostAfterFactor: number;
  freightDeduction: number;
  commissionRate: number;
  commissionDeduction: number;
  interestRate: number;
  interestDeduction: number;
  taxRate: number;
  taxDeduction: number;
  netRevenue: number;
  profitability: number;
  profitabilityPercent: number;
  dueDate?: string;
  exemptCurrentMonth?: boolean;
  daysOfInterest?: number;
  packagingValue?: number;
  packagingDeduction?: number;
  analyzedByUserId: string;
  analyzedByName: string;
  analyzedAt: string;
}

export interface TargetFormula {
  id: string;
  formula: string;
  selected: boolean;
  modo_calculo?: 'formulacao' | 'produtos_livres';
  produtos_livres?: Array<{
    productId: string;
    quantity: number;
  }>;
  category?: 'phosphated' | 'nitrogenous' | 'fertigran_p' | 'all';
  factors: PricingFactors;
  summary?: PricingSummary;
  macros: RawMaterial[];
  micros: RawMaterial[];
  targetN?: number;
  targetP?: number;
  targetK?: number;
  targetCa?: number;
  targetS?: number;
  profitabilityAnalysis?: ProfitabilityAnalysis;
}

export interface SavedFormula {
  id: string;
  organizationId?: string;
  id_numeric?: number;
  userId: string;
  userName: string;
  name: string;
  date: string;
  targetFormula: string;
  macros: RawMaterial[];
  micros: RawMaterial[];
  local_carregamento_id?: string;
  protectedMaterialIds?: string[];
  isRevisionFromSavedFormula?: boolean;
}

export interface PricingFactors {
  targetFormula: string;
  factor: number;
  discount: number;
  margin: number;
  freight: number;
  tipoFrete: 'CIF' | 'FOB';
  cotacaoFreteId?: string;
  cotacaoFreteNumero?: string;
  taxRate: number;
  commission: number;
  monthlyInterestRate: number;
  dueDate: string;
  exemptCurrentMonth: boolean;
  paymentCondition?: 'vencimento' | 'ddf';
  dataCarregamento?: string;
  ddfDias?: number;
  client: Client;
  agent: Agent;
  branchId: string;
  priceListId: string;
  local_carregamento_id?: string;
  totalTons: number;
  commercialObservation?: string;
  embalagem_id?: string;
  embalagem_nome?: string;
  embalagem_valor?: number;
  embalagem_ajuste?: 'nenhum' | 'cobrar' | 'descontar';
}

export interface Embalagem {
  id: string;
  id_numeric: number;
  nome: string;
  cobrar: boolean;
  descontar?: boolean;
  valor_cobrar?: number | null;
  valor_descontar?: number | null;
  desconto?: boolean;
  valor?: number;
  tipo_valor?: 'por_tonelada' | 'fixo';
  ativo: boolean;
  criado_em?: string;
}

export interface PricingSummary {
  totalWeight: number;
  baseCost: number;
  basePrice: number;
  interestValue: number;
  taxValue: number;
  commissionValue: number;
  freightValue: number;
  finalPrice: number;
  totalSaleValue: number;
  resultingN: number;
  resultingP: number;
  resultingK: number;
  resultingS: number;
  resultingCa: number;
  resultingMicros: Record<string, number>;
}

export interface PricingHistoryEntry {
  date: string;
  userId: string;
  userName: string;
  action: string;
}

export interface PricingRecord {
  id: string;
  organizationId?: string;
  cod?: number;
  modo_calculo?: 'formulacao' | 'produtos_livres';
  userId: string;
  userName?: string;
  userCode?: string;
  date: string;
  status: 'Em Andamento' | 'Fechada' | 'Perdida' | 'Excluída';
  approvalStatus: 'Pendente' | 'Aprovada' | 'Reprovada';
  macros: RawMaterial[];
  micros: RawMaterial[];
  factors: PricingFactors;
  summary: PricingSummary;
  calculations?: TargetFormula[];
  history?: PricingHistoryEntry[];
  commercialObservation?: string;
  formattedCod?: string;
  transferToUserId?: string;
  transferToUserName?: string;
  rejectionObservation?: string;
  deletionRequest?: {
    reason: string;
    requestedBy: string; // userId
    userName: string;
    date: string;
    status: 'Pendente' | 'Aprovada' | 'Reprovada';
  };
}

export interface Goal {
  id: string;
  organizationId?: string;
  userId: string;
  userName: string;
  type: 'monthly' | 'annual';
  targetValue: number;
  month?: number; // 1-12
  year: number;
  status: 'Pendente' | 'Aprovada' | 'Reprovada';
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  title: string;
  message: string;
  date: string;
  read: boolean;
  type:
    | 'goal_change'
    | 'pricing_approval'
    | 'goal_approval'
    | 'pricing_transfer'
    | 'pricing_deletion_request';
  dataId?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ForwardRefExoticComponent<any>;
  permission: string;
  type?: 'parent' | 'child';
  badge?: number;
  children?: NavItem[];
}

export interface FertigranPFormula {
  id: string;
  nome: string;
  npk_n: number;
  npk_p: number;
  npk_k: number;
  ca: number;
  s: number;
  materias_primas: string[];
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoVendaItem {
  id?: string;
  organization_id?: string;
  pedido_venda_id?: string;
  produto_nome: string;
  formulacao?: string;
  quantidade_ton: number;
  saldo_disponivel?: number;
  preco_unitario?: number;
  embalagem?: string;
  precificacao_id?: string;
  criado_em?: string;
}

export interface AccessLevel {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  hierarchy_level: number;
  default_permissions: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoVenda {
  id: string;
  organization_id?: string;
  precificacao_id?: string;
  numero_pedido?: string;
  barra_pedido?: string;
  data_pedido?: string; // Vencimento
  quantidade_real?: number;
  embalagem?: string; // Sacaria
  valor_unitario_negociado?: number;
  valor_total_negociado?: number;
  tipo_frete?: string; // CIF ou FOB
  valor_frete?: number; // valor do frete quando CIF
  status: 'pendente' | 'em_carregamento' | 'concluido' | 'cancelado';
  status_pedido?: string; // 'ativo' | 'cancelado' — campo banco
  pdf_url?: string;
  dados_extraidos?: Record<string, any>;
  importado_por?: string;
  criado_em?: string;
  atualizado_em?: string;
  // Extended fields
  cliente_id?: string;
  cliente_nome?: string;
  produto_nome?: string;
  quantidade_carregada?: number;
  quantidade_original?: number;
  quantidade_desmembrada?: number;
  quantidade_cancelada_definitiva?: number;
  saldo_disponivel?: number;
  preco_unitario?: number;
  condicao_pagamento?: string;
  observacoes?: string;
  filial_id?: string;
  formulacao_alterada?: boolean;
  pedido_pai_id?: string;
  data_vencimento?: string;
  emitente?: number;
  itens?: PedidoVendaItem[];
  // Joined fields
  precificacao?: PricingRecord;
}

export interface CancelamentoPedido {
  id: string;
  organization_id?: string;
  pedido_origem_id: string;
  pedido_destino_id?: string;
  tipo: 'canc_substitui' | 'definitivo';
  quantidade: number;
  motivo?: string;
  usuario_id?: string;
  usuario_nome?: string;
  criado_em: string;
  // Joined
  pedido_origem?: Partial<PedidoVenda>;
  pedido_destino?: Partial<PedidoVenda>;
}

export interface ComparisonHistory {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  formula_original: string;
  formula_nova: string;
  hectares: number;
  dose_original: number;
  dose_nova: number;
  reducoes_aplicadas: {
    n: number;
    p: number;
    k: number;
    fatores_comerciais?: Record<string, unknown>;
    incluir_pdf?: boolean;
    composicao?: Array<{ material: string; qtd: number }>;
    garantias_finais?: Record<string, unknown>;
  };
  created_at?: string;
}
