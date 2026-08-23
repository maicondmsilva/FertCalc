import React, { useEffect, useState } from 'react';
import { ChevronDown, Home as HomeIcon, Leaf, LogOut, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AppSettings, NavItem, User } from '../types';
import type { ActiveModule } from '../navigation/appNavigation';

interface AppSidebarProps {
  activeModule: ActiveModule;
  activeTab: string;
  appSettings: AppSettings;
  currentUser: User;
  isExpanded: boolean;
  isMobileOpen: boolean;
  isStandalone: boolean;
  navItems: NavItem[];
  hasPermission: (permission: string) => boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  onNavigate: (routeId: string, clearFormulaContext: boolean) => void;
}

const initiallyExpanded = new Set(['expenses_lancamentos_group', 'carregamento_group']);

const moduleTitle = (activeModule: ActiveModule) => {
  if (activeModule === 'pricing') return 'Precificação';
  if (activeModule === 'expenses') return 'Cartão Corporativo';
  if (activeModule === 'carregamento') return 'Carregamento';
  if (activeModule === 'relatorios') return 'Relatórios';
  return 'Configuração';
};

export default function AppSidebar({
  activeModule,
  activeTab,
  appSettings,
  currentUser,
  isExpanded,
  isMobileOpen,
  isStandalone,
  navItems,
  hasPermission,
  onCloseMobile,
  onLogout,
  onNavigate,
}: AppSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(initiallyExpanded);

  useEffect(() => {
    const closeGroups = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('aside')) {
        setExpandedGroups((current) => {
          const next = new Set(current);
          next.delete('materials_group');
          next.delete('reports');
          next.delete('managementReports_group');
          return next;
        });
      }
    };
    window.document.addEventListener('mousedown', closeGroups);
    return () => window.document.removeEventListener('mousedown', closeGroups);
  }, []);

  useEffect(() => {
    const activeParent = navItems.find((item) =>
      item.children?.some((child) => child.id === activeTab)
    );
    if (activeParent) {
      setExpandedGroups((current) => new Set(current).add(activeParent.id));
    }
  }, [activeTab, navItems]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigate = (event: React.MouseEvent, routeId: string, clear: boolean) => {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    onCloseMobile();
    onNavigate(routeId, clear);
  };

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu de navegação"
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`bg-white border-r border-stone-200 flex flex-col transition-all duration-300 z-50
          ${isExpanded ? 'w-64' : 'w-20'}
          ${isMobileOpen ? 'fixed inset-y-0 left-0' : 'hidden md:flex relative'}
          ${!activeModule || isStandalone ? 'hidden' : ''}
        `}
      >
        <div className="h-16 flex items-center justify-between border-b border-stone-200 px-4">
          <div className="flex items-center overflow-hidden">
            {appSettings.companyLogo ? (
              <img src={appSettings.companyLogo} alt="Logo" className="h-8 w-auto flex-shrink-0" />
            ) : (
              <Leaf className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            )}
            {isExpanded && (
              <span className="ml-2 text-lg font-bold text-emerald-700 truncate whitespace-nowrap">
                {appSettings.companyName}
              </span>
            )}
          </div>
          <button
            className="md:hidden text-stone-400 hover:text-stone-600"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-2 border-b border-stone-100">
          <Link
            to="/"
            onClick={(event) => navigate(event, '', true)}
            className="w-full flex items-center px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
            title={!isExpanded ? 'Voltar ao Início' : undefined}
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0 text-stone-400" />
            {isExpanded && (
              <span className="ml-3 font-bold text-xs uppercase tracking-widest">Início</span>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {isExpanded && (
            <div className="px-3 mb-2">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                {moduleTitle(activeModule)}
              </p>
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isGroupExpanded = expandedGroups.has(item.id);
            const isExpenseGroup = item.id.startsWith('expenses_');
            const isCarregamentoGroup = item.id.startsWith('carregamento_');
            const activeColors = isExpenseGroup
              ? 'bg-purple-50 text-purple-700 font-medium'
              : isCarregamentoGroup
                ? 'bg-amber-50 text-amber-700 font-medium'
                : 'bg-emerald-50 text-emerald-700 font-medium';
            const iconColors = isExpenseGroup
              ? 'text-purple-600'
              : isCarregamentoGroup
                ? 'text-amber-600'
                : 'text-emerald-600';

            if (item.type === 'parent') {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleGroup(item.id)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isGroupExpanded ? activeColors : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 ${isGroupExpanded || isActive ? iconColors : 'text-stone-400'}`}
                    />
                    {isExpanded && <span className="ml-3 truncate">{item.label}</span>}
                    {isExpanded && (
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {isGroupExpanded && isExpanded && (
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
                              onClick={(event) => navigate(event, child.id, true)}
                              className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isChildActive ? activeColors : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                            >
                              <ChildIcon
                                className={`w-5 h-5 flex-shrink-0 ${isChildActive ? iconColors : 'text-stone-400'}`}
                              />
                              <span className="ml-3 truncate flex-1">{child.label}</span>
                              {(child.badge || 0) > 0 && (
                                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {child.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                to={`/${item.id}?standalone=true`}
                onClick={(event) =>
                  navigate(
                    event,
                    item.id,
                    item.id !== 'calculator' && item.id !== 'simplified_calculator'
                  )
                }
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                title={!isExpanded ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-stone-400'}`}
                />
                {isExpanded && <span className="ml-3 truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-200">
          <div
            className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}
          >
            {isExpanded && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-stone-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-stone-500 truncate">@{currentUser.nickname}</p>
              </div>
            )}
            <button
              onClick={onLogout}
              className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
