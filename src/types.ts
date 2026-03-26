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
  email: string;
  name: string;
  customCode: string;
  password?: string;
  role: 'admin' | 'user' | 'manager' | 'master';
  managedUserIds?: string[];
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
    settings: boolean;
    approvals: boolean;
    reports: boolean;
    managementReports: boolean;
    savedFormulas?: boolean;
    pricingReport?: boolean;
    commissionReport?: boolean;
    prd?: boolean;
    pricingBySeller?: boolean;
    // Sub-permissões da Calculadora
    calculator_savePricing?: boolean;
    calculator_generatePDF?: boolean;
    calculator_saveFormula?: boolean;
    calculator_fertigranP?: boolean;
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
  };
}

export interface Unidade {
  id: string;
  nome: string;
  ordem_exibicao: number;
  ativo: boolean;
}

export type IndicadorCategoria = string;

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  visivel_capa?: boolean; // true = aparece na capa (default), false = oculta da capa
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
}

export interface DiasUteisMes {
  unidade_id: string;
  ano: number;
  mes: number;
  total_dias_uteis: number;
}

export const DEFAULT_CATEGORIAS: string[] = ['Faturamento', 'Carregamento', 'Rentabilidade', 'Cancelamentos', 'Entrada de Pedidos', 'Carteira de Pedidos', 'Produção'];

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
  code: string;
  name: string;
  document: string; // CPF or CNPJ
  email?: string;
  phone?: string;
  stateRegistration?: string;
  fazenda?: string;
  address?: Address;
}

export interface Agent {
  id: string;
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
  name: string;
  branchId: string;
  date: string;
  currency?: 'BRL' | 'USD';
  exchangeRate?: number;
  dollarRate?: number; // Para efeito de conhecimento em listas BRL
  macros: RawMaterial[];
  micros: RawMaterial[];
}

export interface Branch {
  id: string;
  name: string;
}

export interface Brand {
  id: string;
  code: string;
  name: string;
}

export interface MacroMaterial {
  id: string;
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
  code: string;
  name: string;
  microGuarantees: MicroGuarantee[];
  categories?: string[];
  formulaSuffix?: string;
  minQuantity?: number;
}

export interface TargetFormula {
  id: string;
  formula: string;
  selected: boolean;
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
}

export interface SavedFormula {
  id: string;
  userId: string;
  userName: string;
  name: string;
  date: string;
  targetFormula: string;
  macros: RawMaterial[];
  micros: RawMaterial[];
}

export interface PricingFactors {
  targetFormula: string;
  factor: number;
  discount: number;
  margin: number;
  freight: number;
  taxRate: number;
  commission: number;
  monthlyInterestRate: number;
  dueDate: string;
  exemptCurrentMonth: boolean;
  client: Client;
  agent: Agent;
  branchId: string;
  priceListId: string;
  totalTons: number;
  commercialObservation?: string;
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
  cod?: number;
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
  type: 'goal_change' | 'pricing_approval' | 'goal_approval' | 'pricing_transfer' | 'pricing_deletion_request';
  dataId?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ForwardRefExoticComponent<any>;
  permission: string;
  type?: 'parent' | 'child';
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
    fatores_comerciais?: any;
    incluir_pdf?: boolean;
    composicao?: any;
    garantias_finais?: any;
  };
  created_at?: string;
}
