import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FlaskConical, Eye, Edit3 } from 'lucide-react';
import { MicroMaterial, MicroGuarantee, User } from '../types';
import { getMicroMaterials, createMicroMaterial, updateMicroMaterial, deleteMicroMaterial } from '../services/db';
import { useToast } from './Toast';

interface MicroManagerProps {
  currentUser: User;
}

export default function MicroManager({ currentUser }: MicroManagerProps) {
  const { showSuccess, showError } = useToast();
  const [micros, setMicros] = useState<MicroMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [formulaSuffix, setFormulaSuffix] = useState('');
  const [guarantees, setGuarantees] = useState<MicroGuarantee[]>([]);
  const [categories, setCategories] = useState<('phosphated' | 'nitrogenous')[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getMicroMaterials();
    setMicros(data);
    setLoading(false);
  };

  const addGuarantee = () => setGuarantees([...guarantees, { name: '', value: 0 }]);
  const updateGuarantee = (i: number, field: keyof MicroGuarantee, value: any) => {
    const u = [...guarantees]; u[i] = { ...u[i], [field]: value }; setGuarantees(u);
  };
  const removeGuarantee = (i: number) => setGuarantees(guarantees.filter((_, idx) => idx !== i));

  const cancelEdit = () => { setName(''); setFormulaSuffix(''); setGuarantees([]); setCategories([]); setEditingId(null); setViewMode(false); };

  const handleCategoryChange = (category: 'phosphated' | 'nitrogenous', checked: boolean) => {
    if (checked) setCategories([...categories, category]);
    else setCategories(categories.filter(c => c !== category));
  };

  const handleEdit = (micro: MicroMaterial) => {
    setName(micro.name); setFormulaSuffix(micro.formulaSuffix || ''); setGuarantees(micro.microGuarantees); setCategories(micro.categories || []);
    setEditingId(micro.id); setViewMode(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleView = (micro: MicroMaterial) => {
    setName(micro.name); setFormulaSuffix(micro.formulaSuffix || ''); setGuarantees(micro.microGuarantees); setCategories(micro.categories || []);
    setEditingId(micro.id); setViewMode(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMicro = async () => {
    const canEdit = (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.micro_edit !== false;
    if (!canEdit) {
      showError('Você não tem permissão para salvar alterações.');
      return;
    }
    if (!name) return;
    setLoading(true);
    try {
      if (editingId) {
        await updateMicroMaterial(editingId, { name, formulaSuffix, microGuarantees: guarantees, categories });
        showSuccess('Micronutriente atualizado com sucesso!');
      } else {
        await createMicroMaterial({ code: Date.now().toString(), name, formulaSuffix, microGuarantees: guarantees, categories });
        showSuccess('Micronutriente salvo com sucesso!');
      }
      await loadData();
      cancelEdit();
    } catch {
      showError('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const removeMicro = async (id: string) => {
    const canDelete = (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.micro_delete !== false;
    if (!canDelete) {
      showError('Você não tem permissão para excluir itens.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este micronutriente? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteMicroMaterial(id);
      showSuccess('Micronutriente excluído com sucesso!');
      await loadData();
    } catch {
      showError('Erro ao excluir.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
          <FlaskConical className="w-5 h-5 mr-2 text-emerald-600" />
          {editingId ? (viewMode ? 'Visualizar Micronutriente' : 'Editar Micronutriente') : 'Cadastro de Micronutrientes'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Nome do Micronutriente</label>
              <input type="text" value={name} disabled={viewMode} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-500" placeholder="Ex: Zinco Sulfato, Boro..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1" title="Sufixo que será adicionado ao nome da fórmula quando essa matéria prima for usada">Sufixo Fórmul./Batida</label>
              <input type="text" value={formulaSuffix} disabled={viewMode} onChange={(e) => setFormulaSuffix(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-500" placeholder="Ex: C/ ZN" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">Categorias de Compatibilidade</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={categories.includes('phosphated')} onChange={(e) => handleCategoryChange('phosphated', e.target.checked)} disabled={viewMode} className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50" />
                  <span className="text-sm text-stone-700">Fosfatada</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={categories.includes('nitrogenous')} onChange={(e) => handleCategoryChange('nitrogenous', e.target.checked)} disabled={viewMode} className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50" />
                  <span className="text-sm text-stone-700">Nitrogenada</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              {editingId && <button onClick={cancelEdit} className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 px-6 py-2 rounded-lg font-bold transition-colors">{viewMode ? 'Voltar' : 'Cancelar'}</button>}
              {!viewMode && ((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.micro_edit !== false) && (
                <button onClick={saveMicro} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center justify-center">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Salvando...' : editingId ? 'Atualizar Micronutriente' : 'Salvar Micronutriente'}
                </button>
              )}
            </div>
          </div>
          <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-stone-700 uppercase">Garantias de Micros</h3>
              {!viewMode && <button onClick={addGuarantee} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 flex items-center"><Plus className="w-3 h-3 mr-1" /> Add Garantia</button>}
            </div>
            <div className="space-y-2">
              {guarantees.map((g, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input type="text" value={g.name} disabled={viewMode} onChange={(e) => updateGuarantee(idx, 'name', e.target.value)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="Nutriente (ex: Zn)" />
                  <input type="number" value={g.value === 0 ? '' : g.value} disabled={viewMode} onChange={(e) => updateGuarantee(idx, 'value', Number(e.target.value))} className="w-20 px-2 py-1 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="%" />
                  {!viewMode && <button onClick={() => removeGuarantee(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
              {guarantees.length === 0 && <p className="text-xs text-stone-400 italic text-center py-2">Nenhuma garantia adicionada.</p>}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Garantias</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {micros.map(m => (
                <tr key={m.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-mono text-emerald-600 font-bold">{m.code}</td>
                  <td className="px-4 py-3 text-stone-800">{m.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.microGuarantees.map((g, i) => <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">{g.name}: {g.value}%</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleView(m)} className="text-stone-500 hover:text-blue-600 p-1" title="Visualizar"><Eye className="w-4 h-4" /></button>
                      {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.micro_edit !== false) && (
                        <button onClick={() => handleEdit(m)} className="text-stone-500 hover:text-blue-600 p-1" title="Editar"><Edit3 className="w-4 h-4" /></button>
                      )}
                      {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.micro_delete !== false) && (
                        <button onClick={() => removeMicro(m.id)} className="text-red-400 hover:text-red-600 p-1" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {micros.length === 0 && !loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">Nenhum micronutriente cadastrado.</td></tr>}
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
