import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit2 } from 'lucide-react';
import {
  InfoBar,
  ReadOnlyNotice,
  fieldClass,
  primaryButton,
  secondaryButton,
} from './products/catalogUi';
import { Brand } from '../types';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

export default function BrandManager({ canManage = true }: { canManage?: boolean }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    const data = await getBrands();
    setBrands(data);
    setLoading(false);
  };

  const getNextCode = (brandList: Brand[]): string => {
    if (brandList.length === 0) return '1';
    const nums = brandList.map((b) => parseInt(b.code, 10)).filter((n) => !isNaN(n));
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
    } catch (err: unknown) {
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
    const ok = await confirm({
      title: 'Excluir marca?',
      message:
        'A marca só pode ser excluída se nenhum produto a usar. A ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteBrand(id);
      showSuccess('Marca excluída com sucesso!');
      await loadBrands();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erro ao excluir marca.');
    }
  };

  return (
    <section className="space-y-4">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <InfoBar>
        Marcas dos macros. Uma marca usada por produtos não pode ser excluída — troque a marca
        desses produtos antes.
      </InfoBar>

      {canManage ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="brand-name"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500"
            >
              {editingBrand ? `Editar marca ${editingBrand.code}` : 'Nova marca'}
            </label>
            <input
              id="brand-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className={fieldClass}
              placeholder="Ex.: Yara, Mosaic, Heringer…"
            />
          </div>
          <div className="flex gap-2">
            {editingBrand && (
              <button type="button" onClick={cancelEdit} className={secondaryButton}>
                Cancelar
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={saving} className={primaryButton}>
              {editingBrand ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Salvando…' : editingBrand ? 'Salvar' : 'Cadastrar marca'}
            </button>
          </div>
        </div>
      ) : (
        <ReadOnlyNotice />
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-xs font-bold uppercase text-stone-500">
            <tr>
              <th className="w-28 px-4 py-3">Código</th>
              <th className="px-4 py-3">Marca</th>
              {canManage && <th className="w-24 px-4 py-3" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-stone-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading &&
              brands.map((brand) => (
                <tr
                  key={brand.id}
                  className={`transition-colors hover:bg-stone-50 ${
                    editingBrand?.id === brand.id ? 'bg-emerald-50/60' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">{brand.code}</td>
                  <td className="px-4 py-3 font-semibold text-stone-900">{brand.name}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => startEdit(brand)}
                          className="rounded-lg p-2 text-stone-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBrand(brand.id)}
                          className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            {!loading && brands.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-stone-400">
                  Nenhuma marca cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
