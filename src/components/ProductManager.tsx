import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Search, Eye, Save, X, Package, Database, FlaskConical, Box, Settings } from 'lucide-react';
import { UnifiedProduct, Brand, MicroGuarantee, NutrientType, CompatibilityCategory } from '../types';
import { getUnifiedProducts, saveUnifiedProduct, deleteUnifiedProduct, getBrands, getCompatibilityCategories } from '../services/db';
import { useToast } from './Toast';
import CompatibilityCategoryManager from './CompatibilityCategoryManager';

type Tab = NutrientType;

function nextCode(items: { code: string }[]): string {
  if (items.length === 0) return '1';
  const nums = items.map(i => parseInt(i.code, 10)).filter(n => !isNaN(n));
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
}

const emptyProduct = (type: NutrientType): Partial<UnifiedProduct> => ({
  type, name: '', code: '', minQuantity: 0, categories: [],
  n: 0, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [],
  brandId: '', description: '', price: undefined
});

export default function ProductManager() {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>('macro');
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CompatibilityCategory[]>([]);
  
  const [tableLoading, setTableLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  const [form, setForm] = useState<Partial<UnifiedProduct>>(emptyProduct('macro'));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setTableLoading(true);
    const [p, b, c] = await Promise.all([ getUnifiedProducts(), getBrands(), getCompatibilityCategories() ]);
    setProducts(p); setBrands(b); setCategories(c);
    setTableLoading(false);
  };

  const currentItems = products.filter(p => p.type === tab);
  const filtered = currentItems.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditingId(null); setViewMode(false);
    setForm(emptyProduct(tab));
    setIsModalOpen(true);
  };

  const openEdit = (item: UnifiedProduct, readOnly = false) => {
    setEditingId(item.id); setViewMode(readOnly);
    setForm({ ...item, microGuarantees: item.microGuarantees || [], categories: item.categories || [] });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.name?.trim()) { showError('Nome é obrigatório.'); setSaving(false); return; }
      
      const payload = {
        ...form,
        code: editingId ? (products.find(p => p.id === editingId)?.code || '1') : nextCode(products.filter(p => p.type === form.type)),
        microGuarantees: (form.microGuarantees || []).filter(g => g.name.trim()),
      };
      
      await saveUnifiedProduct(payload, editingId || undefined);
      showSuccess('Produto salvo com sucesso!');
      await loadAll();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showError(`Erro ao salvar: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, type: NutrientType) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await deleteUnifiedProduct(id, type);
      showSuccess('Produto excluído com sucesso!');
      await loadAll();
    } catch { showError('Erro ao excluir produto.'); }
  };

  const addGuarantee = () => setForm(p => ({ ...p, microGuarantees: [...(p.microGuarantees||[]), { name: '', value: 0 }] }));
  const updateGuarantee = (i: number, field: keyof MicroGuarantee, val: any) =>
    setForm(p => { const g = [...(p.microGuarantees||[])]; g[i] = { ...g[i], [field]: val }; return { ...p, microGuarantees: g }; });
  const removeGuarantee = (i: number) =>
    setForm(p => ({ ...p, microGuarantees: (p.microGuarantees||[]).filter((_, idx) => idx !== i) }));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'macro', label: 'Macronutrientes', icon: <Database className="w-4 h-4" /> },
    { key: 'micro', label: 'Micronutrientes', icon: <FlaskConical className="w-4 h-4" /> },
    { key: 'finished', label: 'Produto Acabado (PA)', icon: <Box className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
          <Package className="w-7 h-7 text-emerald-600" />
          Gerenciador de Produtos
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setIsCategoryModalOpen(true)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
            <Settings className="w-4 h-4" /> Categorias
          </button>
          <button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-colors relative ${tab === t.key ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.icon}{t.label}
            {tab === t.key && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t" />}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input type="text" placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs border-b border-stone-100">
            <tr>
              <th className="px-5 py-3 w-20">Cód.</th>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Categorias</th>
              {tab === 'macro' && <><th className="px-5 py-3">Marca</th><th className="px-5 py-3 text-center">N-P-K</th></>}
              {tab === 'micro' && <th className="px-5 py-3">Garantias</th>}
              {tab === 'finished' && <th className="px-5 py-3">Descrição</th>}
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {tableLoading && <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-400">Carregando...</td></tr>}
            {!tableLoading && filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-400 italic">Nenhum produto encontrado.</td></tr>}
            {!tableLoading && filtered.map(item => (
              <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-5 py-3 font-mono font-bold text-emerald-600">{item.code}</td>
                <td className="px-5 py-3 font-medium text-stone-800">{item.name}</td>
                <td className="px-5 py-3 text-xs text-stone-500">
                  <div className="flex flex-wrap gap-1">
                    {(item.categories || []).map(cid => {
                      const cName = categories.find(c => c.id === cid)?.nome || cid;
                      return <span key={cid} className="bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">{cName}</span>;
                    })}
                  </div>
                </td>
                {tab === 'macro' && (
                  <>
                    <td className="px-5 py-3 text-stone-600">{brands.find(b => b.id === item.brandId)?.name || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-stone-700">{item.n}-{item.p}-{item.k}</td>
                  </>
                )}
                {tab === 'micro' && (
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(item.microGuarantees || []).slice(0, 3).map((g, i) => (
                        <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">{g.name}: {g.value}%</span>
                      ))}
                    </div>
                  </td>
                )}
                {tab === 'finished' && <td className="px-5 py-3 text-stone-500 truncate max-w-xs">{item.description || '—'}</td>}
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(item, true)} className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(item, false)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.id, item.type!)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
              <h2 className="text-lg font-bold">
                {viewMode ? 'Visualizar Produto' : editingId ? 'Editar Produto' : 'Novo Produto'}
                <span className="ml-2 text-sm font-normal opacity-80">({tab.toUpperCase()})</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-600 mb-1">Nome do Produto <span className="text-red-500">*</span></label>
                  <input type="text" disabled={viewMode} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50" />
                </div>
                
                {tab === 'macro' && (
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Marca do Produto</label>
                    <select disabled={viewMode} value={form.brandId || ''} onChange={e => setForm(p => ({ ...p, brandId: e.target.value }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50">
                      <option value="">— Nenhuma —</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">Quantidade Mínima (kg)</label>
                  <input type="number" min="0" disabled={viewMode} value={form.minQuantity || 0} onChange={e => setForm(p => ({ ...p, minQuantity: Number(e.target.value) }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50" />
                </div>
              </div>

              {(tab === 'macro' || tab === 'micro') && (
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2 flex justify-between">
                    Categorias Compartilhadas
                  </label>
                  <div className="flex flex-wrap gap-3 mt-1 bg-stone-50 p-3 rounded-lg border border-stone-200">
                    {categories.filter(c => c.ativo).map(c => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700 bg-white px-2 py-1 rounded shadow-sm border border-stone-100 hover:border-emerald-300">
                        <input type="checkbox" disabled={viewMode} checked={(form.categories||[]).includes(c.id)}
                          onChange={e => setForm(p => ({ ...p, categories: e.target.checked ? [...(p.categories||[]), c.id] : (p.categories||[]).filter(id => id !== c.id) }))}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" />
                        {c.nome}
                      </label>
                    ))}
                    {categories.filter(c => c.ativo).length === 0 && <span className="text-xs text-stone-400">Nenhuma categoria ativa cadastrada.</span>}
                  </div>
                </div>
              )}

              {tab === 'macro' && (
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">Garantias N-P-K-S-Ca (%)</label>
                  <div className="grid grid-cols-5 gap-3">
                    {(['n', 'p', 'k', 's', 'ca'] as const).map(f => (
                      <div key={f}>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">{f}</label>
                        <input type="number" min="0" max="100" step="0.01" disabled={viewMode} value={(form as any)[f] || 0} onChange={e => setForm(p => ({ ...p, [f]: Number(e.target.value) }))} className="w-full px-2 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'finished' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Preço (R$)</label>
                    <input type="number" min="0" step="0.01" disabled={viewMode} value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Descrição</label>
                    <textarea disabled={viewMode} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 resize-none" />
                  </div>
                </>
              )}

              {(tab === 'macro' || tab === 'micro') && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-stone-600">Micronutrientes (Garantias Extras)</label>
                    {!viewMode && <button type="button" onClick={addGuarantee} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>}
                  </div>
                  <div className="space-y-2 bg-stone-50 rounded-lg p-3 border border-stone-200">
                    {(form.microGuarantees||[]).map((g, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="text" disabled={viewMode} value={g.name} onChange={e => updateGuarantee(i, 'name', e.target.value)} className="flex-1 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="Ex: Zinco, Boro..." />
                        <input type="number" disabled={viewMode} value={g.value} onChange={e => updateGuarantee(i, 'value', Number(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="%" />
                        {!viewMode && <button type="button" onClick={() => removeGuarantee(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    ))}
                    {(form.microGuarantees||[]).length === 0 && <p className="text-xs text-stone-400 italic text-center py-1">Nenhuma garantia extra adicionada.</p>}
                  </div>
                </div>
              )}

            </div>
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-200 rounded-lg transition-colors">{viewMode ? 'Fechar' : 'Cancelar'}</button>
              {!viewMode && (
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar Produto'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal shared */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative">
            <button onClick={() => { setIsCategoryModalOpen(false); loadAll(); }} className="absolute top-4 right-4 p-1 bg-stone-100/50 hover:bg-stone-200 rounded-full transition-colors z-[70]"><X className="w-5 h-5" /></button>
            <div className="p-0 overflow-y-auto flex-1">
              <CompatibilityCategoryManager />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
