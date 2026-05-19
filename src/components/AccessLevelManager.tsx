import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, Edit2, ShieldCheck } from 'lucide-react';
import { AccessLevel } from '../types';
import {
  createAccessLevel,
  deleteAccessLevel,
  updateAccessLevel,
} from '../services/accessLevelService';
import { useAccessLevels } from '../hooks/useAccessLevels';
import { useToast } from './Toast';

const emptyForm = {
  code: '',
  name: '',
  description: '',
  hierarchy_level: 40,
  default_permissions: '{}',
};

export default function AccessLevelManager() {
  const { showError, showSuccess } = useToast();
  const { levels, loading, reload } = useAccessLevels();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AccessLevel | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sorted = useMemo(
    () => [...levels].sort((a, b) => b.hierarchy_level - a.hierarchy_level),
    [levels]
  );

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const handleEdit = (level: AccessLevel) => {
    setEditing(level);
    setForm({
      code: level.code,
      name: level.name,
      description: level.description ?? '',
      hierarchy_level: level.hierarchy_level,
      default_permissions: JSON.stringify(level.default_permissions ?? {}, null, 2),
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let defaultPermissions: Record<string, unknown> = {};
      if (form.default_permissions.trim()) {
        defaultPermissions = JSON.parse(form.default_permissions);
      }

      if (editing) {
        await updateAccessLevel(editing.id, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          hierarchy_level: Number(form.hierarchy_level),
          default_permissions: defaultPermissions,
        });
        showSuccess('Nível de acesso atualizado com sucesso.');
      } else {
        await createAccessLevel({
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          hierarchy_level: Number(form.hierarchy_level),
          default_permissions: defaultPermissions,
        });
        showSuccess('Nível de acesso criado com sucesso.');
      }

      await reload();
      resetForm();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Falha ao salvar nível de acesso.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: AccessLevel) => {
    if (!window.confirm(`Excluir nível "${level.name}"?`)) return;
    try {
      await deleteAccessLevel(level.id);
      showSuccess('Nível excluído com sucesso.');
      await reload();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Falha ao excluir nível de acesso.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Níveis de Acesso
          </h1>
          <p className="text-sm text-stone-500">
            Gerencie níveis dinâmicos de acesso (hierarquia e permissões padrão).
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-bold hover:bg-stone-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toLowerCase() }))}
            placeholder="code (slug)"
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
            disabled={editing?.is_system}
          />
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nome"
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
            disabled={editing?.is_system}
          />
          <input
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição"
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm md:col-span-2"
            disabled={editing?.is_system}
          />
          <input
            type="number"
            min={0}
            max={100}
            value={form.hierarchy_level}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hierarchy_level: Number(e.target.value) }))
            }
            placeholder="Hierarquia (0-100)"
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
            disabled={editing?.is_system}
          />
        </div>
        <textarea
          value={form.default_permissions}
          onChange={(e) => setForm((prev) => ({ ...prev, default_permissions: e.target.value }))}
          rows={6}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono"
          placeholder='{"users": true, "carregamento": true}'
          disabled={editing?.is_system}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.code || !form.name || !!editing?.is_system}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-emerald-300 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {editing ? 'Salvar Alterações' : 'Novo Nível'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-bold text-stone-600 hover:bg-stone-50"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 uppercase text-[11px]">
            <tr>
              <th className="text-left px-4 py-2">Código</th>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Hierarquia</th>
              <th className="text-left px-4 py-2">Tipo</th>
              <th className="text-right px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((level) => (
              <tr key={level.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-mono text-xs">{level.code}</td>
                <td className="px-4 py-2">{level.name}</td>
                <td className="px-4 py-2">{level.hierarchy_level}</td>
                <td className="px-4 py-2">
                  {level.is_system ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">
                      Sistema
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700">
                      Personalizado
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(level)}
                      className="p-1.5 rounded border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                      disabled={level.is_system}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(level)}
                      className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={level.is_system}
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
    </div>
  );
}
