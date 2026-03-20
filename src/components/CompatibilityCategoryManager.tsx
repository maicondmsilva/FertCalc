import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Save, X, List, GripVertical } from 'lucide-react';
import { CompatibilityCategory } from '../types';
import { getCompatibilityCategories, createCompatibilityCategory, updateCompatibilityCategory, deleteCompatibilityCategory } from '../services/db';
import { useToast } from './Toast';

export default function CompatibilityCategoryManager() {
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState<CompatibilityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCompatibilityCategories();
      setCategories(data);
    } catch (err) {
      showError('Erro ao carregar categorias.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.ordem)) : 0;
      await createCompatibilityCategory({
        nome: newCategoryName.trim(),
        ordem: maxOrder + 1,
        ativo: true
      });
      setNewCategoryName('');
      loadCategories();
      showSuccess('Categoria criada com sucesso!');
    } catch (err) {
      showError('Erro ao criar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    setSaving(true);
    try {
      await updateCompatibilityCategory(id, { nome: editingName.trim() });
      setEditingId(null);
      loadCategories();
      showSuccess('Categoria atualizada!');
    } catch (err) {
      showError('Erro ao atualizar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover a categoria "${name}"?`)) return;
    try {
      await deleteCompatibilityCategory(id);
      loadCategories();
      showSuccess('Categoria removida.');
    } catch (err) {
      showError('Erro ao remover categoria.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
      <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
        <List className="w-5 h-5 text-blue-600" />
        Categorias de Produtos
      </h2>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nome da nova categoria..."
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newCategoryName.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-stone-400">Carregando categorias...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-stone-400 italic">Nenhuma categoria cadastrada.</div>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200 group">
              <GripVertical className="w-4 h-4 text-stone-300 cursor-grab" />
              
              {editingId === cat.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                  />
                  <button onClick={() => handleUpdate(cat.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-stone-400 hover:bg-stone-100 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-medium text-stone-700">{cat.nome}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.nome);
                      }}
                      className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.nome)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <p className="mt-6 text-xs text-stone-400 italic">
        Essas categorias são usadas para agrupar matérias-primas e filtrar a otimização no Modal Fertigran P.
      </p>
    </div>
  );
}
