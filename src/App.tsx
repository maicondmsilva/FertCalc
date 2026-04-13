/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Calculator from './components/Calculator';
import History from './components/History';
import PriceListManager from './components/PriceListManager';
import ClientManager from './components/ClientManager';
import AgentManager from './components/AgentManager';
import BranchManager from './components/BranchManager';
import SettingsManager from './components/SettingsManager';
import UserManager from './components/UserManager';
import Goals from './components/Goals';
import Reports from './components/Reports';
import PricingReport from './components/PricingReport';
import CommissionReport from './components/CommissionReport';
import PricingBySeller from './components/PricingBySeller';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import SavedFormulas from './components/SavedFormulas';
import AccessProfileManager from './components/AccessProfileManager';
import {
  LayoutDashboard,
  History as HistoryIcon,
  Database,
  Users,
  UserCheck,
  Building2,
  Settings,
  LogOut,
  Leaf,
  ShieldCheck,
  Menu,
  X,
  Target,
  Bell,
  Download,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  BarChart3,
  ChevronDown,
  FileEdit,
  Tag,
  Package,
  AlertTriangle,
  Calculator as CalcIcon,
  Beaker,
  CreditCard,
  List,
  Plus,
  ClipboardCheck,
  CheckCircle2,
  Truck,
  Calendar,
  ClipboardList,
} from 'lucide-react';
import { PricingRecord, User, AppSettings, NavItem, SavedFormula } from './types';
import { getAppSettings, markNotificationsAsRead } from './services/db';
import { signOut, restoreSession } from './services/authService';
import { logger } from './utils/logger';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useToast } from './components/Toast';

import Approvals from './components/Approvals';
import PrdModule from './components/PrdModule';
import ManagementReportsModule from './components/ManagementReportsModule';

import BrandManager from './components/BrandManager';
import ProductManager from './components/ProductManager';
import IncompatibilityManager from './components/IncompatibilityManager';

import ExpenseDashboard from './components/ExpenseManagement/ExpenseDashboard';
import CheckExpenses from './components/ExpenseManagement/CheckExpenses';
import ApproveExpenses from './components/ExpenseManagement/ApproveExpenses';
import CardManager from './components/ExpenseManagement/CardManager';
import ExpenseCategoryManager from './components/ExpenseManagement/ExpenseCategoryManager';

import CarregamentoModule from './components/Carregamento';
import PedidosVenda from './components/PedidosVenda';

import { getPendingCount, getCheckedCount } from './services/expenseService';

import { useNotifications } from './hooks/useNotifications';
import { NotificationBell } from './components/notifications/NotificationBell';
import { useInactivityTimer } from './hooks/useInactivityTimer';
import { usePWAInstall } from './hooks/usePWAInstall';
import { NotificationPanel } from './components/notifications/NotificationPanel';
import { NotificationCard } from './components/notifications/NotificationCard';
import { AnimatePresence } from 'framer-motion';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isStandalone = useMemo(() => searchParams.get('standalone') === 'true', [searchParams]);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || '';

  let activeModule:
    | 'pricing'
    | 'config'
    | 'prd'
    | 'managementReports'
    | 'expenses'
    | 'carregamento'
    | null = null;
  if (
    [
      'dashboard',
      'calculator',
      'simplified_calculator',
      'saved_formulas',
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
    ].includes(activeTab)
  ) {
    activeModule = 'pricing';
  } else if (['branches', 'settings', 'users', 'access_profiles'].includes(activeTab)) {
    activeModule = 'config';
  } else if (activeTab === 'prd') {
    activeModule = 'prd';
  } else if (
    [
      'managementReports_dashboard',
      'managementReports_lancamentos',
      'managementReports_cadastros',
    ].includes(activeTab)
  ) {
    activeModule = 'managementReports';
  } else if (
    activeTab === 'expenses' ||
    activeTab === 'expenses_lancamentos' ||
    activeTab === 'expenses_novo' ||
    activeTab === 'expenses_relatorios' ||
    activeTab === 'expenses_conferencia' ||
    activeTab === 'expenses_aprovacao' ||
    activeTab === 'expenses_categorias' ||
    activeTab === 'expenses_cartoes'
  ) {
    activeModule = 'expenses';
  } else if (
    activeTab === 'carregamento_visao_geral' ||
    activeTab === 'carregamento_solicitacao' ||
    activeTab === 'carregamento_liberacao' ||
    activeTab === 'carregamento_logistica' ||
    activeTab === 'carregamento_calendario' ||
    activeTab === 'carregamento_relatorios'
  ) {
    activeModule = 'carregamento';
  }

  const { showInfo } = useToast();
  const [editingPricing, setEditingPricing] = useState<PricingRecord | null>(null);
  const [initialFormulaContext, setInitialFormulaContext] = useState<{
    formula: SavedFormula | null;
    branchId: string;
    priceListId: string;
  }>({ formula: null, branchId: '', priceListId: '' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Custom Hook replaces local state and intervals
  const {
    notifications,
    unreadCount,
    activeToasts,
    removeToast,
    markAsRead,
    markAllRead,
    clearAll,
  } = useNotifications(currentUser?.id || '');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);
  const [isExpenseLancamentosExpanded, setIsExpenseLancamentosExpanded] = useState(true);
  const [isExpenseWorkflowExpanded, setIsExpenseWorkflowExpanded] = useState(false);
  const [isExpenseConfigExpanded, setIsExpenseConfigExpanded] = useState(false);
  const [isCarregamentoExpanded, setIsCarregamentoExpanded] = useState(true);
  const [pendingExpenseCount, setPendingExpenseCount] = useState(0);
  const [checkedExpenseCount, setCheckedExpenseCount] = useState(0);

  useEffect(() => {
    // Restaura sessão via Supabase Auth (seguro — não usa localStorage manual)
    restoreSession().then((user) => {
      if (user) setCurrentUser(user);
    });

    getAppSettings().then((savedSettings) => {
      if (savedSettings?.companyName) {
        setAppSettings(savedSettings);
      }
    });
  }, []);

  // ── PWA install prompt (extraído para usePWAInstall) ─────────────────────
  const { canInstall, handleInstall } = usePWAInstall();

  // ── Logout (definido antes de useInactivityTimer para evitar referência circular) ──
  const handleLogout = React.useCallback(() => {
    setCurrentUser(null);
    signOut();
    navigate('/');
  }, [navigate]);

  // ── Inatividade → logout automático (extraído para useInactivityTimer) ───
  useInactivityTimer(!!currentUser, handleLogout);

  // Sincronizar logout entre abas + fechar menus ao clicar fora
  useEffect(() => {
    if (!currentUser) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes('supabase') && !e.newValue) {
        setCurrentUser(null);
        navigate('/');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('aside') && !target.closest('.notification-trigger')) {
        setIsMaterialsExpanded(false);
        setIsReportsExpanded(false);
        setIsNotificationsOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentUser, navigate]);

  // Load expense badge counts when entering the expenses module
  useEffect(() => {
    if (activeModule !== 'expenses' || !currentUser) return;
    const load = async () => {
      const [p, c] = await Promise.all([getPendingCount(), getCheckedCount()]);
      setPendingExpenseCount(p);
      setCheckedExpenseCount(c);
    };
    load();
  }, [activeModule, currentUser]);

  // handleInstall e canInstall agora vêm do hook usePWAInstall (acima)

  const handleLogin = React.useCallback(
    (user: User) => {
      setCurrentUser(user);
      navigate('/');
      // Sessão gerenciada pelo Supabase Auth — não persiste dados sensíveis no localStorage
    },
    [navigate]
  );

  // handleLogout definido acima (junto ao useInactivityTimer)

  const handleEditPricing = React.useCallback(
    (pricing: PricingRecord) => {
      setEditingPricing(pricing);
      navigate('/calculator');
    },
    [navigate]
  );

  const handleClearEditing = React.useCallback(() => {
    setEditingPricing(null);
  }, []);

  // Rota de redefinição de senha (acessível sem autenticação)
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  /**
   * Verifica se o usuário logado tem permissão para acessar um recurso.
   * master/admin sempre têm acesso; para outros roles, consulta permissions.
   */
  const hasPermission = (permission: string): boolean => {
    if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
    return !!(currentUser.permissions as any)?.[permission];
  };

  const getNavItems = () => {
    if (!activeModule) return [];

    if (activeModule === 'pricing') {
      const allItems = [
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

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'config') {
      const allItems = [
        { id: 'users', label: 'Usuários', icon: Users, permission: 'users' },
        {
          id: 'access_profiles',
          label: 'Perfis de Acesso',
          icon: ShieldCheck,
          permission: 'users',
        },
        { id: 'branches', label: 'Filiais', icon: Building2, permission: 'branches' },
        { id: 'settings', label: 'Personalização', icon: Settings, permission: 'settings' },
      ];

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'prd') {
      const allItems = [
        { id: 'prd', label: 'Documentação PRD', icon: BarChart3, permission: 'prd' }, // Using BarChart3 as a placeholder icon
      ];

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'managementReports') {
      const allItems = [
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

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'expenses') {
      const allItems = [
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
              badge: pendingExpenseCount,
            },
            {
              id: 'expenses_aprovacao',
              label: 'Aprovação',
              icon: CheckCircle2,
              permission: 'expenses',
              badge: checkedExpenseCount,
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

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'carregamento') {
      const allItems = [
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
          ],
        },
      ];

      return allItems.filter((item) => hasPermission(item.permission));
    }

    return [];
  };

  const navItems: NavItem[] = getNavItems();

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans text-stone-900">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-stone-200 flex flex-col transition-all duration-300 z-50
          ${isSidebarExpanded ? 'w-64' : 'w-20'} 
          ${isMobileMenuOpen ? 'fixed inset-y-0 left-0' : 'hidden md:flex relative'}
          ${!activeModule || isStandalone ? 'hidden' : ''}
        `}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between border-b border-stone-200 px-4">
          <div className="flex items-center overflow-hidden">
            {appSettings.companyLogo ? (
              <img src={appSettings.companyLogo} alt="Logo" className="h-8 w-auto flex-shrink-0" />
            ) : (
              <Leaf className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            )}
            {isSidebarExpanded && (
              <span className="ml-2 text-lg font-bold text-emerald-700 truncate whitespace-nowrap">
                {appSettings.companyName}
              </span>
            )}
          </div>
          {/* Mobile Close Button */}
          <button
            className="md:hidden text-stone-400 hover:text-stone-600"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Back to Home Button */}
        <div className="p-2 border-b border-stone-100">
          <Link
            to="/"
            className={`w-full flex items-center px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors`}
            title={!isSidebarExpanded ? 'Voltar ao Início' : undefined}
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0 text-stone-400" />
            {isSidebarExpanded && (
              <span className="ml-3 font-bold text-xs uppercase tracking-widest">Início</span>
            )}
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <div className="px-3 mb-2">
            {isSidebarExpanded && (
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                {activeModule === 'pricing'
                  ? 'Precificação'
                  : activeModule === 'expenses'
                    ? 'Cartão Corporativo'
                    : activeModule === 'carregamento'
                      ? 'Carregamento'
                      : 'Configuração'}
              </p>
            )}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            const getGroupExpanded = (id: string) => {
              if (id === 'materials_group') return isMaterialsExpanded;
              if (id === 'reports') return isReportsExpanded;
              if (id === 'managementReports_group') return isReportsExpanded;
              if (id === 'expenses_lancamentos_group') return isExpenseLancamentosExpanded;
              if (id === 'expenses_workflow_group') return isExpenseWorkflowExpanded;
              if (id === 'expenses_config_group') return isExpenseConfigExpanded;
              if (id === 'carregamento_group') return isCarregamentoExpanded;
              return false;
            };

            const toggleGroup = (id: string) => {
              if (id === 'materials_group') setIsMaterialsExpanded((p) => !p);
              else if (id === 'reports' || id === 'managementReports_group')
                setIsReportsExpanded((p) => !p);
              else if (id === 'expenses_lancamentos_group')
                setIsExpenseLancamentosExpanded((p) => !p);
              else if (id === 'expenses_workflow_group') setIsExpenseWorkflowExpanded((p) => !p);
              else if (id === 'expenses_config_group') setIsExpenseConfigExpanded((p) => !p);
              else if (id === 'carregamento_group') setIsCarregamentoExpanded((p) => !p);
            };

            const isExpanded = getGroupExpanded(item.id);
            const isExpenseGroup = item.id.startsWith('expenses_');
            const isCarregamentoGroup = item.id.startsWith('carregamento_');

            if (item.type === 'parent') {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleGroup(item.id)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isExpanded ? (isExpenseGroup ? 'bg-purple-50 text-purple-700 font-medium' : isCarregamentoGroup ? 'bg-amber-50 text-amber-700 font-medium' : 'bg-emerald-50 text-emerald-700 font-medium') : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    title={!isSidebarExpanded ? item.label : undefined}
                  >
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 ${isExpanded || isActive ? (isExpenseGroup ? 'text-purple-600' : isCarregamentoGroup ? 'text-amber-600' : 'text-emerald-600') : 'text-stone-400'}`}
                    />
                    {isSidebarExpanded && <span className="ml-3 truncate">{item.label}</span>}
                    {isSidebarExpanded && (
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                  {isExpanded && isSidebarExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children
                        ?.filter((child) => hasPermission(child.permission))
                        .map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = activeTab === child.id;
                          return (
                            <Link
                              key={child.id}
                              to={`/${child.id}?standalone=true`}
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey) {
                                  e.preventDefault();
                                  setInitialFormulaContext({
                                    formula: null,
                                    branchId: '',
                                    priceListId: '',
                                  });
                                  setIsMobileMenuOpen(false);
                                  navigate(`/${child.id}`);
                                }
                              }}
                              className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isChildActive ? (isExpenseGroup ? 'bg-purple-50 text-purple-700 font-medium' : isCarregamentoGroup ? 'bg-amber-50 text-amber-700 font-medium' : 'bg-emerald-50 text-emerald-700 font-medium') : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                              title={!isSidebarExpanded ? child.label : undefined}
                            >
                              <ChildIcon
                                className={`w-5 h-5 flex-shrink-0 ${isChildActive ? (isExpenseGroup ? 'text-purple-600' : isCarregamentoGroup ? 'text-amber-600' : 'text-emerald-600') : 'text-stone-400'}`}
                              />
                              {isSidebarExpanded && (
                                <span className="ml-3 truncate flex-1">{child.label}</span>
                              )}
                              {isSidebarExpanded && (child as any).badge > 0 && (
                                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {(child as any).badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <Link
                  key={item.id}
                  to={`/${item.id}?standalone=true`}
                  onClick={(e) => {
                    if (!e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      if (item.id !== 'calculator' && item.id !== 'simplified_calculator') {
                        setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
                      }
                      setIsMobileMenuOpen(false);
                      navigate(`/${item.id}`);
                    }
                  }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-stone-400'}`}
                  />
                  {isSidebarExpanded && <span className="ml-3 truncate">{item.label}</span>}
                </Link>
              );
            }
          })}
        </nav>

        {/* User Area */}
        <div className="p-4 border-t border-stone-200">
          <div
            className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}
          >
            {isSidebarExpanded && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-stone-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-stone-500 truncate">@{currentUser.nickname}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {!isStandalone && (
          <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center">
              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden mr-4 text-stone-500 hover:text-stone-700"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
              </button>

              {/* Desktop Sidebar Toggle */}
              <button
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                aria-label={isSidebarExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              >
                {isSidebarExpanded ? (
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-4">
              {canInstall && (
                <button
                  onClick={handleInstall}
                  className="hidden sm:flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Instalar App
                </button>
              )}

              <div className="relative notification-trigger">
                <NotificationBell
                  unreadCount={unreadCount}
                  onBellClick={() => {
                    const nextState = !isNotificationsOpen;
                    setIsNotificationsOpen(nextState);
                    if (nextState) {
                      markAllRead();
                    }
                  }}
                />

                <NotificationPanel
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={(id) => markAsRead(id)}
                  onClearAll={clearAll}
                  onSettings={() => {
                    setIsNotificationsOpen(false);
                    navigate('/settings');
                  }}
                />
              </div>
            </div>
          </header>
        )}

        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-full mx-auto">
            {!activeModule && (
              <Home
                currentUser={currentUser}
                onSelectModule={(moduleId) => {
                  if (moduleId === 'pricing') navigate('/dashboard');
                  if (moduleId === 'config') navigate('/users');
                  if (moduleId === 'managementReports') {
                    setIsReportsExpanded(true);
                    navigate('/managementReports_dashboard');
                  }
                  if (moduleId === 'prd') navigate('/prd');
                  if (moduleId === 'expenses') navigate('/expenses_lancamentos');
                  if (moduleId === 'carregamento') navigate('/carregamento_visao_geral');
                }}
              />
            )}
            {activeModule === 'pricing' &&
              activeTab === 'dashboard' &&
              hasPermission('dashboard') && <Dashboard currentUser={currentUser} />}
            {(activeTab === 'calculator' || activeTab === 'simplified_calculator') &&
              hasPermission('calculator') && (
                <Calculator
                  currentUser={currentUser}
                  isSimplified={activeTab === 'simplified_calculator'}
                  initialData={editingPricing}
                  initialFormulaToLoad={initialFormulaContext.formula}
                  initialBranchId={initialFormulaContext.branchId}
                  initialPriceListId={initialFormulaContext.priceListId}
                  onSaveSuccess={(record) => {
                    setEditingPricing(null);
                    navigate('/history');
                    handleClearEditing();
                  }}
                  onClearEditing={() => {
                    handleClearEditing();
                    setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
                  }}
                />
              )}
            {activeModule === 'pricing' &&
              activeTab === 'saved_formulas' &&
              hasPermission('calculator') && (
                <SavedFormulas
                  currentUser={currentUser}
                  onSendToCalculator={(f, bId, plId) => {
                    setInitialFormulaContext({ formula: f, branchId: bId, priceListId: plId });
                    navigate('/calculator');
                  }}
                />
              )}
            {activeModule === 'pricing' && activeTab === 'history' && hasPermission('history') && (
              <History onEdit={handleEditPricing} currentUser={currentUser} />
            )}
            {activeModule === 'pricing' &&
              activeTab === 'pedidos_venda' &&
              hasPermission('history') && <PedidosVenda currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'goals' && hasPermission('goals') && (
              <Goals currentUser={currentUser} />
            )}
            {activeModule === 'pricing' &&
              activeTab === 'approvals' &&
              hasPermission('approvals') && <Approvals currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'reports' && hasPermission('reports') && (
              <Reports currentUser={currentUser} />
            )}
            {activeModule === 'pricing' &&
              activeTab === 'pricingReport' &&
              hasPermission('reports') && <PricingReport currentUser={currentUser} />}
            {activeModule === 'pricing' &&
              activeTab === 'commissionReport' &&
              hasPermission('reports') && <CommissionReport currentUser={currentUser} />}
            {activeModule === 'pricing' &&
              activeTab === 'pricingBySeller' &&
              hasPermission('pricingBySeller') && <PricingBySeller currentUser={currentUser} />}
            {activeModule === 'pricing' &&
              activeTab === 'pricelists' &&
              hasPermission('priceLists') && <PriceListManager currentUser={currentUser} />}
            {activeModule === 'pricing' &&
              activeTab === 'materials_brand' &&
              hasPermission('priceLists') && <BrandManager />}
            {activeModule === 'pricing' &&
              activeTab === 'products' &&
              hasPermission('priceLists') && <ProductManager />}
            {activeModule === 'pricing' &&
              activeTab === 'incompatibilities' &&
              hasPermission('priceLists') && <IncompatibilityManager />}
            {activeModule === 'pricing' && activeTab === 'clients' && hasPermission('clients') && (
              <ClientManager currentUser={currentUser} />
            )}
            {activeModule === 'pricing' && activeTab === 'agents' && hasPermission('agents') && (
              <AgentManager currentUser={currentUser} />
            )}
            {activeModule === 'config' && activeTab === 'branches' && hasPermission('branches') && (
              <BranchManager currentUser={currentUser} />
            )}
            {activeModule === 'config' && activeTab === 'settings' && hasPermission('settings') && (
              <SettingsManager />
            )}
            {activeModule === 'config' && activeTab === 'users' && hasPermission('users') && (
              <UserManager currentUser={currentUser} />
            )}
            {activeModule === 'config' &&
              activeTab === 'access_profiles' &&
              hasPermission('users') && <AccessProfileManager />}
            {activeModule === 'prd' && activeTab === 'prd' && hasPermission('prd') && (
              <PrdModule currentUser={currentUser} />
            )}
            {activeModule === 'managementReports' &&
              activeTab === 'managementReports_dashboard' &&
              hasPermission('managementReports') && (
                <ManagementReportsModule currentUser={currentUser} activeTab="dashboard" />
              )}
            {activeModule === 'managementReports' &&
              activeTab === 'managementReports_lancamentos' &&
              hasPermission('managementReports') && (
                <ManagementReportsModule currentUser={currentUser} activeTab="lancamentos" />
              )}
            {activeModule === 'managementReports' &&
              activeTab === 'managementReports_cadastros' &&
              hasPermission('managementReports') && (
                <ManagementReportsModule currentUser={currentUser} activeTab="cadastros" />
              )}
            {activeModule === 'expenses' &&
              (activeTab === 'expenses' || activeTab === 'expenses_lancamentos') &&
              hasPermission('expenses') && (
                <ExpenseDashboard currentUser={currentUser} view="lancamentos" />
              )}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_novo' &&
              hasPermission('expenses') && (
                <ExpenseDashboard currentUser={currentUser} view="novo" />
              )}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_relatorios' &&
              hasPermission('expenses') && (
                <ExpenseDashboard currentUser={currentUser} view="relatorios" />
              )}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_conferencia' &&
              hasPermission('expenses') && <CheckExpenses currentUser={currentUser} />}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_aprovacao' &&
              hasPermission('expenses') && <ApproveExpenses currentUser={currentUser} />}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_categorias' &&
              hasPermission('expenses') && <ExpenseCategoryManager />}
            {activeModule === 'expenses' &&
              activeTab === 'expenses_cartoes' &&
              hasPermission('expenses') && <CardManager currentUser={currentUser} />}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_visao_geral' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="visao_geral" />
              )}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_solicitacao' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="solicitacao" />
              )}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_liberacao' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="liberacao" />
              )}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_logistica' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="logistica" />
              )}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_calendario' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="calendario" />
              )}
            {activeModule === 'carregamento' &&
              activeTab === 'carregamento_relatorios' &&
              hasPermission('carregamento') && (
                <CarregamentoModule currentUser={currentUser} view="relatorios" />
              )}
          </div>
        </main>
      </div>

      {/* Floating Notifications (Toasts) */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <NotificationCard notification={toast} onClose={removeToast} autoClose={true} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
