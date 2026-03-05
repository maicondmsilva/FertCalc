/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import Login from './components/Login';
import Home from './components/Home';
// import Dashboard from './components/Dashboard';
import Dashboard from './components/Dashboard';
import SavedFormulas from './components/SavedFormulas';
import { LayoutDashboard, History as HistoryIcon, Database, Users, UserCheck, Building2, Settings, LogOut, Leaf, ShieldCheck, Menu, X, Target, Bell, Download, ChevronLeft, ChevronRight, Home as HomeIcon, BarChart3, ChevronDown, FileEdit, Tag, Package, AlertTriangle, Calculator as CalcIcon, Beaker } from 'lucide-react';
import { PricingRecord, User, AppSettings, Notification, NavItem } from './types';
import { getAppSettings, getNotifications, markNotificationsAsRead } from './services/db';
import { useNavigate, useLocation, Link } from 'react-router-dom';

import Approvals from './components/Approvals';
import PrdModule from './components/PrdModule';
import ManagementReportsModule from './components/ManagementReportsModule';

import MacroManager from './components/MacroManager';
import MicroManager from './components/MicroManager';
import BrandManager from './components/BrandManager';
import ProductManager from './components/ProductManager';
import IncompatibilityManager from './components/IncompatibilityManager';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || '';

  let activeModule: 'pricing' | 'config' | 'prd' | 'managementReports' | null = null;
  if (['dashboard', 'calculator', 'saved_formulas', 'history', 'goals', 'approvals', 'reports', 'pricingReport', 'commissionReport', 'pricelists', 'materials_macro', 'materials_micro', 'materials_brand', 'products', 'incompatibilities', 'clients', 'agents'].includes(activeTab)) {
    activeModule = 'pricing';
  } else if (['branches', 'settings', 'users'].includes(activeTab)) {
    activeModule = 'config';
  } else if (activeTab === 'prd') {
    activeModule = 'prd';
  } else if (['managementReports_dashboard', 'managementReports_lancamentos', 'managementReports_cadastros'].includes(activeTab)) {
    activeModule = 'managementReports';
  }

  const [editingPricing, setEditingPricing] = useState<PricingRecord | null>(null);
  const [initialFormulaContext, setInitialFormulaContext] = useState<{ formula: SavedFormula | null; branchId: string; priceListId: string }>({ formula: null, branchId: '', priceListId: '' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: ''
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Load settings and notifications from Supabase
    getAppSettings().then(savedSettings => {
      if (savedSettings?.companyName) {
        setAppSettings(savedSettings);
      }
    });

    getNotifications().then(notifs => {
      setNotifications(notifs);
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    if (currentUser) {
      markNotificationsAsRead(currentUser.id).catch(console.error);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    navigate('/');
    localStorage.setItem('current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/');
    localStorage.removeItem('current_user');
  };

  const handleEditPricing = (pricing: PricingRecord) => {
    setEditingPricing(pricing);
    navigate('/calculator');
  };

  const handleClearEditing = () => {
    setEditingPricing(null);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const getNavItems = () => {
    if (!activeModule) return [];

    if (activeModule === 'pricing') {
      const allItems = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3, permission: 'dashboard' },
        { id: 'calculator', label: 'Calculadora', icon: CalcIcon, permission: 'calculator' },
        { id: 'saved_formulas', label: 'Batidas Salvas', icon: Beaker, permission: 'calculator' },
        {
          id: 'materials_group',
          label: 'Cadastro de Matérias',
          icon: Database,
          permission: 'priceLists',
          type: 'parent',
          children: [
            { id: 'materials_macro', label: 'Macro', icon: Database, permission: 'priceLists' },
            { id: 'materials_micro', label: 'Micronutriente', icon: Database, permission: 'priceLists' },
            { id: 'materials_brand', label: 'Marca Produto', icon: Tag, permission: 'priceLists' },
            { id: 'products', label: 'Produtos', icon: Package, permission: 'priceLists' },
            { id: 'incompatibilities', label: 'Incompatibilidades', icon: AlertTriangle, permission: 'priceLists' },
          ]
        },
        { id: 'pricelists', label: 'Lista de Preço', icon: Database, permission: 'priceLists' },
        { id: 'history', label: 'Situação', icon: HistoryIcon, permission: 'history' },
        { id: 'approvals', label: 'Aprovações', icon: ShieldCheck, permission: 'approvals' },
        { id: 'goals', label: 'Metas', icon: Target, permission: 'goals' },
        {
          id: 'reports',
          label: 'Relatórios',
          icon: BarChart3,
          permission: 'reports',
          type: 'parent',
          children: [
            { id: 'pricingReport', label: 'Relatório de Precificação', icon: BarChart3, permission: 'reports' },
            { id: 'commissionReport', label: 'Relatório de Comissão', icon: BarChart3, permission: 'reports' },
          ]
        },
        { id: 'clients', label: 'Clientes', icon: Users, permission: 'clients' },
        { id: 'agents', label: 'Agentes', icon: UserCheck, permission: 'agents' },
      ];

      return allItems.filter(item => {
        if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
        return (currentUser.permissions as any)?.[item.permission];
      });
    }

    if (activeModule === 'config') {
      const allItems = [
        { id: 'users', label: 'Usuários', icon: Users, permission: 'users' },
        { id: 'branches', label: 'Filiais', icon: Building2, permission: 'branches' },
        { id: 'settings', label: 'Personalização', icon: Settings, permission: 'settings' },
      ];

      return allItems.filter(item => {
        if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
        return (currentUser.permissions as any)?.[item.permission];
      });
    }

    if (activeModule === 'prd') {
      const allItems = [
        { id: 'prd', label: 'Documentação PRD', icon: BarChart3, permission: 'prd' }, // Using BarChart3 as a placeholder icon
      ];

      return allItems.filter(item => {
        if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
        return (currentUser.permissions as any)?.[item.permission];
      });
    }

    if (activeModule === 'managementReports') {
      const allItems = [
        {
          id: 'managementReports_group',
          label: 'Relatórios Gerenciais',
          icon: BarChart3,
          permission: 'managementReports',
          type: 'parent',
          children: [
            { id: 'managementReports_dashboard', label: 'Capa / Relatório', icon: LayoutDashboard, permission: 'managementReports' },
            { id: 'managementReports_lancamentos', label: 'Lançamentos', icon: FileEdit, permission: 'managementReports' },
            { id: 'managementReports_cadastros', label: 'Configurações', icon: Settings, permission: 'managementReports' },
          ]
        },
      ];

      return allItems.filter(item => {
        if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
        return (currentUser.permissions as any)?.[item.permission];
      });
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
          ${!activeModule ? 'hidden' : ''}
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Back to Home Button */}
        <div className="p-2 border-b border-stone-100">
          <Link
            to="/"
            className={`w-full flex items-center px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors`}
            title={!isSidebarExpanded ? "Voltar ao Início" : undefined}
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
                {activeModule === 'pricing' ? 'Precificação' : 'Configuração'}
              </p>
            )}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.type === 'parent') {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      if (item.id === 'materials_group') {
                        setIsMaterialsExpanded(!isMaterialsExpanded);
                      } else {
                        setIsReportsExpanded(!isReportsExpanded);
                      }
                    }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${(item.id === 'materials_group' ? isMaterialsExpanded : isReportsExpanded) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    title={!isSidebarExpanded ? item.label : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${(item.id === 'materials_group' ? isMaterialsExpanded : isReportsExpanded) || isActive ? 'text-emerald-600' : 'text-stone-400'}`} />
                    {isSidebarExpanded && (
                      <span className="ml-3 truncate">{item.label}</span>
                    )}
                    {isSidebarExpanded && (
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${(item.id === 'materials_group' ? isMaterialsExpanded : isReportsExpanded) ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {
                    (item.id === 'materials_group' ? isMaterialsExpanded : isReportsExpanded) && isSidebarExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children?.filter(child => {
                          if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
                          return (currentUser.permissions as any)?.[child.permission];
                        }).map(child => {
                          const ChildIcon = child.icon;
                          const isChildActive = activeTab === child.id;
                          return (
                            <Link
                              key={child.id}
                              to={`/${child.id}`}
                              onClick={() => {
                                setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isChildActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                              title={!isSidebarExpanded ? child.label : undefined}
                            >
                              <ChildIcon className={`w-5 h-5 flex-shrink-0 ${isChildActive ? 'text-emerald-600' : 'text-stone-400'}`} />
                              {isSidebarExpanded && (
                                <span className="ml-3 truncate">{child.label}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
              );
            } else {
              return (
                <Link
                  key={item.id}
                  to={`/${item.id}`}
                  onClick={() => {
                    if (item.id !== 'calculator') {
                      setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-stone-400'}`} />
                  {isSidebarExpanded && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                </Link>
              );
            }
          })}
        </nav>

        {/* User Area */}
        <div className="p-4 border-t border-stone-200">
          <div className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
            {isSidebarExpanded && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-stone-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-stone-500 truncate">{currentUser.customCode}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden mr-4 text-stone-500 hover:text-stone-700"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            >
              {isSidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-4">
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Download className="w-3 h-3 mr-1" />
                Instalar App
              </button>
            )}
            {(currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <div className="relative">
                <button
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    if (!isNotificationsOpen) markNotificationsRead();
                  }}
                  className="p-2 text-stone-400 hover:text-emerald-600 transition-colors relative rounded-full hover:bg-stone-100"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center border border-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-stone-200 z-50 overflow-hidden">
                    <div className="p-3 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-600 uppercase">Notificações</span>
                      <button onClick={() => setIsNotificationsOpen(false)} className="text-stone-400 hover:text-stone-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-stone-400 text-sm">Nenhuma notificação</div>
                      ) : (
                        notifications.slice().reverse().map(n => (
                          <div key={n.id} className={`p-4 border-b border-stone-100 hover:bg-stone-50 transition-colors ${!n.read ? 'bg-emerald-50/30' : ''}`}>
                            <p className="text-sm font-bold text-stone-800">{n.title}</p>
                            <p className="text-xs text-stone-600 mt-1">{n.message}</p>
                            <p className="text-[10px] text-stone-400 mt-2">{new Date(n.date).toLocaleString('pt-BR')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

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
                }}
              />
            )}
            {activeModule === 'pricing' && activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'calculator' && (
              <Calculator
                currentUser={currentUser}
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
            {activeModule === 'pricing' && activeTab === 'saved_formulas' && (
              <SavedFormulas
                currentUser={currentUser}
                onSendToCalculator={(f, bId, plId) => {
                  setInitialFormulaContext({ formula: f, branchId: bId, priceListId: plId });
                  navigate('/calculator');
                }}
              />
            )}
            {activeModule === 'pricing' && activeTab === 'history' && <History onEdit={handleEditPricing} currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'goals' && <Goals currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'approvals' && <Approvals currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'reports' && <Reports currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'pricingReport' && <PricingReport currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'commissionReport' && <CommissionReport currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'pricelists' && <PriceListManager currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'materials_macro' && <MacroManager currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'materials_micro' && <MicroManager currentUser={currentUser} />}
            {activeModule === 'pricing' && activeTab === 'materials_brand' && <BrandManager />}
            {activeModule === 'pricing' && activeTab === 'products' && <ProductManager />}
            {activeModule === 'pricing' && activeTab === 'incompatibilities' && <IncompatibilityManager />}
            {activeModule === 'pricing' && activeTab === 'clients' && <ClientManager />}
            {activeModule === 'pricing' && activeTab === 'agents' && <AgentManager />}
            {activeModule === 'config' && activeTab === 'branches' && <BranchManager />}
            {activeModule === 'config' && activeTab === 'settings' && <SettingsManager />}
            {activeModule === 'config' && activeTab === 'users' && <UserManager />}
            {activeModule === 'prd' && activeTab === 'prd' && <PrdModule currentUser={currentUser} />}
            {activeModule === 'managementReports' && activeTab === 'managementReports_dashboard' && <ManagementReportsModule currentUser={currentUser} activeTab="dashboard" />}
            {activeModule === 'managementReports' && activeTab === 'managementReports_lancamentos' && <ManagementReportsModule currentUser={currentUser} activeTab="lancamentos" />}
            {activeModule === 'managementReports' && activeTab === 'managementReports_cadastros' && <ManagementReportsModule currentUser={currentUser} activeTab="cadastros" />}
          </div>
        </main>
      </div>
    </div >
  );
}

