import React from 'react';
import { 
  Calculator, 
  History, 
  Users, 
  UserCheck, 
  Target, 
  Database, 
  Building2, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  BarChart3,
  Search,
  Download,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { User } from '../types';

export const menuItems = [
  { id: 'calculator', label: 'Calculadora', icon: Calculator, permission: 'calculator' },
  { id: 'history', label: 'Situação', icon: History, permission: 'history' },
  { id: 'approvals', label: 'Aprovações', icon: ClipboardCheck, permission: 'approvals' },
  { id: 'goals', label: 'Metas', icon: Target, permission: 'goals' },
  { id: 'reports', label: 'Relatórios', icon: BarChart3, permission: 'reports' },
  { id: 'priceLists', label: 'Listas de Preços', icon: Database, permission: 'priceLists' },
  { id: 'products', label: 'Produtos', icon: Database, permission: 'priceLists' },
  { id: 'clients', label: 'Clientes', icon: Users, permission: 'clients' },
  { id: 'agents', label: 'Representantes', icon: UserCheck, permission: 'agents' },
  { id: 'branches', label: 'Filiais', icon: Building2, permission: 'branches' },
  { id: 'users', label: 'Usuários', icon: ShieldCheck, permission: 'users' },
  { id: 'settings', label: 'Configurações', icon: Settings, permission: 'settings' },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentUser: User | null;
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  unreadNotifications: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onInstall?: () => void;
  showInstall?: boolean;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout, 
  isCollapsed, 
  setIsCollapsed,
  unreadNotifications,
  searchQuery,
  setSearchQuery,
  onInstall,
  showInstall
}: SidebarProps) {
  
  const hasPermission = (item: any) => {
    if (!currentUser) return false;
    if (currentUser.role === 'master' || currentUser.role === 'admin') return true;
    if (!currentUser.permissions) {
      // Default permissions if none set
      if (currentUser.role === 'manager') return true;
      return ['calculator', 'history', 'goals', 'clients', 'agents'].includes(item.permission);
    }
    return (currentUser.permissions as any)[item.permission];
  };

  const filteredItems = menuItems
    .filter(hasPermission)
    .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div 
      className={`bg-stone-900 text-white h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} fixed left-0 top-0 z-50 hidden md:flex`}
    >
      <div className="p-4 flex items-center justify-between border-b border-stone-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="bg-emerald-600 p-1.5 rounded-lg shrink-0">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg truncate">AgroCalc</span>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-stone-800 rounded-lg transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input 
              type="text" 
              placeholder="Buscar menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-800 border-none rounded-lg py-2 pl-10 pr-4 text-xs text-stone-300 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="px-2 space-y-1">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-stone-400 hover:bg-stone-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-white' : 'group-hover:text-emerald-400'}`} />
              {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
              
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}

              {item.id === 'approvals' && unreadNotifications > 0 && (
                <div className={`absolute ${isCollapsed ? 'top-1 right-1' : 'right-3'} bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center`}>
                  {unreadNotifications}
                </div>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-stone-800">
        {!isCollapsed && showInstall && onInstall && (
          <button
            onClick={onInstall}
            className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </button>
        )}
        {!isCollapsed && currentUser && (
          <div className="mb-4 px-2">
            <p className="text-xs text-stone-500 uppercase font-bold tracking-wider">Usuário</p>
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <p className="text-[10px] text-stone-500 uppercase">{currentUser.role}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-stone-400 hover:bg-red-900/20 hover:text-red-400 transition-all group relative`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="font-medium">Sair</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Sair
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
