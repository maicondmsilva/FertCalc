import React, { useState, useEffect } from 'react';
import { Bell, Save } from 'lucide-react';
import { AlertConfig, getAlertConfigs, updateAlertConfig } from '../services/alertConfigService';
import { useToast } from './Toast';

const ALL_ROLES = ['master', 'admin', 'manager', 'user'] as const;
type Role = (typeof ALL_ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  master: 'Master',
  admin: 'Admin',
  manager: 'Gerente',
  user: 'Vendedor',
};

const ROLE_BADGE: Record<Role, string> = {
  master: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-red-100 text-red-700 border-red-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  user: 'bg-green-100 text-green-700 border-green-200',
};

// ---------------------------------------------------------------------------
// Inline roles multi-select for each alert row
// ---------------------------------------------------------------------------
function RolesSelector({
  roles,
  onChange,
}: {
  roles: string[];
  onChange: (roles: string[]) => void;
}) {
  const toggle = (role: Role) => {
    if (roles.includes(role)) {
      onChange(roles.filter((r) => r !== role));
    } else {
      onChange([...roles, role]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {ALL_ROLES.map((role) => {
        const active = roles.includes(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
              active
                ? ROLE_BADGE[role]
                : 'bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlertCenter component
// ---------------------------------------------------------------------------
export default function AlertCenter() {
  const { showSuccess, showError } = useToast();
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  // Local edits: keyed by config id
  const [edits, setEdits] = useState<Record<string, { ativo: boolean; roles: string[] }>>({});

  const loadConfigs = async () => {
    setLoading(true);
    const data = await getAlertConfigs();
    setConfigs(data);
    // Initialize local edits from loaded data
    const initial: Record<string, { ativo: boolean; roles: string[] }> = {};
    data.forEach((c) => {
      initial[c.id] = { ativo: c.ativo, roles: [...c.roles] };
    });
    setEdits(initial);
    setLoading(false);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const getEdit = (id: string, config: AlertConfig) =>
    edits[id] ?? { ativo: config.ativo, roles: [...config.roles] };

  const handleToggleAtivo = (config: AlertConfig) => {
    const current = getEdit(config.id, config);
    setEdits((prev) => ({ ...prev, [config.id]: { ...current, ativo: !current.ativo } }));
  };

  const handleRolesChange = (config: AlertConfig, roles: string[]) => {
    const current = getEdit(config.id, config);
    setEdits((prev) => ({ ...prev, [config.id]: { ...current, roles } }));
  };

  const handleSave = async (config: AlertConfig) => {
    const edit = getEdit(config.id, config);
    setSaving(config.id);
    try {
      await updateAlertConfig(config.id, { ativo: edit.ativo, roles: edit.roles });
      showSuccess('Configuração salva com sucesso!');
      await loadConfigs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      showError(`Erro ao salvar: ${msg}`);
    } finally {
      setSaving(null);
    }
  };

  const isDirty = (config: AlertConfig) => {
    const edit = getEdit(config.id, config);
    return (
      edit.ativo !== config.ativo ||
      JSON.stringify([...edit.roles].sort()) !== JSON.stringify([...config.roles].sort())
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Central de Alertas
          </h2>
        </div>
        <p className="text-sm text-stone-500">
          Configure quais eventos geram notificações e para quais perfis.
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-stone-400 italic text-sm">
          Carregando configurações…
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Bell className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Nenhuma configuração de alerta encontrada.</p>
          <p className="text-stone-400 text-sm mt-1">
            Execute a migration para criar os tipos padrão de alerta.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3">Notificar Para</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {configs.map((config) => {
                const edit = getEdit(config.id, config);
                const dirty = isDirty(config);
                const isSaving = saving === config.id;
                return (
                  <tr
                    key={config.id}
                    className={`transition-colors ${dirty ? 'bg-amber-50/40' : 'hover:bg-stone-50'}`}
                  >
                    {/* Tipo */}
                    <td className="px-5 py-3">
                      <code className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono border border-stone-200">
                        {config.tipo}
                      </code>
                    </td>

                    {/* Descrição */}
                    <td className="px-5 py-3 text-stone-700 text-sm">{config.descricao}</td>

                    {/* Roles */}
                    <td className="px-5 py-3">
                      <RolesSelector
                        roles={edit.roles}
                        onChange={(roles) => handleRolesChange(config, roles)}
                      />
                    </td>

                    {/* Status toggle */}
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleAtivo(config)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          edit.ativo ? 'bg-emerald-500' : 'bg-stone-300'
                        }`}
                        title={edit.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            edit.ativo ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Save button */}
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSave(config)}
                        disabled={!dirty || isSaving}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-auto ${
                          dirty && !isSaving
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-3 h-3" />
                        {isSaving ? 'Salvando…' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
