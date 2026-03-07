import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Building2, Edit2 } from 'lucide-react';
import { Branch, User } from '../types';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../services/db';
import { useToast } from './Toast';

export default function BranchManager({ currentUser }: { currentUser: User }) {
  const canCreate = currentUser.role === 'master' || currentUser.role === 'admin' || (currentUser.permissions as any)?.branches_create;
  const canEdit = currentUser.role === 'master' || currentUser.role === 'admin' || (currentUser.permissions as any)?.branches_edit;
  const canDelete = currentUser.role === 'master' || currentUser.role === 'admin' || (currentUser.permissions as any)?.branches_delete;
  const { showSuccess, showError } = useToast();
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
    if (!branchName) return;
    setLoading(true);

    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, { name: branchName });
        showSuccess('Filial atualizada com sucesso!');
      } else {
        await createBranch({ name: branchName });
        showSuccess('Filial salva com sucesso!');
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

  const handleDeleteBranch = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta filial? Isso pode afetar listas de preços vinculadas.')) {
      try {
        await deleteBranch(id);
        showSuccess('Filial excluída com sucesso!');
        await loadBranches();
      } catch {
        showError('Erro ao excluir filial.');
      }
    }
  };

  const startEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
  };

  return (
    <div className="space-y-6">
      {canCreate && !editingBranch || canEdit && editingBranch ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-stone-600" />
            {editingBranch ? 'Editar Filial' : 'Cadastrar Nova Filial'}
          </h2>

        <form onSubmit={saveBranch} className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-600 mb-1">Nome da Filial</label>
            <input
              type="text"
              value={branchName || ''}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-500"
              placeholder="Ex: Filial Mato Grosso..."
              required
            />
          </div>
          <div className="flex items-end gap-2">
            {editingBranch && (
              <button
                type="button"
                onClick={() => {
                  setEditingBranch(null);
                  setBranchName('');
                }}
                className="px-6 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-stone-800 hover:bg-stone-900 disabled:bg-stone-400 text-white px-8 py-2 rounded-lg font-bold transition-colors flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : editingBranch ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
      ) : null}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h3 className="text-lg font-bold text-stone-800 mb-4">Filiais Ativas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div key={branch.id} className="p-4 border border-stone-200 rounded-xl flex justify-between items-center hover:border-stone-400 transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-medium text-stone-800">{branch.name}</span>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={() => startEdit(branch)}
                    className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {branches.length === 0 && !loading && (
            <div className="col-span-full py-8 text-center text-stone-400 italic">
              Nenhuma filial cadastrada.
            </div>
          )}
          {loading && (
            <div className="col-span-full py-8 text-center text-stone-400">
              Carregando...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
