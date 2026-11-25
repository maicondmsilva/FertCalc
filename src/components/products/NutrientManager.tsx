import React, { useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import {
  createNutriente,
  type Nutriente,
  type NutrienteInput,
  updateNutriente,
} from '../../services/nutrientesService';
import { useToast } from '../Toast';

interface NutrientManagerProps {
  nutrientes: Nutriente[];
  canManage: boolean;
  onChanged: () => void;
}

const emptyForm: NutrienteInput = {
  sigla: '',
  nome: '',
  tipo: 'micro',
  aliases: [],
  ordem: 0,
  ativo: true,
};

const inputClass =
  'h-10 w-full rounded-lg border border-stone-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

const tipoLabel = { micro: 'Micronutriente', secundario: 'Secundário' } as const;

/**
 * Cadastro de nutrientes: as garantias dos produtos são escolhidas desta lista,
 * e o cálculo reconhece a sigla, o nome e os nomes alternativos como o mesmo nutriente.
 */
export default function NutrientManager({
  nutrientes,
  canManage,
  onChanged,
}: NutrientManagerProps) {
  const { showSuccess, showError } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NutrienteInput | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, ordem: (nutrientes.at(-1)?.ordem ?? 0) + 10 });
    setAliasesText('');
  };

  const openEdit = (nutriente: Nutriente) => {
    setEditingId(nutriente.id);
    setForm({ ...nutriente });
    setAliasesText(nutriente.aliases.join(', '));
  };

  const close = () => {
    setForm(null);
    setEditingId(null);
  };

  const save = async () => {
    if (!form) return;
    const sigla = form.sigla.trim();
    if (!sigla || !form.nome.trim()) {
      showError('Informe a sigla e o nome do nutriente.');
      return;
    }
    const duplicate = nutrientes.find(
      (item) => item.id !== editingId && item.sigla.trim().toUpperCase() === sigla.toUpperCase()
    );
    if (duplicate) {
      showError(`A sigla ${sigla} já está cadastrada (${duplicate.nome}).`);
      return;
    }
    const input = {
      ...form,
      aliases: aliasesText.split(',').map((alias) => alias.trim()),
    };
    setSaving(true);
    try {
      if (editingId) await updateNutriente(editingId, input);
      else await createNutriente(input);
      showSuccess(editingId ? 'Nutriente atualizado.' : 'Nutriente cadastrado.');
      close();
      onChanged();
    } catch (error) {
      showError(
        `Erro ao salvar nutriente: ${(error as { message?: string })?.message || 'tente novamente.'}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">
          As garantias dos produtos são escolhidas desta lista. O cálculo entende a sigla, o nome e
          os nomes alternativos como o mesmo nutriente.
        </p>
        {canManage && !form && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Novo nutriente
          </button>
        )}
      </div>

      {form && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-xs font-bold uppercase text-stone-500">
              Sigla
              <input
                value={form.sigla}
                maxLength={4}
                onChange={(event) => setForm({ ...form, sigla: event.target.value })}
                className={`${inputClass} mt-1`}
                placeholder="Zn"
              />
            </label>
            <label className="text-xs font-bold uppercase text-stone-500 lg:col-span-2">
              Nome
              <input
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                className={`${inputClass} mt-1`}
                placeholder="Zinco"
              />
            </label>
            <label className="text-xs font-bold uppercase text-stone-500">
              Tipo
              <select
                value={form.tipo}
                onChange={(event) =>
                  setForm({ ...form, tipo: event.target.value as NutrienteInput['tipo'] })
                }
                className={`${inputClass} mt-1`}
              >
                <option value="micro">Micronutriente</option>
                <option value="secundario">Secundário</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-stone-500">
              Ordem
              <input
                type="number"
                value={form.ordem}
                onChange={(event) => setForm({ ...form, ordem: Number(event.target.value) })}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
                className="h-4 w-4 rounded text-emerald-600"
              />
              Ativo
            </label>
            <label className="text-xs font-bold uppercase text-stone-500 sm:col-span-2 lg:col-span-6">
              Nomes alternativos (separados por vírgula)
              <input
                value={aliasesText}
                onChange={(event) => setAliasesText(event.target.value)}
                className={`${inputClass} mt-1`}
                placeholder="Ex.: ZINCO QUELATADO, ZN EDTA"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-xs font-bold uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Sigla</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="hidden px-4 py-3 md:table-cell">Nomes alternativos</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="w-12 px-4 py-3" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {nutrientes.map((nutriente) => (
              <tr key={nutriente.id} className={nutriente.ativo ? '' : 'opacity-60'}>
                <td className="px-4 py-3 font-mono text-base font-black text-emerald-700">
                  {nutriente.sigla}
                </td>
                <td className="px-4 py-3 font-medium text-stone-800">{nutriente.nome}</td>
                <td className="px-4 py-3 text-stone-600">{tipoLabel[nutriente.tipo]}</td>
                <td className="hidden px-4 py-3 text-xs text-stone-500 md:table-cell">
                  {nutriente.aliases.join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      nutriente.ativo
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {nutriente.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(nutriente)}
                      title="Editar"
                      className="rounded p-1.5 text-stone-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {nutrientes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  Nenhum nutriente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
