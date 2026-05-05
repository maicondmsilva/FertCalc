import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Save,
  User as UserIcon,
  Edit2,
  X,
  ShieldCheck,
  Search,
  Building2,
} from 'lucide-react';
import { User, Branch } from '../types';
import { getUsers, createUser, updateUser, deleteUser, getBranches } from '../services/db';
import { createAuthUser } from '../services/authService';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AccessProfile, getAccessProfiles } from '../services/accessProfileService';

interface UserManagerProps {
  currentUser: User;
}

// ---------------------------------------------------------------------------
// Permission groups — mirrors AccessProfileManager.tsx
// ---------------------------------------------------------------------------
interface PermissionItem {
  id: string;
  label: string;
}
interface PermissionGroup {
  title: string;
  headerClass: string;
  items: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: '📊 Painel',
    headerClass: 'bg-emerald-700 text-white',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'goals', label: 'Metas' },
      { id: 'managementReports', label: 'Rel. Gerenciais' },
    ],
  },
  {
    title: '🧮 Precificação',
    headerClass: 'bg-blue-700 text-white',
    items: [
      { id: 'calculator', label: 'Calculadora' },
      { id: 'history', label: 'Situação / Precificações' },
      { id: 'savedFormulas', label: 'Fórmulas Salvas' },
      { id: 'produtosFormulados', label: 'Produtos Formulados' },
      { id: 'pricingBySeller', label: 'Precificação por Vendedor' },
      { id: 'calculator_savePricing', label: 'Salvar Precificação' },
      { id: 'calculator_generatePDF', label: 'Gerar PDF' },
      { id: 'calculator_saveFormula', label: 'Salvar Fórmula' },
      { id: 'calculator_fertigranP', label: 'Comparador Fertigran P' },
      { id: 'calculator_profitabilityCheck', label: 'Análise de Rentabilidade' },
      { id: 'history_changeStatus', label: 'Alterar Status' },
      { id: 'history_editPricing', label: 'Editar Precificação Existente' },
      { id: 'savedFormulas_delete', label: 'Excluir Batidas Salvas' },
      { id: 'savedFormulas_report', label: 'Gerar Relatório de Preços' },
    ],
  },
  {
    title: '✅ Aprovações',
    headerClass: 'bg-teal-700 text-white',
    items: [
      { id: 'approvals', label: 'Aprovações' },
      { id: 'approvals_canApprove', label: 'Aprovar / Reprovar' },
    ],
  },
  {
    title: '💳 Financeiro / Cartão',
    headerClass: 'bg-purple-700 text-white',
    items: [{ id: 'expenses', label: 'Gastos Cartão' }],
  },
  {
    title: '🚛 Logística',
    headerClass: 'bg-amber-600 text-white',
    items: [
      { id: 'carregamento', label: 'Carregamento (Visualizar)' },
      { id: 'carregamento_solicitar_cotacao', label: 'Solicitar Cotação de Frete' },
      { id: 'carregamento_tratar_cotacao', label: 'Tratar / Responder Cotações' },
      { id: 'carregamento_aprovar_cotacao', label: 'Aprovar Cotações de Frete' },
      { id: 'carregamento_liberar', label: 'Liberar Carregamento' },
      { id: 'carregamento_logistica', label: 'Painel de Logística' },
      { id: 'carregamento_informar_transportador', label: 'Informar Transportador (CIF)' },
      { id: 'carregamento_relatorios', label: 'Relatórios Carregamento' },
      { id: 'carregamento_cancelar', label: 'Cancelar Carregamentos' },
      { id: 'carregamento_all_filiais', label: 'Ver Todas as Filiais' },
      { id: 'carregamento_configurar_filiais', label: 'Configurar Filiais do Carregamento' },
      { id: 'carregamento_admin', label: 'Admin do Módulo' },
      { id: 'carregamento_aceitar_cotacao', label: 'Aceitar Cotações de Frete' },
      { id: 'carregamento_aceitar_carregamento', label: 'Aceitar Carregamento' },
      { id: 'carregamento_liberacao', label: 'Liberar Carregamento' },
      { id: 'carregamento_ver_arquivadas', label: 'Ver Cotações Arquivadas' },
    ],
  },
  {
    title: '📋 Relatórios',
    headerClass: 'bg-indigo-700 text-white',
    items: [
      { id: 'reports', label: 'Relatórios' },
      { id: 'pricingReport', label: 'Rel. Precificação' },
      { id: 'commissionReport', label: 'Rel. Comissão' },
    ],
  },
  {
    title: '🗄️ Cadastros',
    headerClass: 'bg-rose-700 text-white',
    items: [
      { id: 'clients', label: 'Clientes' },
      { id: 'clients_create', label: 'Clientes — Criar' },
      { id: 'clients_edit', label: 'Clientes — Editar' },
      { id: 'clients_delete', label: 'Clientes — Excluir' },
      { id: 'agents', label: 'Representantes' },
      { id: 'agents_create', label: 'Representantes — Criar' },
      { id: 'agents_edit', label: 'Representantes — Editar' },
      { id: 'agents_delete', label: 'Representantes — Excluir' },
      { id: 'priceLists', label: 'Listas de Preço' },
      { id: 'priceLists_create', label: 'Listas — Criar' },
      { id: 'priceLists_edit', label: 'Listas — Editar' },
      { id: 'priceLists_delete', label: 'Listas — Excluir' },
      { id: 'macro', label: 'Materiais Macro' },
      { id: 'macro_create', label: 'Macro — Criar' },
      { id: 'macro_edit', label: 'Macro — Editar' },
      { id: 'macro_delete', label: 'Macro — Excluir' },
      { id: 'micro', label: 'Materiais Micro' },
      { id: 'micro_create', label: 'Micro — Criar' },
      { id: 'micro_edit', label: 'Micro — Editar' },
      { id: 'micro_delete', label: 'Micro — Excluir' },
      { id: 'prd', label: 'Documentação PRD' },
      { id: 'produtosFormulados_edit', label: 'Produtos Formulados — Editar' },
    ],
  },
  {
    title: '⚙️ Configurações',
    headerClass: 'bg-stone-700 text-white',
    items: [
      { id: 'branches', label: 'Filiais' },
      { id: 'branches_create', label: 'Filiais — Criar' },
      { id: 'branches_edit', label: 'Filiais — Editar' },
      { id: 'branches_delete', label: 'Filiais — Excluir' },
      { id: 'settings', label: 'Personalização' },
      { id: 'users', label: 'Usuários' },
      { id: 'accessProfiles', label: 'Perfis de Acesso' },
      { id: 'alertas', label: 'Central de Alertas' },
    ],
  },
];

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'master':
      return 'bg-purple-100 text-purple-700';
    case 'admin':
      return 'bg-red-100 text-red-700';
    case 'manager':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-green-100 text-green-700';
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'master':
      return 'Master';
    case 'admin':
      return 'Administrador';
    case 'manager':
      return 'Gerente';
    default:
      return 'Vendedor';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

function getAvatarBg(role: string): string {
  switch (role) {
    case 'master':
      return 'bg-purple-500';
    case 'admin':
      return 'bg-red-500';
    case 'manager':
      return 'bg-blue-500';
    default:
      return 'bg-green-500';
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function UserManager({ currentUser }: UserManagerProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
  const [appliedProfileId, setAppliedProfileId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'dados' | 'permissoes' | 'filiais'>('dados');
  const [searchQuery, setSearchQuery] = useState('');

  const getDefaultPermissions = (role: string) => {
    const base = {
      dashboard: true,
      calculator: true,
      history: true,
      clients: true,
      agents: true,
      goals: false,
      priceLists: true,
      branches: false,
      users: false,
      settings: false,
      approvals: false,
      savedFormulas: true,
      produtosFormulados: false,
      reports: true,
      pricingReport: true,
      commissionReport: true,
      pricingBySeller: false,
      prd: false,
      managementReports: false,
      calculator_profitabilityCheck: false,
    };
    if (role === 'master' || role === 'admin') {
      const allCrud: Record<string, boolean> = {};
      ['clients', 'agents', 'priceLists', 'branches', 'macro', 'micro'].forEach((resource) => {
        allCrud[resource] = true;
        allCrud[`${resource}_create`] = true;
        allCrud[`${resource}_edit`] = true;
        allCrud[`${resource}_delete`] = true;
      });
      const all: Record<string, boolean> = {
        approvals_canApprove: true,
        calculator_profitabilityCheck: true,
        ...allCrud,
      };
      Object.keys(base).forEach((key) => {
        all[key] = true;
      });
      return { ...all, creditCard: 'admin' };
    }
    if (role === 'manager') {
      const allCrud: Record<string, boolean> = {};
      ['clients', 'agents', 'priceLists', 'branches', 'macro', 'micro'].forEach((resource) => {
        allCrud[resource] = true;
        allCrud[`${resource}_create`] = true;
        allCrud[`${resource}_edit`] = true;
        allCrud[`${resource}_delete`] = true;
      });
      return {
        ...base,
        approvals: true,
        approvals_canApprove: true,
        reports: true,
        pricingReport: true,
        commissionReport: true,
        pricingBySeller: true,
        goals: true,
        calculator_profitabilityCheck: true,
        creditCard: 'approver',
        ...allCrud,
      };
    }
    return { ...base, creditCard: 'none' };
  };

  const emptyFormData = () => ({
    name: '',
    email: '',
    nickname: '',
    idNumeric: 0,
    password: '',
    ativo: true,
    role: 'user' as 'master' | 'user' | 'manager' | 'admin',
    managedUserIds: [] as string[],
    filiais_permitidas: [] as string[],
    permissions: getDefaultPermissions('user') as any,
  });

  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    loadUsers();
    getBranches().then(setBranches);
    getAccessProfiles().then(setAccessProfiles);
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setAppliedProfileId('');
    setFormData(emptyFormData());
  };

  const handleRoleChange = (role: 'master' | 'user' | 'manager' | 'admin') => {
    setAppliedProfileId('');
    setFormData({ ...formData, role, permissions: getDefaultPermissions(role) as any });
  };

  const toggleFilial = (filialId: string) => {
    setFormData((prev) => ({
      ...prev,
      filiais_permitidas: prev.filiais_permitidas.includes(filialId)
        ? prev.filiais_permitidas.filter((id) => id !== filialId)
        : [...prev.filiais_permitidas, filialId],
    }));
  };

  const handleApplyProfile = (profileId: string) => {
    setAppliedProfileId(profileId);
    if (!profileId) return;
    const profile = accessProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, ...profile.permissions } as any,
    }));
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      showError('Nome, e-mail e nível de acesso são obrigatórios.');
      return;
    }
    if (!editingId && !formData.password) {
      showError('A senha é obrigatória para um novo usuário.');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await updateUser(editingId, {
          name: formData.name,
          email: formData.email,
          nickname: formData.nickname,
          role: formData.role,
          ativo: formData.ativo,
          managedUserIds: formData.role === 'manager' ? formData.managedUserIds : [],
          permissions: formData.permissions,
          filiais_permitidas: formData.filiais_permitidas,
        });
      } else {
        const authResult = await createAuthUser(formData.email, formData.password);
        if (!authResult.success) {
          showError(`Erro ao criar autenticação: ${authResult.error || 'Erro desconhecido'}`);
          setLoading(false);
          return;
        }
        await createUser({
          idNumeric: 0,
          name: formData.name,
          email: formData.email,
          nickname: formData.nickname,
          role: formData.role,
          ativo: formData.ativo,
          managedUserIds: formData.role === 'manager' ? formData.managedUserIds : [],
          permissions: formData.permissions as any,
          filiais_permitidas: formData.filiais_permitidas,
        });
      }
      await loadUsers();
      showSuccess(editingId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
      resetForm();
      setModalOpen(false);
    } catch (err: unknown) {
      console.error('Erro ao salvar usuário:', err);
      const msg: string = err instanceof Error ? err.message : '';
      if (msg.includes('app_users_email_key') || msg.includes('duplicate key')) {
        showError(
          'Este e-mail já está cadastrado. Use um e-mail diferente ou edite o usuário existente.'
        );
      } else {
        showError(`Erro ao salvar usuário: ${msg || 'Erro desconhecido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const canEditUser = (targetUser: User): boolean => {
    if (targetUser.role === 'master' && currentUser.role !== 'master') return false;
    return true;
  };

  const canDeleteUser = (targetUser: User): boolean => {
    if (targetUser.role === 'master' && currentUser.role !== 'master') return false;
    if (targetUser.id === currentUser.id) return false;
    return true;
  };

  const startEdit = (user: User) => {
    if (!canEditUser(user)) {
      showError('Apenas usuários Master podem editar outros usuários Master.');
      return;
    }
    const basePerms = user.permissions || getDefaultPermissions(user.role);
    const carregamentoFilialIds = (basePerms as any)?.carregamento_filial_ids;
    const autoAllFiliais =
      (basePerms as any)?.carregamento_all_filiais ??
      !(Array.isArray(carregamentoFilialIds) && carregamentoFilialIds.length > 0);
    setEditingId(user.id);
    setAppliedProfileId('');
    setFormData({
      name: user.name,
      email: user.email,
      nickname: user.nickname,
      idNumeric: user.idNumeric,
      password: '',
      ativo: user.ativo,
      role: user.role as any,
      managedUserIds: user.managedUserIds || [],
      filiais_permitidas: user.filiais_permitidas || [],
      permissions: { ...(basePerms as object), carregamento_all_filiais: autoAllFiliais } as any,
    });
    setModalTab('dados');
    setModalOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (targetUser && !canDeleteUser(targetUser)) {
      showError('Você não tem permissão para excluir este usuário.');
      return;
    }
    const ok = await confirm({
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      showSuccess('Usuário excluído com sucesso!');
      await loadUsers();
    } catch {
      showError('Erro ao excluir usuário.');
    }
  };

  const handleNewUser = () => {
    resetForm();
    setModalTab('dados');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setModalOpen(false);
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const branchNames = (u.filiais_permitidas || [])
      .map((id) => branches.find((b) => b.id === id)?.name || '')
      .join(' ')
      .toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.nickname || '').toLowerCase().includes(q) ||
      getRoleLabel(u.role).toLowerCase().includes(q) ||
      branchNames.includes(q)
    );
  });

  // ---------------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------------
  const renderModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-emerald-600" />
            {editingId ? 'Editar Usuário' : 'Novo Usuário'}
          </h3>
          <button
            type="button"
            onClick={handleCloseModal}
            className="text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 px-6 flex-shrink-0">
          {(['dados', 'permissoes', 'filiais'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setModalTab(tab)}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${
                modalTab === tab
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab === 'dados' ? '📋 Dados' : tab === 'permissoes' ? '🔑 Permissões' : '🏭 Filiais'}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={saveUser} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* Tab: Dados */}
            {modalTab === 'dados' && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      E-mail <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      Usuário (Nickname) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Ex: joao.silva"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      Senha {!editingId && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required={!editingId}
                      placeholder={editingId ? 'Deixe em branco para manter' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">
                      Nível de Acesso
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value as any)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="user">Vendedor</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                      <option value="master">Master</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.ativo}
                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-stone-700">Conta Ativa</span>
                    </label>
                  </div>
                </div>

                {formData.role === 'manager' && (
                  <div className="pt-4 border-t border-stone-200">
                    <label className="block text-sm font-bold text-stone-600 mb-3">
                      Vendedores Gerenciados
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {users
                        .filter((u) => u.role === 'user' && u.id !== editingId)
                        .map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center space-x-2 p-2 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={formData.managedUserIds.includes(u.id)}
                              onChange={(e) => {
                                const newSelection = e.target.checked
                                  ? [...formData.managedUserIds, u.id]
                                  : formData.managedUserIds.filter((id) => id !== u.id);
                                setFormData({ ...formData, managedUserIds: newSelection });
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span
                              className="text-sm font-medium text-stone-700 truncate"
                              title={u.name}
                            >
                              {u.name}
                            </span>
                          </label>
                        ))}
                      {users.filter((u) => u.role === 'user' && u.id !== editingId).length ===
                        0 && (
                        <span className="text-sm text-stone-500 italic col-span-full">
                          Nenhum vendedor disponível
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Permissões */}
            {modalTab === 'permissoes' && (
              <div className="p-6 space-y-4">
                {accessProfiles.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <label className="block text-sm font-bold text-stone-600 mb-2 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Aplicar Perfil de Acesso
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={appliedProfileId}
                        onChange={(e) => handleApplyProfile(e.target.value)}
                        className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      >
                        <option value="">— Selecionar perfil —</option>
                        {accessProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.description ? ` — ${p.description}` : ''}
                          </option>
                        ))}
                      </select>
                      {appliedProfileId && (
                        <span className="text-xs text-emerald-700 bg-white border border-emerald-200 px-2 py-1 rounded font-medium">
                          ✓ Perfil:{' '}
                          <strong>
                            {accessProfiles.find((p) => p.id === appliedProfileId)?.name}
                          </strong>{' '}
                          — editável abaixo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">
                      Permissões preenchidas automaticamente. Ajuste individualmente antes de
                      salvar.
                    </p>
                  </div>
                )}

                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="border border-stone-200 rounded-xl overflow-hidden"
                  >
                    <div
                      className={`${group.headerClass} px-4 py-2 text-xs font-bold uppercase tracking-wider`}
                    >
                      {group.title}
                    </div>
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const val = !!(formData.permissions as any)[item.id];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                permissions: { ...formData.permissions, [item.id]: !val },
                              })
                            }
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-xs font-bold ${
                              val
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-stone-50 border-stone-200 text-stone-400'
                            }`}
                          >
                            {item.label}
                            <div
                              className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${val ? 'bg-emerald-500' : 'bg-stone-300'}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Credit Card */}
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
                    💳 Cartão de Crédito — Nível de Acesso
                  </div>
                  <div className="p-4">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                      Papel no módulo de Gastos
                    </label>
                    <select
                      value={(formData.permissions as any).creditCard || 'none'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, creditCard: e.target.value },
                        })
                      }
                      className="w-full sm:w-72 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="none">Sem acesso</option>
                      <option value="viewer">Visualizador — só visualiza</option>
                      <option value="launcher">Lançador — lança gastos</option>
                      <option value="checker">Conferente — lança e confere</option>
                      <option value="approver">Aprovador — lança, confere e aprova</option>
                      <option value="admin">Administrador — acesso total ao módulo</option>
                    </select>
                    <p className="mt-2 text-xs text-stone-400">
                      Controla o acesso ao módulo <strong>Gastos Cartão</strong> independente do
                      nível global.
                    </p>
                  </div>
                </div>

                {/* Carregamento filial access */}
                {(formData.permissions as any)?.carregamento && (
                  <div className="border border-amber-200 rounded-xl overflow-hidden">
                    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
                      🏭 Acesso por Filial — Módulo Carregamento
                    </div>
                    <div className="p-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!(formData.permissions as any)?.carregamento_all_filiais}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              permissions: {
                                ...formData.permissions,
                                carregamento_all_filiais: e.target.checked,
                                ...(e.target.checked ? { carregamento_filial_ids: [] } : {}),
                              },
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-xs font-semibold text-stone-700">
                          Acesso a todas as filiais
                        </span>
                      </label>
                      {branches.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <p className="col-span-2 text-xs text-stone-400">
                            — ou selecione as filiais permitidas —
                          </p>
                          {branches.map((b) => {
                            const isAllFiliais = !!(formData.permissions as any)
                              ?.carregamento_all_filiais;
                            const selectedIds: string[] =
                              (formData.permissions as any)?.carregamento_filial_ids ?? [];
                            const isSelected = selectedIds.includes(b.id);
                            return (
                              <label
                                key={b.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors ${
                                  isAllFiliais
                                    ? 'opacity-40 cursor-not-allowed border-stone-100 bg-stone-50'
                                    : isSelected
                                      ? 'cursor-pointer border-amber-400 bg-amber-50'
                                      : 'cursor-pointer border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isAllFiliais}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isAllFiliais) return;
                                    const current: string[] =
                                      (formData.permissions as any)?.carregamento_filial_ids ?? [];
                                    const updated = isSelected
                                      ? current.filter((id) => id !== b.id)
                                      : [...current, b.id];
                                    setFormData({
                                      ...formData,
                                      permissions: {
                                        ...formData.permissions,
                                        carregamento_filial_ids: updated,
                                      },
                                    });
                                  }}
                                  className="rounded"
                                />
                                <span>
                                  {b.id_numeric && (
                                    <span className="text-stone-400 text-xs font-mono mr-1">
                                      #{b.id_numeric}
                                    </span>
                                  )}
                                  {b.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Filiais */}
            {modalTab === 'filiais' && (
              <div className="p-6">
                <div className="mb-4">
                  <h4 className="font-bold text-stone-700 text-sm flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-stone-500" />
                    Filiais Permitidas
                  </h4>
                  <p className="text-xs text-stone-400">
                    Selecione as filiais que este usuário pode acessar. Deixe vazio para herdar de
                    "Ver Todas as Filiais" (aba Permissões).
                  </p>
                </div>
                {(formData.permissions as any)?.carregamento_all_filiais ? (
                  <p className="px-4 py-3 text-xs text-amber-600 font-medium bg-amber-50 rounded-lg border border-amber-200">
                    ⚠️ Este usuário já tem acesso a todas as filiais via permissão "Ver Todas as
                    Filiais" (aba Permissões).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {branches.length === 0 ? (
                      <p className="col-span-2 text-xs text-stone-400">
                        Nenhuma filial cadastrada.
                      </p>
                    ) : (
                      branches.map((b) => (
                        <label
                          key={b.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                            formData.filiais_permitidas.includes(b.id)
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.filiais_permitidas.includes(b.id)}
                            onChange={() => toggleFilial(b.id)}
                            className="rounded"
                          />
                          <span>
                            {b.id_numeric && (
                              <span className="text-stone-400 text-xs font-mono mr-1">
                                #{b.id_numeric}
                              </span>
                            )}
                            {b.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-3 bg-stone-50/50 flex-shrink-0">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-6 py-2 border border-stone-300 rounded-lg font-bold text-stone-600 hover:bg-stone-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2 rounded-lg font-bold transition-all shadow-md flex items-center text-sm"
            >
              {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {loading ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {modalOpen && renderModal()}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Usuários
          </h2>
          <button
            onClick={handleNewUser}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, cargo ou filial…"
            className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* User cards */}
      {loading && !users.length ? (
        <div className="text-center py-12 text-stone-400 italic text-sm">Carregando usuários…</div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">
            {searchQuery ? 'Nenhum usuário encontrado para a busca.' : 'Nenhum usuário cadastrado.'}
          </p>
          {!searchQuery && (
            <p className="text-stone-400 text-sm mt-1">
              Clique em <strong>Novo Usuário</strong> para criar o primeiro.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const initials = getInitials(user.name);
            const userBranches = (user.filiais_permitidas || [])
              .map((id) => branches.find((b) => b.id === id)?.name)
              .filter(Boolean) as string[];

            return (
              <div
                key={user.id}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-all hover:shadow-md cursor-pointer ${
                  !user.ativo
                    ? 'opacity-60 grayscale border-stone-200'
                    : 'border-stone-200 hover:border-emerald-200'
                }`}
                onClick={() => startEdit(user)}
              >
                {/* Avatar + name + role */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${getAvatarBg(user.role)}`}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-800 truncate">{user.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0 ${getRoleBadgeClass(user.role)}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">{user.email}</p>
                    {user.nickname && <p className="text-xs text-stone-400">@{user.nickname}</p>}
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${user.ativo ? 'bg-emerald-500' : 'bg-red-400'}`}
                    title={user.ativo ? 'Ativo' : 'Inativo'}
                  />
                </div>

                {/* Branches */}
                {userBranches.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {userBranches.slice(0, 3).map((name) => (
                      <span
                        key={name}
                        className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] font-medium border border-stone-200 flex items-center gap-1"
                      >
                        <Building2 className="w-2.5 h-2.5" />
                        {name}
                      </span>
                    ))}
                    {userBranches.length > 3 && (
                      <span className="px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded text-[10px] font-medium border border-stone-200">
                        +{userBranches.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions row */}
                <div
                  className="flex justify-end gap-1 pt-1 border-t border-stone-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-stone-400 mr-auto self-center font-mono">
                    #{user.idNumeric}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(user);
                    }}
                    disabled={!canEditUser(user)}
                    className={`p-1.5 rounded transition-colors ${canEditUser(user) ? 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-stone-200 cursor-not-allowed'}`}
                    title={canEditUser(user) ? 'Editar' : 'Sem permissão para editar'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(user.id);
                    }}
                    disabled={!canDeleteUser(user)}
                    className={`p-1.5 rounded transition-colors ${canDeleteUser(user) ? 'text-stone-400 hover:text-red-500 hover:bg-red-50' : 'text-stone-200 cursor-not-allowed'}`}
                    title={canDeleteUser(user) ? 'Excluir' : 'Sem permissão para excluir'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
