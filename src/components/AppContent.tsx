import React, { lazy, Suspense } from 'react';
import type { PricingRecord, SavedFormula, User } from '../types';
import type { ActiveModule } from '../navigation/appNavigation';
import Home from './Home';

const AccessLevelManager = lazy(() => import('./AccessLevelManager'));
const AccessProfileManager = lazy(() => import('./AccessProfileManager'));
const AgentManager = lazy(() => import('./AgentManager'));
const AlertCenter = lazy(() => import('./AlertCenter'));
const Approvals = lazy(() => import('./Approvals'));
const BranchManager = lazy(() => import('./BranchManager'));
const BrandManager = lazy(() => import('./BrandManager'));
const Calculator = lazy(() => import('./Calculator'));
const CarregamentoModule = lazy(() => import('./Carregamento'));
const ClientManager = lazy(() => import('./ClientManager'));
const CommissionReport = lazy(() => import('./CommissionReport'));
const Dashboard = lazy(() => import('./Dashboard'));
const ApproveExpenses = lazy(() => import('./ExpenseManagement/ApproveExpenses'));
const CardManager = lazy(() => import('./ExpenseManagement/CardManager'));
const CheckExpenses = lazy(() => import('./ExpenseManagement/CheckExpenses'));
const ExpenseCategoryManager = lazy(() => import('./ExpenseManagement/ExpenseCategoryManager'));
const ExpenseDashboard = lazy(() => import('./ExpenseManagement/ExpenseDashboard'));
const Goals = lazy(() => import('./Goals'));
const History = lazy(() => import('./History'));
const IncompatibilityManager = lazy(() => import('./IncompatibilityManager'));
const ManagementReportsModule = lazy(() => import('./ManagementReportsModule'));
const PedidosVenda = lazy(() => import('./PedidosVenda'));
const PriceListManager = lazy(() => import('./PriceListManager'));
const PricingBySeller = lazy(() => import('./PricingBySeller'));
const PricingReport = lazy(() => import('./PricingReport'));
const PrdModule = lazy(() => import('./PrdModule'));
const ProductManager = lazy(() => import('./ProductManager'));
const ProdutosFormulados = lazy(() => import('./ProdutosFormulados'));
const Relatorios = lazy(() => import('./Relatorios'));
const Reports = lazy(() => import('./Reports'));
const SavedFormulas = lazy(() => import('./SavedFormulas'));
const SettingsManager = lazy(() => import('./SettingsManager'));
const UserManager = lazy(() => import('./UserManager'));

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

function AppContentRoute({
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
    if (activeTab === 'expenses_categorias') {
      return <ExpenseCategoryManager currentUser={currentUser} />;
    }
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

export default function AppContent(props: AppContentProps) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex min-h-48 items-center justify-center text-stone-500">
          Carregando módulo...
        </div>
      }
    >
      <AppContentRoute {...props} />
    </Suspense>
  );
}
