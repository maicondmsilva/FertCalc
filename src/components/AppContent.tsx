import React from 'react';
import type { PricingRecord, SavedFormula, User } from '../types';
import AccessLevelManager from './AccessLevelManager';
import AccessProfileManager from './AccessProfileManager';
import AgentManager from './AgentManager';
import AlertCenter from './AlertCenter';
import Approvals from './Approvals';
import BranchManager from './BranchManager';
import BrandManager from './BrandManager';
import Calculator from './Calculator';
import CarregamentoModule from './Carregamento';
import ClientManager from './ClientManager';
import CommissionReport from './CommissionReport';
import Dashboard from './Dashboard';
import ApproveExpenses from './ExpenseManagement/ApproveExpenses';
import CardManager from './ExpenseManagement/CardManager';
import CheckExpenses from './ExpenseManagement/CheckExpenses';
import ExpenseCategoryManager from './ExpenseManagement/ExpenseCategoryManager';
import ExpenseDashboard from './ExpenseManagement/ExpenseDashboard';
import Goals from './Goals';
import History from './History';
import Home from './Home';
import IncompatibilityManager from './IncompatibilityManager';
import ManagementReportsModule from './ManagementReportsModule';
import PedidosVenda from './PedidosVenda';
import PriceListManager from './PriceListManager';
import PricingBySeller from './PricingBySeller';
import PricingReport from './PricingReport';
import PrdModule from './PrdModule';
import ProductManager from './ProductManager';
import ProdutosFormulados from './ProdutosFormulados';
import Relatorios from './Relatorios';
import Reports from './Reports';
import SavedFormulas from './SavedFormulas';
import SettingsManager from './SettingsManager';
import UserManager from './UserManager';

export type ActiveModule =
  | 'pricing'
  | 'config'
  | 'prd'
  | 'managementReports'
  | 'expenses'
  | 'carregamento'
  | 'relatorios'
  | null;

interface FormulaContext {
  formula: SavedFormula | null;
  branchId: string;
  priceListId: string;
}

interface AppContentProps {
  activeModule: ActiveModule;
  activeTab: string;
  currentUser: User;
  editingPricing: PricingRecord | null;
  initialFormulaContext: FormulaContext;
  hasPermission: (permission: string) => boolean;
  onSelectModule: (moduleId: string) => void;
  onEditPricing: (pricing: PricingRecord) => void;
  onCalculatorSaved: (record: PricingRecord) => void;
  onClearCalculator: () => void;
  onSendFormulaToCalculator: (formula: SavedFormula, branchId: string, priceListId: string) => void;
}

export default function AppContent({
  activeModule,
  activeTab,
  currentUser,
  editingPricing,
  initialFormulaContext,
  hasPermission,
  onSelectModule,
  onEditPricing,
  onCalculatorSaved,
  onClearCalculator,
  onSendFormulaToCalculator,
}: AppContentProps) {
  if (!activeModule) {
    return <Home currentUser={currentUser} onSelectModule={onSelectModule} />;
  }

  if (activeModule === 'pricing') {
    if (activeTab === 'dashboard' && hasPermission('dashboard')) {
      return <Dashboard currentUser={currentUser} />;
    }
    if (
      (activeTab === 'calculator' || activeTab === 'simplified_calculator') &&
      hasPermission('calculator')
    ) {
      return (
        <React.Fragment key={activeTab}>
          <Calculator
            currentUser={currentUser}
            isSimplified={activeTab === 'simplified_calculator'}
            initialData={editingPricing}
            initialFormulaToLoad={initialFormulaContext.formula}
            initialBranchId={initialFormulaContext.branchId}
            initialPriceListId={initialFormulaContext.priceListId}
            onSaveSuccess={onCalculatorSaved}
            onClearEditing={onClearCalculator}
          />
        </React.Fragment>
      );
    }
    if (activeTab === 'saved_formulas' && hasPermission('calculator')) {
      return (
        <SavedFormulas currentUser={currentUser} onSendToCalculator={onSendFormulaToCalculator} />
      );
    }
    if (activeTab === 'produtos_formulados' && hasPermission('produtosFormulados')) {
      return <ProdutosFormulados />;
    }
    if (activeTab === 'history' && hasPermission('history')) {
      return <History onEdit={onEditPricing} currentUser={currentUser} />;
    }
    if (activeTab === 'pedidos_venda' && hasPermission('history')) {
      return <PedidosVenda currentUser={currentUser} />;
    }
    if (activeTab === 'goals' && hasPermission('goals')) return <Goals currentUser={currentUser} />;
    if (activeTab === 'approvals' && hasPermission('approvals')) {
      return <Approvals currentUser={currentUser} />;
    }
    if (activeTab === 'reports' && hasPermission('reports')) {
      return <Reports currentUser={currentUser} />;
    }
    if (activeTab === 'pricingReport' && hasPermission('reports')) {
      return <PricingReport currentUser={currentUser} />;
    }
    if (activeTab === 'commissionReport' && hasPermission('reports')) {
      return <CommissionReport currentUser={currentUser} />;
    }
    if (activeTab === 'pricingBySeller' && hasPermission('pricingBySeller')) {
      return <PricingBySeller currentUser={currentUser} />;
    }
    if (activeTab === 'pricelists' && hasPermission('priceLists')) {
      return <PriceListManager currentUser={currentUser} />;
    }
    if (activeTab === 'materials_brand' && hasPermission('priceLists')) return <BrandManager />;
    if (activeTab === 'products' && hasPermission('priceLists')) return <ProductManager />;
    if (activeTab === 'incompatibilities' && hasPermission('priceLists')) {
      return <IncompatibilityManager />;
    }
    if (activeTab === 'clients' && hasPermission('clients')) {
      return <ClientManager currentUser={currentUser} />;
    }
    if (activeTab === 'agents' && hasPermission('agents')) {
      return <AgentManager currentUser={currentUser} />;
    }
  }

  if (activeModule === 'config') {
    if (activeTab === 'branches' && hasPermission('branches')) {
      return <BranchManager currentUser={currentUser} />;
    }
    if (activeTab === 'settings' && hasPermission('settings')) return <SettingsManager />;
    if (activeTab === 'users' && hasPermission('users')) {
      return <UserManager currentUser={currentUser} />;
    }
    if (activeTab === 'access_profiles' && hasPermission('accessProfiles')) {
      return <AccessProfileManager />;
    }
    if (activeTab === 'access_levels' && hasPermission('accessProfiles')) {
      return <AccessLevelManager />;
    }
    if (
      activeTab === 'alert_center' &&
      (hasPermission('alertas') || currentUser.role === 'admin' || currentUser.role === 'master')
    ) {
      return <AlertCenter />;
    }
  }

  if (activeModule === 'prd' && activeTab === 'prd' && hasPermission('prd')) {
    return <PrdModule currentUser={currentUser} />;
  }

  if (activeModule === 'managementReports' && hasPermission('managementReports')) {
    if (activeTab === 'managementReports_dashboard') {
      return <ManagementReportsModule currentUser={currentUser} activeTab="dashboard" />;
    }
    if (activeTab === 'managementReports_lancamentos') {
      return <ManagementReportsModule currentUser={currentUser} activeTab="lancamentos" />;
    }
    if (activeTab === 'managementReports_cadastros') {
      return <ManagementReportsModule currentUser={currentUser} activeTab="cadastros" />;
    }
  }

  if (activeModule === 'expenses' && hasPermission('expenses')) {
    if (activeTab === 'expenses' || activeTab === 'expenses_lancamentos') {
      return <ExpenseDashboard currentUser={currentUser} view="lancamentos" />;
    }
    if (activeTab === 'expenses_novo') {
      return <ExpenseDashboard currentUser={currentUser} view="novo" />;
    }
    if (activeTab === 'expenses_relatorios') {
      return <ExpenseDashboard currentUser={currentUser} view="relatorios" />;
    }
    if (activeTab === 'expenses_conferencia') return <CheckExpenses currentUser={currentUser} />;
    if (activeTab === 'expenses_aprovacao') return <ApproveExpenses currentUser={currentUser} />;
    if (activeTab === 'expenses_categorias') return <ExpenseCategoryManager />;
    if (activeTab === 'expenses_cartoes') return <CardManager currentUser={currentUser} />;
  }

  if (activeModule === 'carregamento' && hasPermission('carregamento')) {
    const views = {
      carregamento_visao_geral: 'visao_geral',
      carregamento_solicitacao: 'solicitacao',
      carregamento_liberacao: 'liberacao',
      carregamento_logistica: 'logistica',
      carregamento_calendario: 'calendario',
      carregamento_relatorios: 'relatorios',
      carregamento_transportadoras: 'transportadoras',
    } as const;
    const view = views[activeTab as keyof typeof views];
    if (view) {
      return (
        <React.Fragment key={activeTab}>
          <CarregamentoModule currentUser={currentUser} view={view} />
        </React.Fragment>
      );
    }
  }

  if (activeModule === 'relatorios' && activeTab === 'relatorios') {
    return <Relatorios currentUser={currentUser} />;
  }

  return null;
}
