import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Search, Eye, Save, X, Package, Database, FlaskConical, Box } from 'lucide-react';
import { MacroMaterial, MicroMaterial, FinishedProduct, Brand, MicroGuarantee } from '../types';
import {
  getMacroMaterials, createMacroMaterial, updateMacroMaterial, deleteMacroMaterial,
  getMicroMaterials, createMicroMaterial, updateMicroMaterial, deleteMicroMaterial,
  getFinishedProducts, createFinishedProduct, updateFinishedProduct, deleteFinishedProduct,
  getBrands,
} from '../services/db';
import { useToast } from './Toast';

type Tab = 'macro' | 'micro' | 'finished';

/* ═══════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════ */
function nextCode(items: { code: string }[]): string {
  if (items.length === 0) return '1';
  const nums = items.map(i => parseInt(i.code, 10)).filter(n => !isNaN(n));
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
}

/* ═══════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════ */
export default function ProductManager() {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>('macro');

  const [macros, setMacros] = useState<MacroMaterial[]>([]);
  const [micros, setMicros] = useState<MicroMaterial[]>([]);
  const [finished, setFinished] = useState<FinishedProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  /* ── Form states ── */
  const [editingId, setEditingId] = useState<string | null>(null);

  // Macro form
  const emptyMacro = () => ({ name: '', n: 0, p: 0, k: 0, s: 0, ca: 0, brandId: '', categories: [] as ('phosphated' | 'nitrogenous' | 'fertigran_p')[], microGuarantees: [] as MicroGuarantee[], minQuantity: 0 });
  const [macroForm, setMacroForm] = useState(emptyMacro());

  // Micro form
  const emptyMicro = () => ({ name: '', categories: [] as ('phosphated' | 'nitrogenous' | 'fertigran_p')[], microGuarantees: [] as MicroGuarantee[], minQuantity: 0 });
  const [microForm, setMicroForm] = useState(emptyMicro());

  // Finished form
  const emptyFinished = () => ({ name: '', description: '', price: '' as string | number, minQuantity: 0 });
  const [finishedForm, setFinishedForm] = useState(emptyFinished());

  /* ── Load ── */
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setTableLoading(true);
    const [m, mi, f, b] = await Promise.all([
      getMacroMaterials(), getMicroMaterials(), getFinishedProducts(), getBrands()
    ]);
    setMacros(m); setMicros(mi); setFinished(f); setBrands(b);
    setTableLoading(false);
  };

  /* ── Items for current tab ── */
  const currentItems = tab === 'macro' ? macros : tab === 'micro' ? micros : finished;
  const filtered = currentItems.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Open modal ── */
  const openCreate = () => {
    setEditingId(null); setViewMode(false);
    if (tab === 'macro') setMacroForm(emptyMacro());
    if (tab === 'micro') setMicroForm(emptyMicro());
    if (tab === 'finished') setFinishedForm(emptyFinished());
    setIsModalOpen(true);
  };

  const openEdit = (item: MacroMaterial | MicroMaterial | FinishedProduct, readOnly = false) => {
    setEditingId(item.id); setViewMode(readOnly);
    if (tab === 'macro') {
      const m = item as MacroMaterial;
      setMacroForm({ name: m.name, n: m.n, p: m.p, k: m.k, s: m.s, ca: m.ca, brandId: m.brandId || '', categories: m.categories || [], microGuarantees: m.microGuarantees || [], minQuantity: m.minQuantity || 0 });
    }
    if (tab === 'micro') {
      const m = item as MicroMaterial;
      setMicroForm({ name: m.name, categories: m.categories || [], microGuarantees: m.microGuarantees || [], minQuantity: m.minQuantity || 0 });
    }
    if (tab === 'finished') {
      const f = item as FinishedProduct;
      setFinishedForm({ name: f.name, description: f.description || '', price: f.price ?? '', minQuantity: f.minQuantity || 0 });
    }
    setIsModalOpen(true);
  };

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'macro') {
        if (!macroForm.name.trim()) { showError('Nome é obrigatório.'); setSaving(false); return; }
        const payload: Omit<MacroMaterial, 'id'> = {
          code: editingId ? macros.find(m => m.id === editingId)?.code || '1' : nextCode(macros),
          name: macroForm.name.trim(),
          n: Number(macroForm.n) || 0, p: Number(macroForm.p) || 0,
          k: Number(macroForm.k) || 0, s: Number(macroForm.s) || 0, ca: Number(macroForm.ca) || 0,
          brandId: macroForm.brandId,
          categories: macroForm.categories,
          microGuarantees: macroForm.microGuarantees.filter(g => g.name.trim()),
          minQuantity: Number(macroForm.minQuantity) || 0,
        };
        if (editingId) { await updateMacroMaterial(editingId, payload); showSuccess('Macronutriente atualizado com sucesso!'); }
        else { await createMacroMaterial(payload); showSuccess('Macronutriente salvo com sucesso!'); }
      }

      if (tab === 'micro') {
        if (!microForm.name.trim()) { showError('Nome é obrigatório.'); setSaving(false); return; }
        const payload: Omit<MicroMaterial, 'id'> = {
          code: editingId ? micros.find(m => m.id === editingId)?.code || '1' : nextCode(micros),
          name: microForm.name.trim(),
          categories: microForm.categories,
          microGuarantees: microForm.microGuarantees.filter(g => g.name.trim()),
          minQuantity: Number(microForm.minQuantity) || 0,
        };
        if (editingId) { await updateMicroMaterial(editingId, payload); showSuccess('Micronutriente atualizado com sucesso!'); }
        else { await createMicroMaterial(payload); showSuccess('Micronutriente salvo com sucesso!'); }
      }

      if (tab === 'finished') {
        if (!finishedForm.name.trim()) { showError('Nome é obrigatório.'); setSaving(false); return; }
        const payload: Omit<FinishedProduct, 'id'> = {
          code: editingId ? finished.find(f => f.id === editingId)?.code || '1' : nextCode(finished),
          name: finishedForm.name.trim(),
          description: finishedForm.description?.toString() || '',
          price: finishedForm.price !== '' ? Number(finishedForm.price) : undefined,
          minQuantity: Number(finishedForm.minQuantity) || 0,
        };
        if (editingId) { await updateFinishedProduct(editingId, payload); showSuccess('Produto atualizado com sucesso!'); }
        else { await createFinishedProduct(payload); showSuccess('Produto salvo com sucesso!'); }
      }

      await loadAll();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('[ProductManager] erro:', err);
      showError(`Erro ao salvar: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.')) return;
    try {
      if (tab === 'macro') await deleteMacroMaterial(id);
      if (tab === 'micro') await deleteMicroMaterial(id);
      if (tab === 'finished') await deleteFinishedProduct(id);
      showSuccess('Produto excluído com sucesso!');
      await loadAll();
    } catch { showError('Erro ao excluir produto.'); }
  };

  /* ── Guarantee helpers (macro/micro) ── */
  const addGuaranteeMacro = () => setMacroForm(p => ({ ...p, microGuarantees: [...p.microGuarantees, { name: '', value: 0 }] }));
  const updateGuaranteeMacro = (i: number, field: keyof MicroGuarantee, val: any) =>
    setMacroForm(p => { const g = [...p.microGuarantees]; g[i] = { ...g[i], [field]: val }; return { ...p, microGuarantees: g }; });
  const removeGuaranteeMacro = (i: number) =>
    setMacroForm(p => ({ ...p, microGuarantees: p.microGuarantees.filter((_, idx) => idx !== i) }));

  const addGuaranteeMicro = () => setMicroForm(p => ({ ...p, microGuarantees: [...p.microGuarantees, { name: '', value: 0 }] }));
  const updateGuaranteeMicro = (i: number, field: keyof MicroGuarantee, val: any) =>
    setMicroForm(p => { const g = [...p.microGuarantees]; g[i] = { ...g[i], [field]: val }; return { ...p, microGuarantees: g }; });
  const removeGuaranteeMicro = (i: number) =>
    setMicroForm(p => ({ ...p, microGuarantees: p.microGuarantees.filter((_, idx) => idx !== i) }));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'macro', label: 'Macronutrientes', icon: <Database className="w-4 h-4" /> },
    { key: 'micro', label: 'Micronutrientes', icon: <FlaskConical className="w-4 h-4" /> },
    { key: 'finished', label: 'Produto Acabado (PA)', icon: <Box className="w-4 h-4" /> },
  ];

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
          <Package className="w-7 h-7 text-emerald-600" />
          Cadastro de Produtos
        </h1>
        <button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-colors relative ${tab === t.key ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            {t.icon}{t.label}
            {tab === t.key && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t" />}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input type="text" placeholder="Buscar por nome ou código..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs border-b border-stone-100">
            <tr>
              <th className="px-5 py-3 w-20">Cód.</th>
              <th className="px-5 py-3">Nome</th>
              {tab === 'macro' && <><th className="px-5 py-3">Marca</th><th className="px-5 py-3 text-center">N-P-K</th></>}
              {tab === 'micro' && <th className="px-5 py-3">Garantias</th>}
              {tab === 'finished' && <th className="px-5 py-3">Descrição</th>}
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {tableLoading && <tr><td colSpan={6} className="px-6 py-10 text-center text-stone-400">Carregando...</td></tr>}
            {!tableLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-stone-400 italic">Nenhum produto encontrado.</td></tr>
            )}
            {!tableLoading && filtered.map(item => {
              const m = item as MacroMaterial;
              const mi = item as MicroMaterial;
              const f = item as FinishedProduct;
              return (
                <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-emerald-600">{item.code}</td>
                  <td className="px-5 py-3 font-medium text-stone-800">{item.name}</td>
                  {tab === 'macro' && (
                    <>
                      <td className="px-5 py-3 text-stone-600">{brands.find(b => b.id === m.brandId)?.name || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-stone-700">{m.n}-{m.p}-{m.k}</td>
                    </>
                  )}
                  {tab === 'micro' && (
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(mi.microGuarantees || []).slice(0, 3).map((g, i) => (
                          <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">{g.name}: {g.value}%</span>
                        ))}
                      </div>
                    </td>
                  )}
                  {tab === 'finished' && <td className="px-5 py-3 text-stone-500 truncate max-w-xs">{f.description || '—'}</td>}
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item, true)} className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Visualizar"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(item, false)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ MODAL ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
              <h2 className="text-lg font-bold">
                {viewMode ? 'Visualizar Produto' : editingId ? 'Editar Produto' : 'Novo Produto'}
                <span className="ml-2 text-sm font-normal opacity-80">
                  ({tab === 'macro' ? 'Macronutriente' : tab === 'micro' ? 'Micronutriente' : 'Produto Acabado'})
                </span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">

              {/* ── MACRO form ── */}
              {tab === 'macro' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-stone-600 mb-1">Nome do Produto <span className="text-red-500">*</span></label>
                      <input type="text" disabled={viewMode} value={macroForm.name}
                        onChange={e => setMacroForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                        placeholder="Ex: Ureia, MAP, KCL..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-600 mb-1">Marca do Produto</label>
                      <select disabled={viewMode} value={macroForm.brandId}
                        onChange={e => setMacroForm(p => ({ ...p, brandId: e.target.value }))}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50">
                        <option value="">— Nenhuma —</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                      </select>
                      {brands.length === 0 && <p className="text-xs text-amber-600 mt-1">⚠ Nenhuma marca cadastrada. Cadastre em "Marcas" primeiro.</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-600 mb-2">Categorias</label>
                      <div className="flex gap-4 mt-1">
                        {(['phosphated', 'nitrogenous'] as const).map(cat => (
                          <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="checkbox" disabled={viewMode}
                              checked={macroForm.categories.includes(cat)}
                              onChange={e => setMacroForm(p => ({ ...p, categories: e.target.checked ? [...p.categories, cat] : p.categories.filter(c => c !== cat) }))}
                              className="rounded text-emerald-600" />
                            {cat === 'phosphated' ? 'Fosfatada' : 'Nitrogenada'}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-2">Garantias N-P-K-S-Ca (%)</label>
                    <div className="grid grid-cols-5 gap-3">
                      {(['n', 'p', 'k', 's', 'ca'] as const).map(f => (
                        <div key={f}>
                          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">{f.toUpperCase()}</label>
                          <input type="number" min="0" max="100" step="0.01" disabled={viewMode}
                            value={(macroForm as any)[f]}
                            onChange={e => setMacroForm(p => ({ ...p, [f]: e.target.value }))}
                            className="w-full px-2 py-2 border border-stone-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-stone-600 mb-1">Quantidade Mínima (kg)</label>
                    <input type="number" min="0" disabled={viewMode}
                      value={macroForm.minQuantity || 0}
                      onChange={e => setMacroForm(p => ({ ...p, minQuantity: Number(e.target.value) }))}
                      className="w-full sm:w-1/3 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="Ex: 50" />
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-stone-600">Garantia de Micro em Macro</label>
                      {!viewMode && <button type="button" onClick={addGuaranteeMacro} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>}
                    </div>
                    <div className="space-y-2 bg-stone-50 rounded-lg p-3">
                      {macroForm.microGuarantees.map((g, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" disabled={viewMode} value={g.name} onChange={e => updateGuaranteeMacro(i, 'name', e.target.value)} className="flex-1 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="Nutriente" />
                          <input type="number" disabled={viewMode} value={g.value} onChange={e => updateGuaranteeMacro(i, 'value', Number(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="%" />
                          {!viewMode && <button type="button" onClick={() => removeGuaranteeMacro(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      ))}
                      {macroForm.microGuarantees.length === 0 && <p className="text-xs text-stone-400 italic text-center py-1">Nenhuma garantia adicionada.</p>}
                    </div>
                  </div>
                </>
              )}

              {/* ── MICRO form ── */}
              {tab === 'micro' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Nome do Micronutriente <span className="text-red-500">*</span></label>
                    <input type="text" disabled={viewMode} value={microForm.name}
                      onChange={e => setMicroForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="Ex: Zinco Sulfato, Boro..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Quantidade Mínima (kg)</label>
                    <input type="number" min="0" disabled={viewMode}
                      value={microForm.minQuantity || 0}
                      onChange={e => setMicroForm(p => ({ ...p, minQuantity: Number(e.target.value) }))}
                      className="w-full sm:w-1/3 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="Ex: 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-2">Categorias</label>
                    <div className="flex gap-4">
                      {(['phosphated', 'nitrogenous'] as const).map(cat => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" disabled={viewMode}
                            checked={microForm.categories.includes(cat)}
                            onChange={e => setMicroForm(p => ({ ...p, categories: e.target.checked ? [...p.categories, cat] : p.categories.filter(c => c !== cat) }))}
                            className="rounded text-emerald-600" />
                          {cat === 'phosphated' ? 'Fosfatada' : 'Nitrogenada'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-stone-600">Garantias</label>
                      {!viewMode && <button type="button" onClick={addGuaranteeMicro} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>}
                    </div>
                    <div className="space-y-2 bg-stone-50 rounded-lg p-3">
                      {microForm.microGuarantees.map((g, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" disabled={viewMode} value={g.name} onChange={e => updateGuaranteeMicro(i, 'name', e.target.value)} className="flex-1 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="Nutriente" />
                          <input type="number" disabled={viewMode} value={g.value} onChange={e => updateGuaranteeMicro(i, 'value', Number(e.target.value))} className="w-20 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100" placeholder="%" />
                          {!viewMode && <button type="button" onClick={() => removeGuaranteeMicro(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      ))}
                      {microForm.microGuarantees.length === 0 && <p className="text-xs text-stone-400 italic text-center py-1">Nenhuma garantia adicionada.</p>}
                    </div>
                  </div>
                </>
              )}

              {/* ── FINISHED form ── */}
              {tab === 'finished' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Nome do Produto Acabado <span className="text-red-500">*</span></label>
                    <input type="text" disabled={viewMode} value={finishedForm.name}
                      onChange={e => setFinishedForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="Ex: Fórmula 04-14-08..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Preço (R$)</label>
                    <input type="number" min="0" step="0.01" disabled={viewMode} value={finishedForm.price}
                      onChange={e => setFinishedForm(p => ({ ...p, price: e.target.value }))}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Descrição / Observações</label>
                    <textarea disabled={viewMode} value={finishedForm.description}
                      onChange={e => setFinishedForm(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 resize-none"
                      placeholder="Detalhes adicionais..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-600 mb-1">Quantidade Mínima (kg)</label>
                    <input type="number" min="0" disabled={viewMode}
                      value={finishedForm.minQuantity || 0}
                      onChange={e => setFinishedForm(p => ({ ...p, minQuantity: Number(e.target.value) }))}
                      className="w-full sm:w-1/3 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50"
                      placeholder="Ex: 1000" />
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-200 rounded-lg transition-colors">
                {viewMode ? 'Fechar' : 'Cancelar'}
              </button>
              {!viewMode && (
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar Produto'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
