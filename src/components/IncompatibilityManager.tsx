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

export default function IncompatibilityManager() {
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

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
          Regras de Incompatibilidade
        </h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          <p>
            Defina quais matérias-primas não podem ser misturadas. A calculadora irá alertar ou
            impedir o uso conjunto desses materiais.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8 bg-stone-50 p-4 rounded-lg border border-stone-200">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Matéria Prima A</label>
            <select
              value={selectedMaterialA}
              onChange={(e) => setSelectedMaterialA(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Selecione...</option>
              {allMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center pb-2">
            <X className="text-stone-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Matéria Prima B</label>
            <select
              value={selectedMaterialB}
              onChange={(e) => setSelectedMaterialB(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Selecione...</option>
              {allMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 mt-2">
            <button
              onClick={handleAddRule}
              disabled={!selectedMaterialA || !selectedMaterialB}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Regra de Incompatibilidade
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-stone-700">Regras Cadastradas ({rules.length})</h3>
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Buscar regra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase font-bold text-xs">
                <tr>
                  <th className="px-4 py-3">Matéria A</th>
                  <th className="px-4 py-3 text-center">Incompatível com</th>
                  <th className="px-4 py-3">Matéria B</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{rule.materialAName}</td>
                    <td className="px-4 py-3 text-center text-red-500 font-bold">
                      <X className="w-4 h-4 inline" />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{rule.materialBName}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors"
                        title="Remover regra"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRules.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">
                      Nenhuma regra encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
