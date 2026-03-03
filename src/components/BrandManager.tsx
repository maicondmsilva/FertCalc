import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Tag, Edit2 } from 'lucide-react';
import { Brand } from '../types';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../services/db';
import { useToast } from './Toast';

export default function BrandManager() {
  const { showSuccess, showError } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  useEffect(() => { loadBrands(); }, []);

  const loadBrands = async () => {
    setLoading(true);
    const data = await getBrands();
    setBrands(data);
    setLoading(false);
  };

  const getNextCode = (brandList: Brand[]): string => {
    if (brandList.length === 0) return '1';
    const nums = brandList.map(b => parseInt(b.code, 10)).filter(n => !isNaN(n));
    return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Nome da marca é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, { name: name.trim(), code: editingBrand.code });
        showSuccess('Marca atualizada com sucesso!');
        setEditingBrand(null);
      } else {
        const code = getNextCode(brands);
        await createBrand({ code, name: name.trim() });
        showSuccess('Marca salva com sucesso!');
      }
      setName('');
      await loadBrands();
    } catch (err: any) {
      showError('Erro ao salvar marca. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
  };

  const cancelEdit = () => {
    setEditingBrand(null);
    setName('');
  };

  const removeBrand = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta marca? Ela pode estar vinculada a produtos.')) return;
    try {
      await deleteBrand(id);
      showSuccess('Marca excluída com sucesso!');
      await loadBrands();
    } catch {
      showError('Erro ao excluir marca.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
          <Tag className="w-5 h-5 mr-2 text-indigo-600" />
          {editingBrand ? 'Editar Marca' : 'Cadastro de Marcas de Produtos'}
        </h2>

        <div className="flex gap-4 mb-8">
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-600 mb-1">Nome da Marca</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Yara, Mosaic, Heringer..."
            />
          </div>
          <div className="flex items-end gap-2">
            {editingBrand && (
              <button
                onClick={cancelEdit}
                className="border border-stone-300 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors font-medium"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : editingBrand ? 'Atualizar' : 'Cadastrar Marca'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 w-24">Cód.</th>
                <th className="px-4 py-3">Nome da Marca</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-stone-400">Carregando...</td></tr>
              )}
              {!loading && brands.map(brand => (
                <tr key={brand.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-indigo-600 font-bold">{brand.code}</td>
                  <td className="px-4 py-3 text-stone-800 font-medium">{brand.name}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startEdit(brand)}
                      className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeBrand(brand.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && brands.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-stone-400 italic">
                    Nenhuma marca cadastrada.
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
