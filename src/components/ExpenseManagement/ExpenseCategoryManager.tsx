import React, { useState, useEffect } from 'react';
import { ExpenseCategory } from '../../types/expense.types';
import { getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from '../../services/expenseService';
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react';

interface ExpenseCategoryManagerProps {
  onCategoriesChanged?: () => void;
}

export default function ExpenseCategoryManager({ onCategoriesChanged }: ExpenseCategoryManagerProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getExpenseCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setName('');
    setBudgetLimit('');
    setColor('#8b5cf6');
    setActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (category: ExpenseCategory) => {
    setEditingId(category.id);
    setName(category.name);
    setBudgetLimit(category.budgetLimit != null ? String(category.budgetLimit) : '');
    setColor(category.color || '#8b5cf6');
    setActive(category.active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateExpenseCategory(editingId, {
          name: name.trim(),
          budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
          color,
          active,
        });
      } else {
        await createExpenseCategory({
          name: name.trim(),
          budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
          color,
          active: true,
        });
      }
      await loadCategories();
      onCategoriesChanged?.();
      resetForm();
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir esta categoria? Gastos vinculados não serão excluídos.')) return;
    try {
      await deleteExpenseCategory(id);
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-stone-800">Categorias de Gastos</h3>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Categoria
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h4 className="text-sm font-bold text-stone-700 mb-4">
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Nome *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Alimentação"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Limite Orçamentário (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder="Sem limite"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Cor</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200"
                />
                <span className="text-sm text-stone-500">{color}</span>
              </div>
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Ativa</label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-500 rounded-lg hover:bg-stone-100"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="text-lg font-bold">Nenhuma categoria cadastrada</p>
          <p className="text-sm mt-1">Crie a primeira categoria para começar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Cor</th>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Nome</th>
                <th className="text-right py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Limite</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color || '#8b5cf6' }} />
                  </td>
                  <td className="py-3 px-4 font-medium text-stone-800">{cat.name}</td>
                  <td className="py-3 px-4 text-right text-stone-600">
                    {cat.budgetLimit != null
                      ? cat.budgetLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${cat.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
