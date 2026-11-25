import React, { useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2, X } from 'lucide-react';
import type { MicroGuarantee, RawMaterial } from '../../types';
import type { Nutriente } from '../../services/nutrientesService';
import { NumericInput } from '../ui/NumericInput';

export interface CustomMaterialDraft {
  name: string;
  n: number;
  p: number;
  k: number;
  s: number;
  ca: number;
  microGuarantees: MicroGuarantee[];
  price: number;
  minQty: number;
  maxQty: number;
}

const emptyDraft: CustomMaterialDraft = {
  name: '',
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  price: 0,
  minQty: 0,
  maxQty: 0,
};

/** Problema que impede adicionar, ou null. */
export function customMaterialProblem(draft: CustomMaterialDraft): string | null {
  if (!draft.name.trim()) return 'Informe o nome da matéria-prima.';
  const values = [draft.n, draft.p, draft.k, draft.s, draft.ca];
  if (values.some((value) => value < 0 || value > 100))
    return 'As garantias devem ficar entre 0 e 100%.';
  const hasGuarantee =
    values.some((value) => value > 0) ||
    draft.microGuarantees.some((guarantee) => guarantee.name && guarantee.value > 0);
  if (!hasGuarantee) return 'Informe ao menos uma garantia.';
  if (draft.price < 0) return 'O preço não pode ser negativo.';
  if (draft.minQty < 0 || draft.maxQty < 0) return 'As quantidades não podem ser negativas.';
  if (draft.maxQty > 0 && draft.minQty > draft.maxQty)
    return 'A quantidade mínima não pode ser maior que a máxima.';
  return null;
}

/**
 * Matéria-prima informada pelo usuário: vale só nesta precificação (não entra no
 * cadastro) e o cálculo a trata como qualquer macro, somando NPK, S, Ca e micros.
 */
export function buildCustomMaterial(draft: CustomMaterialDraft, order: number): RawMaterial {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'macro',
    code: 'PERS',
    name: draft.name.trim(),
    n: draft.n,
    p: draft.p,
    k: draft.k,
    s: draft.s,
    ca: draft.ca,
    microGuarantees: draft.microGuarantees.filter(
      (guarantee) => guarantee.name && guarantee.value > 0
    ),
    price: draft.price,
    listPrice: 0,
    isManualPrice: false,
    isCustomMaterial: true,
    selected: true,
    quantity: 0,
    minQty: draft.minQty,
    maxQty: draft.maxQty,
    minQuantity: draft.minQty,
    maxQuantity: draft.maxQty,
    categories: [],
    materialOrder: order,
  } as RawMaterial;
}

const input =
  'h-10 rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'text-[11px] font-bold uppercase tracking-wide text-stone-500';

export default function CustomMaterialForm({
  currency,
  onAdd,
  onCancel,
}: {
  currency: 'BRL' | 'USD';
  onAdd: (draft: CustomMaterialDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CustomMaterialDraft>(emptyDraft);
  const [nutrientes, setNutrientes] = useState<Nutriente[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // Carregado só quando o formulário abre (o modal não depende do banco para abrir).
    import('../../services/nutrientesService')
      .then(({ getNutrientes }) => getNutrientes())
      .then((list) => setNutrientes(list.filter((item) => item.ativo)))
      .catch(() => setNutrientes([]));
  }, []);

  const set = (patch: Partial<CustomMaterialDraft>) => {
    setProblem(null);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const symbol = currency === 'USD' ? 'US$' : 'R$';

  const submit = () => {
    const found = customMaterialProblem(draft);
    if (found) {
      setProblem(found);
      return;
    }
    onAdd(draft);
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-black text-violet-900">
            <FlaskConical className="h-4 w-4" /> Matéria-prima personalizada
          </p>
          <p className="text-xs text-violet-800">
            Vale só nesta precificação e não entra no cadastro. O cálculo considera todas as
            garantias.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar matéria-prima personalizada"
          className="rounded-lg p-1.5 text-violet-500 hover:bg-violet-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block">
        <span className={labelClass}>Nome</span>
        <input
          value={draft.name}
          onChange={(event) => set({ name: event.target.value })}
          placeholder="Ex.: Sulfato especial do fornecedor X"
          className={`${input} mt-1 w-full`}
        />
      </label>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {(['n', 'p', 'k', 's', 'ca'] as const).map((key) => (
          <label key={key}>
            <span className={labelClass}>{key === 'ca' ? 'Ca' : key.toUpperCase()} %</span>
            <NumericInput
              value={draft[key]}
              onValueChange={(value) => set({ [key]: value })}
              className={`${input} mt-1 w-full text-center font-mono`}
            />
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-violet-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Micros e secundários</span>
          <button
            type="button"
            onClick={() =>
              set({ microGuarantees: [...draft.microGuarantees, { name: '', value: 0 }] })
            }
            className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800 hover:bg-violet-200"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {draft.microGuarantees.map((guarantee, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={guarantee.name}
                aria-label="Nutriente"
                onChange={(event) =>
                  set({
                    microGuarantees: draft.microGuarantees.map((item, i) =>
                      i === index ? { ...item, name: event.target.value } : item
                    ),
                  })
                }
                className={`${input} min-w-0 flex-1`}
              >
                <option value="">Selecione…</option>
                {nutrientes.map((nutriente) => (
                  <option key={nutriente.id} value={nutriente.sigla}>
                    {nutriente.sigla} – {nutriente.nome}
                  </option>
                ))}
              </select>
              <NumericInput
                aria-label="Garantia em %"
                value={guarantee.value}
                onValueChange={(value) =>
                  set({
                    microGuarantees: draft.microGuarantees.map((item, i) =>
                      i === index ? { ...item, value } : item
                    ),
                  })
                }
                className={`${input} w-24 shrink-0 text-right font-mono`}
              />
              <button
                type="button"
                aria-label="Remover nutriente"
                onClick={() =>
                  set({ microGuarantees: draft.microGuarantees.filter((_, i) => i !== index) })
                }
                className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {draft.microGuarantees.length === 0 && (
            <p className="text-center text-xs text-stone-400">Nenhum micro adicionado.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label>
          <span className={labelClass}>Preço ({symbol}/t)</span>
          <NumericInput
            value={draft.price}
            onValueChange={(value) => set({ price: value })}
            className={`${input} mt-1 w-full text-right font-mono`}
          />
        </label>
        <label>
          <span className={labelClass}>Mínimo (kg)</span>
          <NumericInput
            value={draft.minQty}
            onValueChange={(value) => set({ minQty: value })}
            className={`${input} mt-1 w-full text-right font-mono`}
          />
        </label>
        <label>
          <span className={labelClass}>Máximo (kg, 0 = sem limite)</span>
          <NumericInput
            value={draft.maxQty}
            onValueChange={(value) => set({ maxQty: value })}
            className={`${input} mt-1 w-full text-right font-mono`}
          />
        </label>
      </div>

      {problem && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {problem}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> Adicionar à fórmula
        </button>
      </div>
    </div>
  );
}
