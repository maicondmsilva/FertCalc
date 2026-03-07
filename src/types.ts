import React from 'react';

export type NutrientType = 'macro' | 'micro' | 'finished';

export interface FinishedProduct {
  id: string;
  code: string;
  name: string;
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
  categories?: ('phosphated' | 'nitrogenous' | 'fertigran_p')[];
  formulaSuffix?: string;
  isPremiumLine?: boolean;
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
}

export interface Indicador {
  id: string;
  nome: string;
  categoria: IndicadorCategoria;
  unidade_medida: string;
  digitavel: boolean;
  ordem?: number;
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
  categories?: ('phosphated' | 'nitrogenous' | 'fertigran_p')[];
  formulaSuffix?: string;
  isPremiumLine?: boolean;
}

export interface MicroMaterial {
  id: string;
  code: string;
  name: string;
  microGuarantees: MicroGuarantee[];
  categories?: ('phosphated' | 'nitrogenous' | 'fertigran_p')[];
  formulaSuffix?: string;
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
