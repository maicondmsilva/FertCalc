import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Trash2, X, Search } from 'lucide-react';
import { MacroMaterial, MicroMaterial, IncompatibilityRule } from '../types';
import {
  getMacroMaterials,
  getMicroMaterials,
  getIncompatibilityRules,
  createIncompatibilityRule,
  deleteIncompatibilityRule,
} from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { InfoBar, ReadOnlyNotice, fieldClass, primaryButton } from './products/catalogUi';

export default function IncompatibilityManager({ canManage = true }: { canManage?: boolean }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [macros, setMacros] = useState<MacroMaterial[]>([]);
  const [micros, setMicros] = useState<MicroMaterial[]>([]);
  const [rules, setRules] = useState<IncompatibilityRule[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedMaterialA, setSelectedMaterialA] = useState<string>('');
  const [selectedMaterialB, setSelectedMaterialB] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const [m, mi, r] = await Promise.all([
        getMacroMaterials(),
        getMicroMaterials(),
        getIncompatibilityRules(),
      ]);
      setMacros(m);
      setMicros(mi);
      setRules(r);
    };
    loadData();
  }, []);

  const allMaterials = [
    ...macros.map((m) => ({ id: m.id, name: m.name, type: 'Macro' })),
    ...micros.map((m) => ({ id: m.id, name: m.name, type: 'Micro' })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const handleAddRule = async () => {
    if (!selectedMaterialA || !selectedMaterialB) return;
    if (selectedMaterialA === selectedMaterialB) {
      showError('Selecione materiais diferentes.');
      return;
    }
    const materialA = allMaterials.find((m) => m.id === selectedMaterialA);
    const materialB = allMaterials.find((m) => m.id === selectedMaterialB);
    if (!materialA || !materialB) return;
    const exists = rules.some(
      (r) =>
        (r.materialAId === materialA.id && r.materialBId === materialB.id) ||
        (r.materialAId === materialB.id && r.materialBId === materialA.id)
    );
    if (exists) {
      showError('Esta regra de incompatibilidade já existe.');
      return;
    }
    setSaving(true);
    try {
      const newRule = await createIncompatibilityRule({
        materialAId: materialA.id,
        materialBId: materialB.id,
        materialAName: materialA.name,
        materialBName: materialB.name,
      });
      setRules((prev) => [...prev, newRule]);
      setSelectedMaterialA('');
      setSelectedMaterialB('');
      showSuccess('Regra adicionada com sucesso!');
    } catch {
      showError('Erro ao salvar regra.');
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir regra?',
      message: 'Tem certeza que deseja excluir esta regra de incompatibilidade?',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteIncompatibilityRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      showSuccess('Regra excluída com sucesso!');
    } catch {
      showError('Erro ao excluir regra.');
    }
  };

  const filteredRules = rules.filter(
    (r) =>
      r.materialAName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.materialBName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const materialSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <div className="flex-1">
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        <option value="">Selecione…</option>
        {allMaterials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.type})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="space-y-4">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <InfoBar>
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          Matérias-primas que não podem ser misturadas. A calculadora alerta ou impede o uso
          conjunto delas.
        </span>
      </InfoBar>

      {canManage ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 lg:flex-row lg:items-end">
          {materialSelect('incompat-a', 'Matéria-prima A', selectedMaterialA, setSelectedMaterialA)}
          <div className="hidden pb-3 text-stone-400 lg:block" aria-hidden="true">
            <X className="h-5 w-5" />
          </div>
          {materialSelect('incompat-b', 'Matéria-prima B', selectedMaterialB, setSelectedMaterialB)}
          <button
            type="button"
            onClick={handleAddRule}
            disabled={!selectedMaterialA || !selectedMaterialB || saving}
            className={primaryButton}
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Adicionar regra'}
          </button>
        </div>
      ) : (
        <ReadOnlyNotice />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-black text-stone-800">Regras cadastradas ({rules.length})</h3>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Buscar regra…"
            aria-label="Buscar regra"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${fieldClass} pl-9`}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {filteredRules.map((rule) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-stone-900">{rule.materialAName}</span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                não misturar com
              </span>
              <span className="font-semibold text-stone-900">{rule.materialBName}</span>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                title="Remover regra"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {filteredRules.length === 0 && (
          <li className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center text-sm text-stone-400">
            {rules.length === 0 ? 'Nenhuma regra cadastrada.' : 'Nenhuma regra encontrada.'}
          </li>
        )}
      </ul>
    </section>
  );
}
