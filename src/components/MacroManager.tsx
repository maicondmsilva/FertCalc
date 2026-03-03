import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Database, Eye, Edit3, X } from 'lucide-react';
import { MacroMaterial, MicroGuarantee, Brand, User } from '../types';
import { getMacroMaterials, createMacroMaterial, updateMacroMaterial, deleteMacroMaterial, getBrands } from '../services/db';
import { useToast } from './Toast';

const emptyForm = () => ({
  name: '',
  n: '' as string | number,
  p: '' as string | number,
  k: '' as string | number,
  s: '' as string | number,
  ca: '' as string | number,
  brandId: '',
  formulaSuffix: '',
  isPremiumLine: false,
  categories: [] as ('phosphated' | 'nitrogenous')[],
});

interface MacroManagerProps {
  currentUser: User;
}

/** Gera próximo código sequencial baseado nos registros existentes */
async function getNextMacroCode(macros: MacroMaterial[]): Promise<string> {
  if (macros.length === 0) return '1';
  const nums = macros
    .map(m => parseInt(m.code, 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1);
}

export default function MacroManager({ currentUser }: MacroManagerProps) {
  const { showSuccess, showError } = useToast();

  const [macros, setMacros] = useState<MacroMaterial[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(emptyForm());
  const [guarantees, setGuarantees] = useState<MicroGuarantee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string>(''); // preservar código ao editar
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setTableLoading(true);
    const [m, b] = await Promise.all([getMacroMaterials(), getBrands()]);
    setMacros(m);
    setBrands(b);
    setTableLoading(false);
  };

  // ── Garantias ──────────────────────────────────────────────
  const addGuarantee = () =>
    setGuarantees(prev => [...prev, { name: '', value: 0 }]);

  const updateGuarantee = (i: number, field: keyof MicroGuarantee, value: any) =>
    setGuarantees(prev => {
      const u = [...prev];
      u[i] = { ...u[i], [field]: value };
      return u;
    });

  const removeGuarantee = (i: number) =>
    setGuarantees(prev => prev.filter((_, idx) => idx !== i));

  // ── Categorias ─────────────────────────────────────────────
  const toggleCategory = (cat: 'phosphated' | 'nitrogenous', checked: boolean) =>
    setFormData(prev => ({
      ...prev,
      categories: checked
        ? [...prev.categories, cat]
        : prev.categories.filter(c => c !== cat),
    }));

  // ── Reset ──────────────────────────────────────────────────
  const resetForm = () => {
    setFormData(emptyForm());
    setGuarantees([]);
    setEditingId(null);
    setEditingCode('');
    setViewMode(false);
  };

  // ── Editar / Visualizar ────────────────────────────────────
  const startEdit = (macro: MacroMaterial, readOnly = false) => {
    setFormData({
      name: macro.name,
      n: macro.n,
      p: macro.p,
      k: macro.k,
      s: macro.s,
      ca: macro.ca,
      brandId: macro.brandId || '',
      formulaSuffix: macro.formulaSuffix || '',
      isPremiumLine: macro.isPremiumLine || false,
      categories: macro.categories || [],
    });
    setEditingCode(macro.code); // guardar código para preservar ao salvar
    setGuarantees(macro.microGuarantees || []);
    setEditingId(macro.id);
    setViewMode(readOnly);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Salvar ─────────────────────────────────────────────────
  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();

    const canEdit = (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.macro_edit !== false;
    if (!canEdit) {
      showError('Você não tem permissão para salvar alterações.');
      return;
    }

    if (!formData.name.toString().trim()) {
      showError('O campo "Nome da Matéria Prima" é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<MacroMaterial, 'id'> = {
        code: '',           // preenchido abaixo
        name: formData.name.toString().trim(),
        n: Number(formData.n) || 0,
        p: Number(formData.p) || 0,
        k: Number(formData.k) || 0,
        s: Number(formData.s) || 0,
        ca: Number(formData.ca) || 0,
        brandId: formData.brandId,
        formulaSuffix: formData.formulaSuffix,
        isPremiumLine: formData.isPremiumLine,
        categories: formData.categories,
        microGuarantees: guarantees.filter(g => g.name.trim() !== ''),
      };

      if (editingId) {
        payload.code = editingCode; // BUG FIX: preservar código ao editar
        await updateMacroMaterial(editingId, payload);
        showSuccess('Macronutriente atualizado com sucesso!');
      } else {
        payload.code = await getNextMacroCode(macros);
        await createMacroMaterial(payload);
        showSuccess('Macronutriente salvo com sucesso!');
      }

      await loadData();
      resetForm();
    } catch (err: any) {
      console.error('[MacroManager] erro ao salvar:', err);
      showError(`Erro ao salvar: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Excluir ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const canDelete = (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.macro_delete !== false;
    if (!canDelete) {
      showError('Você não tem permissão para excluir itens.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este macronutriente? Esta ação não pode ser desfeita.'))
      return;
    try {
      await deleteMacroMaterial(id);
      showSuccess('Macronutriente excluído com sucesso!');
      if (editingId === id) resetForm();
      await loadData();
    } catch (err: any) {
      showError('Erro ao excluir macronutriente.');
    }
  };

  // ── Render ─────────────────────────────────────────────────
  const numField = (field: 'n' | 'p' | 'k' | 's' | 'ca') => (
    <div key={field}>
      <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
        {field.toUpperCase()} %
      </label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        disabled={viewMode}
        value={formData[field]}
        onChange={e =>
          setFormData(prev => ({ ...prev, [field]: e.target.value }))
        }
        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
        placeholder="0"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            {editingId
              ? viewMode
                ? 'Visualizar Macronutriente'
                : 'Editar Macronutriente'
              : 'Cadastro de Macronutrientes'}
          </h2>
          {editingId && (
            <button
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors"
            >
              <X className="w-3 h-3" /> {viewMode ? 'Fechar' : 'Cancelar'}
            </button>
          )}
        </div>

        {/* Form area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main fields */}
          <div className="lg:col-span-2 space-y-4">
            {/* Nome + Marca + Sufixo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  Nome da Matéria Prima <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={viewMode}
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                  placeholder="Ex: Ureia, MAP, KCL..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  Marca do Produto
                </label>
                <select
                  disabled={viewMode}
                  value={formData.brandId}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, brandId: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                >
                  <option value="">— Nenhuma —</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1" title="Sufixo que será adicionado ao nome da fórmula quando essa matéria prima for usada">
                  Sufixo Fórmul./Batida
                </label>
                <input
                  type="text"
                  disabled={viewMode}
                  value={formData.formulaSuffix || ''}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, formulaSuffix: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                  placeholder="Ex: C/ UREIA"
                />
              </div>
            </div>

            {/* Linha Diferenciada */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="isPremiumLine"
                disabled={viewMode}
                checked={formData.isPremiumLine || false}
                onChange={e => setFormData(prev => ({ ...prev, isPremiumLine: e.target.checked }))}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 disabled:opacity-50"
              />
              <label htmlFor="isPremiumLine" className="flex flex-col cursor-pointer">
                <span className="text-sm font-semibold text-amber-800">Linha Diferenciada / Premium</span>
                <span className="text-xs text-amber-600">Produto aparece em seção separada na Calculadora e Lista de Preços, <strong>desmarcado por padrão</strong></span>
              </label>
            </div>

            {/* Categorias */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Categorias de Compatibilidade
              </label>
              <div className="flex gap-6">
                {(['phosphated', 'nitrogenous'] as const).map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={viewMode}
                      checked={formData.categories.includes(cat)}
                      onChange={e => toggleCategory(cat, e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-stone-700">
                      {cat === 'phosphated' ? 'Fosfatada' : 'Nitrogenada'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nutrientes N-P-K-S-Ca */}
            <div className="grid grid-cols-5 gap-4">
              {(['n', 'p', 'k', 's', 'ca'] as const).map(numField)}
            </div>

            {/* Botão salvar */}
            {!viewMode && ((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.macro_edit !== false) && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-base shadow-sm"
              >
                <Save className="w-5 h-5" />
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Atualizar Macronutriente'
                    : 'Salvar Macronutriente'}
              </button>
            )}
          </div>

          {/* Garantias de Micro */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wide">
                Garantia de Micro em Macro
              </h3>
              {!viewMode && (
                <button
                  type="button"
                  onClick={addGuarantee}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Micro
                </button>
              )}
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {guarantees.map((g, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    disabled={viewMode}
                    value={g.name}
                    onChange={e => updateGuarantee(idx, 'name', e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100"
                    placeholder="Nutriente (ex: Zn)"
                  />
                  <input
                    type="number"
                    disabled={viewMode}
                    value={g.value}
                    onChange={e =>
                      updateGuarantee(idx, 'value', Number(e.target.value))
                    }
                    className="w-20 px-2 py-1.5 border border-stone-300 rounded text-sm disabled:bg-stone-100"
                    placeholder="%"
                  />
                  {!viewMode && (
                    <button
                      type="button"
                      onClick={() => removeGuarantee(idx)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {guarantees.length === 0 && (
                <p className="text-xs text-stone-400 italic text-center py-4">
                  Nenhuma garantia adicionada.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto border border-stone-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-[11px] border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 w-20">Cód.</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">N-P-K-S-Ca</th>
                <th className="px-4 py-3">Micros</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {tableLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-400">
                    Carregando...
                  </td>
                </tr>
              )}
              {!tableLoading && macros.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-400 italic">
                    Nenhum macronutriente cadastrado. Preencha o formulário acima e clique em <strong>Salvar</strong>.
                  </td>
                </tr>
              )}
              {!tableLoading &&
                macros.map(m => (
                  <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                      {m.code}
                    </td>
                    <td className="px-4 py-3 text-stone-800 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {brands.find(b => b.id === m.brandId)?.name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {m.n}-{m.p}-{m.k}-{m.s}-{m.ca}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(m.microGuarantees || []).map((g, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100"
                          >
                            {g.name}: {g.value}%
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(m, true)}
                          className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.macro_edit !== false) && (
                          <button
                            onClick={() => startEdit(m, false)}
                            className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.macro_delete !== false) && (
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
