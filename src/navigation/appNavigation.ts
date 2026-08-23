import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  FileEdit,
  History as HistoryIcon,
  LayoutDashboard,
  List,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  Tag,
  Target,
  Truck,
  UserCheck,
  Users,
  Calculator as CalcIcon,
} from 'lucide-react';
import type { NavItem, User } from '../types';

export type ActiveModule =
  | 'pricing'
  | 'config'
  | 'prd'
  | 'managementReports'
  | 'expenses'
  | 'carregamento'
  | 'relatorios'
  | null;

const moduleByRoute: Record<string, Exclude<ActiveModule, null>> = {};

const registerRoutes = (module: Exclude<ActiveModule, null>, routes: string[]) => {
  routes.forEach((route) => {
    moduleByRoute[route] = module;
  });
};

registerRoutes('pricing', [
  'dashboard',
  'calculator',
  'simplified_calculator',
  'saved_formulas',
  'produtos_formulados',
  'history',
  'goals',
  'approvals',
  'reports',
  'pricingReport',
  'commissionReport',
  'pricingBySeller',
  'pricelists',
  'materials_macro',
  'materials_micro',
  'materials_brand',
  'products',
  'incompatibilities',
  'clients',
  'agents',
  'pedidos_venda',
]);
registerRoutes('config', [
  'branches',
  'settings',
  'users',
  'access_profiles',
  'access_levels',
  'alert_center',
]);
registerRoutes('prd', ['prd']);
registerRoutes('managementReports', [
  'managementReports_dashboard',
  'managementReports_lancamentos',
  'managementReports_cadastros',
]);
registerRoutes('expenses', [
  'expenses',
  'expenses_lancamentos',
  'expenses_novo',
  'expenses_relatorios',
  'expenses_conferencia',
  'expenses_aprovacao',
  'expenses_categorias',
  'expenses_cartoes',
]);
registerRoutes('carregamento', [
  'carregamento_visao_geral',
  'carregamento_solicitacao',
  'carregamento_liberacao',
  'carregamento_logistica',
  'carregamento_calendario',
  'carregamento_relatorios',
  'carregamento_transportadoras',
]);
registerRoutes('relatorios', ['relatorios']);

export const getActiveModule = (activeTab: string): ActiveModule => moduleByRoute[activeTab] ?? null;

export const hasUserPermission = (user: User, permission: string): boolean => {
  if (user.role === 'master' || user.role === 'admin') return true;
  const permissions = user.permissions as Partial<Record<string, unknown>> | undefined;
  return Boolean(permissions?.[permission]);
};

interface NavigationBadgeCounts {
  pendingExpenses?: number;
  checkedExpenses?: number;
}

export function getNavigationItems(
  activeModule: ActiveModule,
  hasPermission: (permission: string) => boolean,
  badges: NavigationBadgeCounts = {}
): NavItem[] {
  let items: NavItem[] = [];

  if (activeModule === 'pricing') {
    items = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3, permission: 'dashboard' },
      { id: 'calculator', label: 'Calculadora', icon: CalcIcon, permission: 'calculator' },
      {
        id: 'simplified_calculator',
        label: 'Calculadora Simplificada',
        icon: CalcIcon,
        permission: 'calculator',
      },
      { id: 'saved_formulas', label: 'Batidas Salvas', icon: Beaker, permission: 'calculator' },
      {
        id: 'produtos_formulados',
        label: 'Produtos Formulados',
        icon: Package,
        permission: 'produtosFormulados',
      },
      {
        id: 'materials_group',
        label: 'Cadastro de Matérias',
        icon: Database,
        permission: 'priceLists',
        type: 'parent',
        children: [
          { id: 'products', label: 'Produtos', icon: Package, permission: 'priceLists' },
          { id: 'materials_brand', label: 'Marcas', icon: Tag, permission: 'priceLists' },
          {
            id: 'incompatibilities',
            label: 'Incompatibilidades',
            icon: AlertTriangle,
            permission: 'priceLists',
          },
        ],
      },
      { id: 'pricelists', label: 'Lista de Preço', icon: Database, permission: 'priceLists' },
      { id: 'history', label: 'Precificações', icon: HistoryIcon, permission: 'history' },
      {
        id: 'pedidos_venda',
        label: 'Pedidos de Venda',
        icon: ClipboardList,
        permission: 'history',
      },
      { id: 'approvals', label: 'Aprovações', icon: ShieldCheck, permission: 'approvals' },
      { id: 'goals', label: 'Metas', icon: Target, permission: 'goals' },
      {
        id: 'reports',
        label: 'Relatórios',
        icon: BarChart3,
        permission: 'reports',
        type: 'parent',
        children: [
          {
            id: 'pricingReport',
            label: 'Relatório de Precificação',
            icon: BarChart3,
            permission: 'reports',
          },
          {
            id: 'commissionReport',
            label: 'Relatório de Comissão',
            icon: BarChart3,
            permission: 'reports',
          },
          {
            id: 'pricingBySeller',
            label: 'Precificação por Vendedor',
            icon: BarChart3,
            permission: 'pricingBySeller',
          },
        ],
      },
      { id: 'clients', label: 'Clientes', icon: Users, permission: 'clients' },
      { id: 'agents', label: 'Agentes', icon: UserCheck, permission: 'agents' },
    ];
  } else if (activeModule === 'config') {
    items = [
      { id: 'users', label: 'Usuários', icon: Users, permission: 'users' },
      {
        id: 'access_profiles',
        label: 'Perfis de Acesso',
        icon: ShieldCheck,
        permission: 'accessProfiles',
      },
      {
        id: 'access_levels',
        label: 'Níveis de Acesso',
        icon: ShieldCheck,
        permission: 'accessProfiles',
      },
      { id: 'branches', label: 'Filiais e Locais', icon: Building2, permission: 'branches' },
      { id: 'settings', label: 'Personalização', icon: Settings, permission: 'settings' },
      { id: 'alert_center', label: 'Central de Alertas', icon: Bell, permission: 'alertas' },
    ];
  } else if (activeModule === 'prd') {
    items = [{ id: 'prd', label: 'Documentação PRD', icon: BarChart3, permission: 'prd' }];
  } else if (activeModule === 'managementReports') {
    items = [
      {
        id: 'managementReports_group',
        label: 'RELATÓRIO DIÁRIO',
        icon: BarChart3,
        permission: 'managementReports',
        type: 'parent',
        children: [
          {
            id: 'managementReports_dashboard',
            label: 'Capa / Relatório',
            icon: LayoutDashboard,
            permission: 'managementReports',
          },
          {
            id: 'managementReports_lancamentos',
            label: 'Lançamentos',
            icon: FileEdit,
            permission: 'managementReports',
          },
          {
            id: 'managementReports_cadastros',
            label: 'Configurações',
            icon: Settings,
            permission: 'managementReports',
          },
        ],
      },
    ];
  } else if (activeModule === 'expenses') {
    items = [
      {
        id: 'expenses_lancamentos_group',
        label: 'Lançamentos',
        icon: CreditCard,
        permission: 'expenses',
        type: 'parent',
        children: [
          { id: 'expenses_lancamentos', label: 'Gastos', icon: List, permission: 'expenses' },
          { id: 'expenses_novo', label: 'Novo Gasto', icon: Plus, permission: 'expenses' },
          {
            id: 'expenses_relatorios',
            label: 'Relatórios',
            icon: BarChart3,
            permission: 'expenses',
          },
        ],
      },
      {
        id: 'expenses_workflow_group',
        label: 'Workflow',
        icon: ClipboardCheck,
        permission: 'expenses',
        type: 'parent',
        children: [
          {
            id: 'expenses_conferencia',
            label: 'Conferência',
            icon: ClipboardCheck,
            permission: 'expenses',
            badge: badges.pendingExpenses ?? 0,
          },
          {
            id: 'expenses_aprovacao',
            label: 'Aprovação',
            icon: CheckCircle2,
            permission: 'expenses',
            badge: badges.checkedExpenses ?? 0,
          },
        ],
      },
      {
        id: 'expenses_config_group',
        label: 'Configurações',
        icon: Settings,
        permission: 'expenses',
        type: 'parent',
        children: [
          { id: 'expenses_categorias', label: 'Categorias', icon: Tag, permission: 'expenses' },
          { id: 'expenses_cartoes', label: 'Cartões', icon: CreditCard, permission: 'expenses' },
        ],
      },
    ];
  } else if (activeModule === 'carregamento') {
    items = [
      {
        id: 'carregamento_group',
        label: 'Carregamento',
        icon: Truck,
        permission: 'carregamento',
        type: 'parent',
        children: [
          {
            id: 'carregamento_visao_geral',
            label: 'Visão Geral',
            icon: LayoutDashboard,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_solicitacao',
            label: 'Solicitação de Cotação',
            icon: ClipboardList,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_liberacao',
            label: 'Liberação de Carregamento',
            icon: CheckCircle2,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_logistica',
            label: 'Painel de Logística',
            icon: Truck,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_calendario',
            label: 'Calendário',
            icon: Calendar,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_relatorios',
            label: 'Relatórios',
            icon: BarChart3,
            permission: 'carregamento',
          },
          {
            id: 'carregamento_transportadoras',
            label: 'Transportadoras',
            icon: Truck,
            permission: 'carregamento',
          },
        ],
      },
    ];
  } else if (activeModule === 'relatorios') {
    return [{ id: 'relatorios', label: '📊 Relatórios', icon: BarChart3, permission: 'relatorios' }];
  }

  return items.filter((item) => hasPermission(item.permission));
}
