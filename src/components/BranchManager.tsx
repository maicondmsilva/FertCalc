import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Building2,
  Edit2,
  X,
  ToggleLeft,
  ToggleRight,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Branch, User } from '../types';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useFormValidation, validationRules, ValidationSchema } from '../hooks/useFormValidation';
import { ValidatedInput } from './ui/ValidatedInput';
import { LocalCarregamento } from '../types/carregamento';
import {
  getLocaisCarregamento,
  createLocalCarregamento,
  updateLocalCarregamento,
  deleteLocalCarregamento,
} from '../services/locaisCarregamentoService';

const ESTADOS_BR = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

const branchValidationSchema: ValidationSchema = {
  name: {
    required: true,
    rules: [validationRules.minLength(2)],
  },
};

export default function BranchManager({ currentUser }: { currentUser: User }) {
  const canCreate =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.branches_create;
  const canEdit =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.branches_edit;
  const canDelete =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.branches_delete;

  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const { errors, touched, validateAll, handleBlur, handleChange, clearAllErrors } =
    useFormValidation(branchValidationSchema);

  // ── Filiais ──────────────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Locais de Carregamento ───────────────────────────────────
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [loadingLocais, setLoadingLocais] = useState(false);
  const [filtroFilialLocais, setFiltroFilialLocais] = useState('');
  const [showModalLocal, setShowModalLocal] = useState(false);
  const [editingLocal, setEditingLocal] = useState<LocalCarregamento | null>(null);
  const [formLocal, setFormLocal] = useState({
    nome: '',
    filial_id: '',
    endereco: '',
    cidade: '',
    estado: '',
    maps_url: '',
    ativo: true,
  });
  const [savingLocal, setSavingLocal] = useState(false);

  const loadBranches = async () => {
    setLoading(true);
    const data = await getBranches();
    setBranches(data);
    setLoading(false);
  };

  const loadLocais = useCallback(async () => {
    setLoadingLocais(true);
    const data = await getLocaisCarregamento(filtroFilialLocais || undefined);
    setLocais(data);
    setLoadingLocais(false);
  }, [filtroFilialLocais]);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadLocais();
  }, [loadLocais]);

  // ── Filiais handlers ─────────────────────────────────────────
  const saveBranch = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateAll({ name: branchName });
    if (!isValid) {
      showError('Por favor, corrija os erros no formulário.');
      return;
    }

    setLoading(true);
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, { name: branchName.trim() });
        showSuccess('Filial atualizada com sucesso!');
      } else {
        await createBranch({ name: branchName.trim() });
        showSuccess('Filial cadastrada com sucesso!');
      }
      await loadBranches();
      setBranchName('');
      setEditingBranch(null);
      clearAllErrors();
    } catch {
      showError('Erro ao salvar filial. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAtivo = async (branch: Branch) => {
    if (!canEdit) return;
    try {
      await updateBranch(branch.id, { ativo: !branch.ativo });
      await loadBranches();
      showSuccess(`Filial ${!branch.ativo ? 'ativada' : 'desativada'} com sucesso!`);
    } catch {
      showError('Erro ao alterar status da filial.');
    }
  };

  const handleDeleteBranch = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir filial?',
      message:
        'Isso pode afetar listas de preços e relatórios vinculados. Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteBranch(id);
      showSuccess('Filial excluída com sucesso!');
      await loadBranches();
    } catch {
      showError('Erro ao excluir filial.');
    }
  };

  const startEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
  };

  const cancelEdit = () => {
    setEditingBranch(null);
    setBranchName('');
    clearAllErrors();
  };

  // ── Locais handlers ──────────────────────────────────────────
  const resetFormLocal = () => {
    setFormLocal({
      nome: '',
      filial_id: '',
      endereco: '',
      cidade: '',
      estado: '',
      maps_url: '',
      ativo: true,
    });
  };

  const openNewLocal = () => {
    setEditingLocal(null);
    resetFormLocal();
    setShowModalLocal(true);
  };

  const openEditLocal = (local: LocalCarregamento) => {
    setEditingLocal(local);
    setFormLocal({
      nome: local.nome,
      filial_id: local.filial_id ?? '',
      endereco: local.endereco ?? '',
      cidade: local.cidade ?? '',
      estado: local.estado ?? '',
      maps_url: local.maps_url ?? '',
      ativo: local.ativo,
    });
    setShowModalLocal(true);
  };

  const closeModalLocal = () => {
    setShowModalLocal(false);
    setEditingLocal(null);
    resetFormLocal();
  };

  const saveLocal = async () => {
    if (!formLocal.nome.trim()) {
      showError('Nome é obrigatório.');
      return;
    }
    if (!formLocal.filial_id) {
      showError('Filial é obrigatória.');
      return;
    }
    setSavingLocal(true);
    try {
      if (editingLocal) {
        await updateLocalCarregamento(editingLocal.id, formLocal);
        showSuccess('Local atualizado com sucesso!');
      } else {
        await createLocalCarregamento(formLocal);
        showSuccess('Local cadastrado com sucesso!');
      }
      setShowModalLocal(false);
      setEditingLocal(null);
      resetFormLocal();
      await loadLocais();
    } catch {
      showError('Erro ao salvar local. Tente novamente.');
    } finally {
      setSavingLocal(false);
    }
  };

  const handleToggleAtivoLocal = async (local: LocalCarregamento) => {
    if (!canEdit) return;
    try {
      await updateLocalCarregamento(local.id, { ativo: !local.ativo });
      await loadLocais();
      showSuccess(`Local ${!local.ativo ? 'ativado' : 'desativado'} com sucesso!`);
    } catch {
      showError('Erro ao alterar status do local.');
    }
  };

  const handleDeleteLocal = async (local: LocalCarregamento) => {
    const ok = await confirm({
      title: 'Excluir local de carregamento?',
      message: 'Isso pode afetar carregamentos vinculados. Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteLocalCarregamento(local.id);
      showSuccess('Local excluído com sucesso!');
      await loadLocais();
    } catch {
      showError('Erro ao excluir local.');
    }
  };

  const locaisFiltrados = filtroFilialLocais
    ? locais.filter((l) => l.filial_id === filtroFilialLocais)
    : locais;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      {/* ── SEÇÃO 1: Filiais ──────────────────────────────────── */}
      {(canCreate && !editingBranch) || (canEdit && editingBranch) ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-emerald-600" />
            {editingBranch
              ? `Editar Filial — ${editingBranch.id_numeric}`
              : 'Cadastrar Nova Filial'}
          </h2>
          <form onSubmit={saveBranch} className="flex gap-4 items-end">
            <div className="flex-1">
              <ValidatedInput
                label="Nome da Filial"
                type="text"
                value={branchName}
                error={errors.name}
                touched={touched.name}
                onChange={(value) => {
                  setBranchName(value);
                  handleChange('name', value);
                }}
                onBlur={() => handleBlur('name', branchName)}
                placeholder="Ex: Filial Mato Grosso..."
                required
              />
            </div>
            <div className="flex gap-2">
              {editingBranch && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1 font-medium"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : editingBranch ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-stone-500" />
            Filiais Cadastradas
          </h3>
          <span className="text-xs text-stone-400 font-medium">{branches.length} filial(is)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-100">
              <tr>
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Nome da Filial</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {branches.map((branch) => (
                <tr
                  key={branch.id}
                  className={`hover:bg-stone-50 transition-colors ${!branch.ativo ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm">
                      {branch.id_numeric}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-stone-800">{branch.name}</p>
                    <p className="text-[10px] text-stone-400 font-mono mt-0.5">{branch.id}</p>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => handleToggleAtivo(branch)}
                      disabled={!canEdit}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all disabled:cursor-not-allowed"
                      style={{
                        background: branch.ativo ? 'rgb(209 250 229)' : 'rgb(243 244 246)',
                        color: branch.ativo ? 'rgb(6 95 70)' : 'rgb(107 114 128)',
                        border: `1px solid ${branch.ativo ? 'rgb(167 243 208)' : 'rgb(229 231 235)'}`,
                      }}
                      title={
                        canEdit
                          ? branch.ativo
                            ? 'Clique para desativar'
                            : 'Clique para ativar'
                          : ''
                      }
                    >
                      {branch.ativo ? (
                        <>
                          <ToggleRight className="w-3 h-3" /> Ativa
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3 h-3" /> Inativa
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => startEdit(branch)}
                          className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Editar nome"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteBranch(branch.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir filial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-stone-400 italic">
                    Nenhuma filial cadastrada.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-stone-400">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SEÇÃO 2: Locais de Carregamento ──────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between gap-3">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-stone-500" />
            Locais de Carregamento
          </h3>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={filtroFilialLocais}
              onChange={(e) => setFiltroFilialLocais(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 text-stone-600 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas as filiais</option>
              {branches
                .filter((b) => b.ativo)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            {canCreate && (
              <button
                onClick={openNewLocal}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Local
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-100">
              <tr>
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Filial</th>
                <th className="px-5 py-3">Endereço</th>
                <th className="px-5 py-3">Cidade/Estado</th>
                <th className="px-5 py-3 text-center">Maps</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {locaisFiltrados.map((local) => {
                const filialNome = branches.find((b) => b.id === local.filial_id)?.name ?? '—';
                const cidadeEstado =
                  local.cidade && local.estado
                    ? `${local.cidade} / ${local.estado}`
                    : local.cidade || local.estado || '—';
                return (
                  <tr
                    key={local.id}
                    className={`hover:bg-stone-50 transition-colors ${!local.ativo ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm">
                        {local.id_numeric}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-stone-800">{local.nome}</p>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{filialNome}</td>
                    <td className="px-5 py-3 text-stone-500">{local.endereco || '—'}</td>
                    <td className="px-5 py-3 text-stone-500">{cidadeEstado}</td>
                    <td className="px-5 py-3 text-center">
                      {local.maps_url ? (
                        <a
                          href={local.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          🗺️ Abrir
                        </a>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleToggleAtivoLocal(local)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all disabled:cursor-not-allowed"
                        style={{
                          background: local.ativo ? 'rgb(209 250 229)' : 'rgb(243 244 246)',
                          color: local.ativo ? 'rgb(6 95 70)' : 'rgb(107 114 128)',
                          border: `1px solid ${local.ativo ? 'rgb(167 243 208)' : 'rgb(229 231 235)'}`,
                        }}
                        title={
                          canEdit
                            ? local.ativo
                              ? 'Clique para desativar'
                              : 'Clique para ativar'
                            : ''
                        }
                      >
                        {local.ativo ? (
                          <>
                            <ToggleRight className="w-3 h-3" /> Ativo
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-3 h-3" /> Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {canEdit && (
                          <button
                            onClick={() => openEditLocal(local)}
                            className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Editar local"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteLocal(local)}
                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir local"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {locaisFiltrados.length === 0 && !loadingLocais && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-stone-400 italic">
                    Nenhum local de carregamento cadastrado.
                  </td>
                </tr>
              )}
              {loadingLocais && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-stone-400">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Local de Carregamento ──────────────────────── */}
      {showModalLocal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                {editingLocal
                  ? `Editar Local #${editingLocal.id_numeric}`
                  : 'Novo Local de Carregamento'}
              </h2>
              <button
                onClick={closeModalLocal}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formLocal.nome}
                  onChange={(e) => setFormLocal((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do local..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Filial <span className="text-red-500">*</span>
                </label>
                <select
                  value={formLocal.filial_id}
                  onChange={(e) => setFormLocal((f) => ({ ...f, filial_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                >
                  <option value="">Selecione a filial...</option>
                  {branches
                    .filter((b) => b.ativo)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={formLocal.endereco}
                  onChange={(e) => setFormLocal((f) => ({ ...f, endereco: e.target.value }))}
                  placeholder="Endereço completo..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formLocal.cidade}
                    onChange={(e) => setFormLocal((f) => ({ ...f, cidade: e.target.value }))}
                    placeholder="Cidade..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Estado
                  </label>
                  <select
                    value={formLocal.estado}
                    onChange={(e) => setFormLocal((f) => ({ ...f, estado: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="">UF...</option>
                    {ESTADOS_BR.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  🗺️ Link Google Maps
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formLocal.maps_url}
                    onChange={(e) => setFormLocal((f) => ({ ...f, maps_url: e.target.value }))}
                    placeholder="https://maps.google.com/..."
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                  {formLocal.maps_url && (
                    <a
                      href={formLocal.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 border border-stone-300 rounded-lg text-stone-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                      title="Abrir link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Status
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormLocal((f) => ({ ...f, ativo: true }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${formLocal.ativo ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                  >
                    ● Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormLocal((f) => ({ ...f, ativo: false }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${!formLocal.ativo ? 'bg-stone-100 border-stone-300 text-stone-600' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                  >
                    ○ Inativo
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-stone-100">
              <button
                onClick={closeModalLocal}
                className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveLocal}
                disabled={savingLocal}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 text-sm shadow-sm"
              >
                <Save className="w-4 h-4" />
                {savingLocal ? 'Salvando...' : '💾 Salvar Local'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
