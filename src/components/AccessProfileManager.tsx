import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ShieldCheck } from 'lucide-react';
import {
  AccessProfile,
  getAccessProfiles,
  createAccessProfile,
  updateAccessProfile,
  deleteAccessProfile,
} from '../services/accessProfileService';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';

// ---------------------------------------------------------------------------
// Estrutura de módulos agrupados por área (espelha o UserManager)
// ---------------------------------------------------------------------------
interface PermissionItem {
  id: string;
  label: string;
}

interface PermissionGroup {
  title: string;
  color: string;
  headerClass: string;
  items: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: '📊 Painel',
    color: 'emerald',
    headerClass: 'bg-emerald-700 text-white',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'goals', label: 'Metas' },
      { id: 'managementReports', label: 'Rel. Gerenciais' },
    ],
  },
  {
    title: '🧮 Precificação',
    color: 'blue',
    headerClass: 'bg-blue-700 text-white',
    items: [
      { id: 'calculator', label: 'Calculadora' },
      { id: 'history', label: 'Situação / Precificações' },
      { id: 'savedFormulas', label: 'Fórmulas Salvas' },
      { id: 'pricingBySeller', label: 'Precificação por Vendedor' },
      { id: 'calculator_savePricing', label: 'Salvar Precificação' },
      { id: 'calculator_generatePDF', label: 'Gerar PDF' },
      { id: 'calculator_saveFormula', label: 'Salvar Fórmula' },
      { id: 'calculator_profitabilityCheck', label: 'Análise de Rentabilidade' },
      { id: 'history_changeStatus', label: 'Alterar Status' },
      { id: 'history_editPricing', label: 'Editar Precificação Existente' },
    ],
  },
  {
    title: '✅ Aprovações',
    color: 'teal',
    headerClass: 'bg-teal-700 text-white',
    items: [
      { id: 'approvals', label: 'Aprovações' },
      { id: 'approvals_canApprove', label: 'Aprovar / Reprovar' },
    ],
  },
  {
    title: '💳 Financeiro / Cartão',
    color: 'purple',
    headerClass: 'bg-purple-700 text-white',
    items: [{ id: 'expenses', label: 'Gastos Cartão' }],
  },
  {
    title: '🚛 Logística',
    color: 'amber',
    headerClass: 'bg-amber-600 text-white',
    items: [
      { id: 'carregamento', label: 'Carregamento (Visualizar)' },
      { id: 'carregamento_solicitar_cotacao', label: 'Solicitar Cotação' },
      { id: 'carregamento_liberar', label: 'Liberar Carregamento' },
      { id: 'carregamento_logistica', label: 'Painel de Logística' },
      { id: 'carregamento_relatorios', label: 'Relatórios Carregamento' },
      { id: 'carregamento_cancelar', label: 'Cancelar Carregamentos' },
      { id: 'carregamento_all_filiais', label: 'Ver Todas as Filiais' },
      { id: 'carregamento_configurar_filiais', label: 'Configurar Filiais do Carregamento' },
      { id: 'carregamento_admin', label: 'Admin do Módulo' },
    ],
  },
  {
    title: '📋 Relatórios',
    color: 'indigo',
    headerClass: 'bg-indigo-700 text-white',
    items: [
      { id: 'reports', label: 'Relatórios' },
      { id: 'pricingReport', label: 'Rel. Precificação' },
      { id: 'commissionReport', label: 'Rel. Comissão' },
    ],
  },
  {
    title: '🗄️ Cadastros',
    color: 'rose',
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
      { id: 'micro', label: 'Materiais Micro' },
      { id: 'prd', label: 'Documentação PRD' },
    ],
  },
  {
    title: '⚙️ Configurações',
    color: 'stone',
    headerClass: 'bg-stone-700 text-white',
    items: [
      { id: 'branches', label: 'Filiais' },
      { id: 'settings', label: 'Personalização' },
      { id: 'users', label: 'Usuários' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyPermissions(): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  PERMISSION_GROUPS.forEach((g) =>
    g.items.forEach((item) => {
      perms[item.id] = false;
    })
  );
  return perms;
}

function countEnabled(permissions: Record<string, boolean | string>): number {
  return Object.values(permissions).filter((v) => v === true).length;
}

// ---------------------------------------------------------------------------
// Modal de criação / edição
// ---------------------------------------------------------------------------
interface ProfileModalProps {
  initial: AccessProfile | null;
  onSave: (name: string, description: string, permissions: Record<string, boolean>) => void;
  onClose: () => void;
  saving: boolean;
}

function ProfileModal({ initial, onSave, onClose, saving }: ProfileModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
    const base = emptyPermissions();
    if (initial?.permissions) {
      Object.entries(initial.permissions).forEach(([k, v]) => {
        if (typeof v === 'boolean') base[k] = v;
      });
    }
    return base;
  });

  const toggle = (id: string) => setPermissions((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim(), permissions);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            {initial ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Nome do Perfil <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Ex: Vendedor, Financeiro, Logística…"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Descrição breve do perfil"
              />
            </div>
          </div>

          {/* Permission groups */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Permissões — selecione os módulos que este perfil deve ter acesso
            </p>
            {PERMISSION_GROUPS.map((group) => (
              <div
                key={group.title}
                className={`border border-stone-200 rounded-xl overflow-hidden`}
              >
                <div
                  className={`${group.headerClass} px-4 py-2 text-xs font-bold uppercase tracking-wider`}
                >
                  {group.title}
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-xs font-bold ${
                        permissions[item.id]
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-400'
                      }`}
                    >
                      {item.label}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${permissions[item.id] ? 'bg-emerald-500' : 'bg-stone-300'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-stone-300 rounded-lg font-bold text-stone-600 hover:bg-stone-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2 rounded-lg font-bold transition-all shadow-md flex items-center text-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando…' : initial ? 'Salvar Alterações' : 'Criar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccessProfileManager — componente principal
// ---------------------------------------------------------------------------
export default function AccessProfileManager() {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessProfile | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    const data = await getAccessProfiles();
    setProfiles(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (profile: AccessProfile) => {
    setEditing(profile);
    setModalOpen(true);
  };

  const handleSave = async (
    name: string,
    description: string,
    permissions: Record<string, boolean>
  ) => {
    setSaving(true);
    try {
      if (editing) {
        await updateAccessProfile(editing.id, { name, description, permissions });
        showSuccess('Perfil atualizado com sucesso!');
      } else {
        await createAccessProfile({ name, description, permissions });
        showSuccess('Perfil criado com sucesso!');
      }
      setModalOpen(false);
      setEditing(null);
      await loadProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      showError(`Erro ao salvar perfil: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profile: AccessProfile) => {
    const ok = await confirm({
      title: 'Excluir Perfil',
      message: `Tem certeza que deseja excluir o perfil "${profile.name}"? Esta ação não pode ser desfeita.`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAccessProfile(profile.id);
      showSuccess('Perfil excluído com sucesso!');
      await loadProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      showError(`Erro ao excluir perfil: ${msg}`);
    }
  };

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

      {modalOpen && (
        <ProfileModal
          initial={editing}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          saving={saving}
        />
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Perfis de Acesso
          </h2>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Novo Perfil
          </button>
        </div>
        <p className="text-sm text-stone-500">
          Crie e gerencie modelos de permissões que podem ser aplicados rapidamente ao cadastrar
          usuários.
        </p>
      </div>

      {/* Profile cards */}
      {loading ? (
        <div className="text-center py-12 text-stone-400 italic text-sm">Carregando perfis…</div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Nenhum perfil de acesso cadastrado.</p>
          <p className="text-stone-400 text-sm mt-1">
            Clique em <strong>Novo Perfil</strong> para criar o primeiro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((profile) => {
            const enabled = countEnabled(profile.permissions);
            const total = Object.keys(profile.permissions).length;
            return (
              <div
                key={profile.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-800 text-base">{profile.name}</h3>
                    {profile.description && (
                      <p className="text-xs text-stone-500 mt-0.5">{profile.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(profile)}
                      className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                      title="Editar perfil"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(profile)}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                      title="Excluir perfil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-xs text-stone-500">
                  <span className="font-bold text-emerald-600">{enabled}</span> de{' '}
                  <span className="font-bold">{total}</span> permissões ativas
                </div>

                {/* Permission chips */}
                <div className="flex flex-wrap gap-1">
                  {PERMISSION_GROUPS.flatMap((g) => g.items)
                    .filter((item) => profile.permissions[item.id] === true)
                    .slice(0, 8)
                    .map((item) => (
                      <span
                        key={item.id}
                        className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium border border-emerald-200"
                      >
                        {item.label}
                      </span>
                    ))}
                  {enabled > 8 && (
                    <span className="px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded text-[10px] font-medium border border-stone-200">
                      +{enabled - 8} mais
                    </span>
                  )}
                  {enabled === 0 && (
                    <span className="text-xs text-stone-400 italic">Sem permissões ativas</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
