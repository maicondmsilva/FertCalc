/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AppContent, { type ActiveModule } from './components/AppContent';
import AppSidebar from './components/AppSidebar';
import {
  LayoutDashboard,
  History as HistoryIcon,
  Database,
  Users,
  UserCheck,
  Building2,
  Settings,
  ShieldCheck,
  Menu,
  Target,
  Bell,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
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
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from './components/Toast';

import { getPendingCount, getCheckedCount } from './services/expenseService';

import { useNotifications } from './hooks/useNotifications';
import { NotificationBell } from './components/notifications/NotificationBell';
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

  let activeModule: ActiveModule = null;
  if (
    [
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
    ].includes(activeTab)
  ) {
    activeModule = 'pricing';
  } else if (
    ['branches', 'settings', 'users', 'access_profiles', 'access_levels', 'alert_center'].includes(
      activeTab
    )
  ) {
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
    activeTab === 'carregamento_relatorios' ||
    activeTab === 'carregamento_transportadoras'
  ) {
    activeModule = 'carregamento';
  } else if (activeTab === 'relatorios') {
    activeModule = 'relatorios';
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

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = React.useCallback(() => {
    setCurrentUser(null);
    signOut();
    navigate('/');
  }, [navigate]);

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
      if (!target.closest('.notification-trigger')) setIsNotificationsOpen(false);
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

  const handleClearEditingAndFormula = React.useCallback(() => {
    setEditingPricing(null);
    setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
  }, []);

  // Rota de redefinição de senha (acessível sem autenticação)
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser.requer_alteracao_senha) {
    return (
      <Login
        onLogin={handleLogin}
        forceChangePasswordUserId={currentUser.id}
        onPasswordChanged={(updatedUser) => setCurrentUser(updatedUser)}
      />
    );
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

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'config') {
      const allItems = [
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
            {
              id: 'carregamento_transportadoras',
              label: 'Transportadoras',
              icon: Truck,
              permission: 'carregamento',
            },
          ],
        },
      ];

      return allItems.filter((item) => hasPermission(item.permission));
    }

    if (activeModule === 'relatorios') {
      return [
        { id: 'relatorios', label: '📊 Relatórios', icon: BarChart3, permission: 'relatorios' },
      ].filter(() => true);
    }

    return [];
  };

  const navItems: NavItem[] = getNavItems();

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans text-stone-900">
      <AppSidebar
        activeModule={activeModule}
        activeTab={activeTab}
        appSettings={appSettings}
        currentUser={currentUser}
        isExpanded={isSidebarExpanded}
        isMobileOpen={isMobileMenuOpen}
        isStandalone={isStandalone}
        navItems={navItems}
        hasPermission={hasPermission}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
        onNavigate={(routeId, clearFormulaContext) => {
          if (clearFormulaContext) {
            setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
          }
          navigate(routeId ? `/${routeId}` : '/');
        }}
      />
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
            <AppContent
              activeModule={activeModule}
              activeTab={activeTab}
              currentUser={currentUser}
              editingPricing={editingPricing}
              initialFormulaContext={initialFormulaContext}
              hasPermission={hasPermission}
              onSelectModule={(moduleId) => {
                if (moduleId === 'pricing') navigate('/dashboard');
                if (moduleId === 'config') navigate('/users');
                if (moduleId === 'managementReports') navigate('/managementReports_dashboard');
                if (moduleId === 'prd') navigate('/prd');
                if (moduleId === 'expenses') navigate('/expenses_lancamentos');
                if (moduleId === 'carregamento') navigate('/carregamento_visao_geral');
                if (moduleId === 'relatorios') navigate('/relatorios');
              }}
              onEditPricing={handleEditPricing}
              onCalculatorSaved={() => {
                setEditingPricing(null);
                navigate('/history');
                handleClearEditing();
              }}
              onClearCalculator={handleClearEditingAndFormula}
              onSendFormulaToCalculator={(formula, branchId, priceListId) => {
                setInitialFormulaContext({ formula, branchId, priceListId });
                navigate('/calculator');
              }}
            />
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
