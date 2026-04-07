import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Building2, Edit2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { Branch, User } from '../types';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    const data = await getBranches();
    setBranches(data);
    setLoading(false);
  };

  const saveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
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
    } catch (err) {
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
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
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
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Nome da Filial
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
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
    </div>
  );
}
