import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Database,
  Calendar,
  X,
  ChevronDown,
  Check,
  MapPin,
  GripVertical,
} from 'lucide-react';
import { RawMaterial, PriceList, MacroMaterial, MicroMaterial } from '../types';
import {
  getMacroMaterials,
  getMicroMaterials,
  getPriceLists,
  createPriceList,
  updatePriceList,
  deletePriceList,
} from '../services/db';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { User } from '../types';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { LocalCarregamento } from '../types/carregamento';

interface PriceListManagerProps {
  currentUser: User;
}

/** Convert MacroMaterial → RawMaterial row for the list */
const macroToRow = (m: MacroMaterial): RawMaterial => ({
  id: m.id,
  code: m.code,
  type: 'macro',
  name: m.name,
  price: 0,
  n: m.n,
  p: m.p,
  k: m.k,
  s: m.s,
  ca: m.ca,
  microGuarantees: m.microGuarantees || [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 0,
  categories: m.categories,
  isPremiumLine: m.isPremiumLine,
  formulaSuffix: m.formulaSuffix,
});

/** Convert MicroMaterial → RawMaterial row for the list */
const microToRow = (m: MicroMaterial): RawMaterial => ({
  id: m.id,
  code: m.code,
  type: 'micro',
  name: m.name,
  price: 0,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: m.microGuarantees || [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 0,
  categories: m.categories,
});

// ─────────────────────────────────────────────────────────
// Modal de seleção de itens
// ─────────────────────────────────────────────────────────
interface SelectModalProps {
  title: string;
  items: (MacroMaterial | MicroMaterial)[];
  alreadyAdded: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}

function SelectModal({ title, items, alreadyAdded, onSelect, onClose }: SelectModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = query.trim()
    ? items.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.code.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const handleConfirm = () => {
    onSelect([...selected]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-stone-100">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome ou código..."
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <p className="text-xs text-stone-400 mt-1">
            {filtered.length} item(s) disponíveis — {selected.size} selecionado(s)
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-stone-400 italic py-8 text-sm">Nenhum item encontrado</p>
          )}
          {filtered.map((m) => {
            const added = alreadyAdded.includes(m.id);
            const sel = selected.has(m.id);
            const isPremium = (m as MacroMaterial).isPremiumLine;
            return (
              <button
                key={m.id}
                onClick={() => !added && toggle(m.id)}
                disabled={added}
                className={`w-full text-left px-5 py-3 flex items-center gap-3 border-b border-stone-50 last:border-0 transition-colors
                  ${
                    added
                      ? 'opacity-40 cursor-not-allowed bg-stone-50'
                      : sel
                        ? 'bg-emerald-50'
                        : 'hover:bg-stone-50'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                  ${
                    added
                      ? 'bg-stone-200 border-stone-300'
                      : sel
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-stone-300'
                  }`}
                >
                  {(sel || added) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${isPremium ? 'text-amber-600' : 'text-blue-600'}`}
                    >
                      {m.code}
                    </span>
                    {isPremium && (
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-bold">
                        PREMIUM
                      </span>
                    )}
                    {added && (
                      <span className="text-[9px] bg-stone-200 text-stone-500 px-1 rounded font-bold">
                        JÁ ADICIONADO
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-stone-800 font-medium truncate">{m.name}</div>
                  {'n' in m && (
                    <div className="text-[10px] text-stone-400">
                      N:{(m as any).n} P:{(m as any).p} K:{(m as any).k} S:{(m as any).s} Ca:
                      {(m as any).ca}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-5 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PricingRow — linha da tabela de macro com preço maior
// ─────────────────────────────────────────────────────────
interface MacroRowProps {
  key?: React.Key;
  m: RawMaterial;
  currency: 'BRL' | 'USD';
  onChange: (id: string, field: keyof RawMaterial, value: string | number | boolean) => void;
  onRemove: (id: string) => void;
  premium?: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}
function MacroRow({
  m,
  currency,
  onChange,
  onRemove,
  premium,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: MacroRowProps) {
  return (
    <tr
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`${premium ? 'bg-amber-50/60' : 'hover:bg-stone-50/50'} ${isDragOver ? 'border-t-2 border-emerald-500' : ''}`}
    >
      <td className="px-2 py-1 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-stone-300" />
      </td>
      <td
        className={`px-2 py-2 font-mono text-xs font-bold ${premium ? 'text-amber-600' : 'text-blue-600'}`}
      >
        {m.code}
      </td>
      <td className="px-2 py-2 text-xs text-stone-700 font-medium max-w-[160px] truncate">
        {m.name}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-stone-400 flex-shrink-0">
            {currency === 'BRL' ? 'R$' : '$'}
          </span>
          <input
            type="number"
            value={m.price === 0 ? '' : m.price}
            onChange={(e) => onChange(m.id, 'price', Number(e.target.value))}
            className="w-24 px-2 py-1 border border-stone-200 rounded text-xs font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </td>
      {(['n', 'p', 'k', 's', 'ca'] as const).map((f) => (
        <td key={f} className="px-2 py-2 text-center">
          <span className={`text-xs font-mono ${premium ? 'text-amber-500' : 'text-stone-400'}`}>
            {(m as any)[f] || 0}
          </span>
        </td>
      ))}
      <td className="px-2 py-2 text-right">
        <button
          onClick={() => onRemove(m.id)}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
export default function PriceListManager({ currentUser }: PriceListManagerProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [allMacros, setAllMacros] = useState<MacroMaterial[]>([]);
  const [allMicros, setAllMicros] = useState<MicroMaterial[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [locaisCarregamento, setLocaisCarregamento] = useState<LocalCarregamento[]>([]);
  const [listName, setListName] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [dollarRate, setDollarRate] = useState<number>(0);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [macros, setMacros] = useState<RawMaterial[]>([]);
  const [micros, setMicros] = useState<RawMaterial[]>([]);

  // modal state
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [showMicroModal, setShowMicroModal] = useState(false);

  // drag state
  const [dragIndex, setDragIndex] = useState<{ type: 'macro' | 'micro'; index: number } | null>(
    null
  );
  const [dragOverIndex, setDragOverIndex] = useState<{
    type: 'macro' | 'micro';
    index: number;
  } | null>(null);

  const handleDragStart = (type: 'macro' | 'micro', index: number) => {
    setDragIndex({ type, index });
  };

  const handleDragOver = (e: React.DragEvent, type: 'macro' | 'micro', index: number) => {
    e.preventDefault();
    setDragOverIndex({ type, index });
  };

  const handleDrop = (type: 'macro' | 'micro', toIndex: number) => {
    if (!dragIndex || dragIndex.type !== type) return;
    const fromIndex = dragIndex.index;
    if (fromIndex === toIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    if (type === 'macro') {
      setMacros((prev) => {
        const arr = [...prev];
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item);
        return arr;
      });
    } else {
      setMicros((prev) => {
        const arr = [...prev];
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item);
        return arr;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const [m, mi, pl] = await Promise.all([
        getMacroMaterials(),
        getMicroMaterials(),
        getPriceLists(),
      ]);
      setAllMacros(m);
      setAllMicros(mi);
      setPriceLists(pl);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => {
    getLocaisAtivos()
      .then(setLocaisCarregamento)
      .catch(() => setLocaisCarregamento([]));
  }, []);

  const handleMacroChange = (
    id: string,
    field: keyof RawMaterial,
    value: string | number | boolean
  ) => setMacros((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const handleMicroChange = (
    id: string,
    field: keyof RawMaterial,
    value: string | number | boolean
  ) => setMicros((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const addMacrosFromModal = (ids: string[]) => {
    const toAdd = allMacros.filter((m) => ids.includes(m.id) && !macros.some((x) => x.id === m.id));
    setMacros((prev) => [...prev, ...toAdd.map(macroToRow)]);
  };

  const addMicrosFromModal = (ids: string[]) => {
    const toAdd = allMicros.filter((m) => ids.includes(m.id) && !micros.some((x) => x.id === m.id));
    setMicros((prev) => [...prev, ...toAdd.map(microToRow)]);
  };

  const cancelForm = () => {
    setListName('');
    setMacros([]);
    setMicros([]);
    setCurrency('BRL');
    setExchangeRate(0);
    setDollarRate(0);
    setEditingListId(null);
    setSelectedLocalId('');
  };

  const savePriceList = async () => {
    const canEdit =
      currentUser.role === 'master' ||
      currentUser.role === 'admin' ||
      currentUser.role === 'manager' ||
      (currentUser.permissions as any)?.macro_edit !== false;
    if (!canEdit) {
      showError('Você não tem permissão para salvar novas listas de preços.');
      return;
    }
    if (!listName.trim()) {
      showError('Dê um nome para a lista antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      if (editingListId) {
        await updatePriceList(editingListId, {
          name: listName.trim(),
          local_carregamento_id: selectedLocalId || undefined,
          currency,
          exchangeRate: currency === 'USD' ? exchangeRate : undefined,
          dollarRate: currency === 'BRL' ? dollarRate : undefined,
          macros,
          micros,
        });
        setPriceLists((prev) =>
          prev.map((p) =>
            p.id === editingListId
              ? {
                  ...p,
                  name: listName.trim(),
                  local_carregamento_id: selectedLocalId || undefined,
                  currency,
                  exchangeRate: currency === 'USD' ? exchangeRate : undefined,
                  dollarRate: currency === 'BRL' ? dollarRate : undefined,
                  macros,
                  micros,
                }
              : p
          )
        );
        cancelForm();
        showSuccess('Lista de preços atualizada com sucesso!');
      } else {
        const newList = await createPriceList({
          name: listName.trim(),
          local_carregamento_id: selectedLocalId || undefined,
          date: new Date().toISOString(),
          currency,
          exchangeRate: currency === 'USD' ? exchangeRate : undefined,
          dollarRate: currency === 'BRL' ? dollarRate : undefined,
          macros,
          micros,
        });
        setPriceLists((prev) => [newList, ...prev]);
        cancelForm();
        showSuccess('Lista de preços salva com sucesso!');
      }
    } catch (err: unknown) {
      showError(`Erro ao salvar: ${err instanceof Error ? err.message : 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    const canDelete =
      currentUser.role === 'master' ||
      currentUser.role === 'admin' ||
      currentUser.role === 'manager' ||
      (currentUser.permissions as any)?.macro_delete !== false;
    if (!canDelete) {
      showError('Você não tem permissão para excluir listas de preços.');
      return;
    }

    const ok = await confirm({
      title: 'Excluir lista de preço?',
      message: 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deletePriceList(id);
      setPriceLists((prev) => prev.filter((x) => x.id !== id));
      showSuccess('Lista excluída com sucesso!');
    } catch {
      showError('Erro ao excluir lista.');
    }
  };

  const normalMacros = macros.filter((m) => !m.isPremiumLine);
  const premiumMacros = macros.filter((m) => m.isPremiumLine);
  const macroIndexMap = new Map(macros.map((m, i) => [m.id, i]));

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      {/* Modals */}
      {showMacroModal && (
        <SelectModal
          title="Selecionar Macronutrientes"
          items={allMacros}
          alreadyAdded={macros.map((m) => m.id)}
          onSelect={addMacrosFromModal}
          onClose={() => setShowMacroModal(false)}
        />
      )}
      {showMicroModal && (
        <SelectModal
          title="Selecionar Micronutrientes"
          items={allMicros}
          alreadyAdded={micros.map((m) => m.id)}
          onSelect={addMicrosFromModal}
          onClose={() => setShowMicroModal(false)}
        />
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          Gerenciamento de Listas de Preços
        </h2>

        {/* Form header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center">
              <MapPin className="w-4 h-4 mr-1" /> Local de Carregamento
            </label>
            <select
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Nenhum (opcional) —</option>
              {locaisCarregamento.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.cidade ? ` — ${l.cidade}${l.estado ? `/${l.estado}` : ''}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Moeda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'BRL' | 'USD')}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar (US$)</option>
            </select>
          </div>

          {currency === 'USD' && (
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Taxa do Dólar (R$)
              </label>
              <input
                type="number"
                value={exchangeRate === 0 ? '' : exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          )}

          {currency === 'BRL' && (
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">
                Câmbio p/ Ref. (US$)
              </label>
              <input
                type="number"
                value={dollarRate === 0 ? '' : dollarRate}
                onChange={(e) => setDollarRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
                title="Apenas para registro visual na lista"
              />
            </div>
          )}

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-stone-600 mb-1">Nome da Lista</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePriceList()}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Identificação da lista..."
              />
              {(currentUser.role === 'master' ||
                currentUser.role === 'admin' ||
                currentUser.role === 'manager' ||
                (currentUser.permissions as any)?.macro_edit !== false) && (
                <button
                  onClick={savePriceList}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              )}
              <button
                onClick={cancelForm}
                title="Cancelar preenchimento"
                className="border border-stone-300 text-stone-500 hover:text-red-600 hover:border-red-300 px-3 py-2 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* MACROS */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-stone-700">Preços Macronutrientes</h3>
              <button
                onClick={() => setShowMacroModal(true)}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
              >
                <Plus className="w-3 h-3" />
                Selecionar Macros
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-2 py-2 w-6"></th>
                    <th className="px-2 py-2 text-left">Cód</th>
                    <th className="px-2 py-2 text-left">Matéria Prima</th>
                    <th className="px-2 py-2 text-left">
                      Preço ({currency === 'BRL' ? 'R$' : 'US$'})
                    </th>
                    <th className="px-2 py-2 text-center">N</th>
                    <th className="px-2 py-2 text-center">P</th>
                    <th className="px-2 py-2 text-center">K</th>
                    <th className="px-2 py-2 text-center">S</th>
                    <th className="px-2 py-2 text-center">Ca</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {normalMacros.length === 0 && premiumMacros.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-stone-300 italic">
                        Clique em "Selecionar Macros" para adicionar itens
                      </td>
                    </tr>
                  )}
                  {normalMacros.map((m) => {
                    const idx = macroIndexMap.get(m.id);
                    if (idx === undefined) return null;
                    return (
                      <MacroRow
                        key={m.id}
                        m={m}
                        currency={currency}
                        onChange={handleMacroChange}
                        onRemove={(id) => setMacros((prev) => prev.filter((x) => x.id !== id))}
                        onDragStart={() => handleDragStart('macro', idx)}
                        onDragOver={(e) => handleDragOver(e, 'macro', idx)}
                        onDrop={() => handleDrop('macro', idx)}
                        onDragEnd={handleDragEnd}
                        isDragOver={dragOverIndex?.type === 'macro' && dragOverIndex?.index === idx}
                      />
                    );
                  })}
                  {premiumMacros.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={10}
                          className="px-3 py-1.5 bg-amber-50 border-t-2 border-amber-200"
                        >
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            ⭐ Linha Diferenciada / Premium
                          </span>
                        </td>
                      </tr>
                      {premiumMacros.map((m) => {
                        const idx = macroIndexMap.get(m.id);
                        if (idx === undefined) return null;
                        return (
                          <MacroRow
                            key={m.id}
                            m={m}
                            currency={currency}
                            premium
                            onChange={handleMacroChange}
                            onRemove={(id) => setMacros((prev) => prev.filter((x) => x.id !== id))}
                            onDragStart={() => handleDragStart('macro', idx)}
                            onDragOver={(e) => handleDragOver(e, 'macro', idx)}
                            onDrop={() => handleDrop('macro', idx)}
                            onDragEnd={handleDragEnd}
                            isDragOver={
                              dragOverIndex?.type === 'macro' && dragOverIndex?.index === idx
                            }
                          />
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MICROS */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-stone-700">Preços Micronutrientes</h3>
              <button
                onClick={() => setShowMicroModal(true)}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
              >
                <Plus className="w-3 h-3" />
                Selecionar Micros
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-2 py-2 w-6"></th>
                    <th className="px-2 py-2 text-left">Cód</th>
                    <th className="px-2 py-2 text-left">Micronutriente</th>
                    <th className="px-2 py-2 text-left">
                      Preço ({currency === 'BRL' ? 'R$' : 'US$'})
                    </th>
                    <th className="px-2 py-2 text-left">Garantias</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {micros.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-stone-300 italic">
                        Clique em "Selecionar Micros" para adicionar itens
                      </td>
                    </tr>
                  )}
                  {micros.map((m, idx) => (
                    <tr
                      key={m.id}
                      draggable={true}
                      onDragStart={() => handleDragStart('micro', idx)}
                      onDragOver={(e) => handleDragOver(e, 'micro', idx)}
                      onDrop={() => handleDrop('micro', idx)}
                      onDragEnd={handleDragEnd}
                      className={`hover:bg-stone-50/50 ${dragOverIndex?.type === 'micro' && dragOverIndex?.index === idx ? 'border-t-2 border-emerald-500' : ''}`}
                    >
                      <td className="px-2 py-1 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-stone-300" />
                      </td>
                      <td className="px-2 py-2 font-mono text-emerald-600 font-bold">{m.code}</td>
                      <td className="px-2 py-2 text-stone-700 font-medium max-w-[140px] truncate">
                        {m.name}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-stone-400">
                            {currency === 'BRL' ? 'R$' : '$'}
                          </span>
                          <input
                            type="number"
                            value={m.price === 0 ? '' : m.price}
                            onChange={(e) =>
                              handleMicroChange(m.id, 'price', Number(e.target.value))
                            }
                            className="w-24 px-2 py-1 border border-stone-200 rounded text-xs font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 outline-none"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {m.microGuarantees.map((g, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-bold"
                            >
                              {g.name}: {g.value}%
                            </span>
                          ))}
                          {m.microGuarantees.length === 0 && (
                            <span className="text-[10px] text-stone-300 italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => setMicros((prev) => prev.filter((x) => x.id !== m.id))}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de listas */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-stone-400" />
          Histórico de Listas de Preços
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && (
            <div className="col-span-full py-8 text-center text-stone-400">Carregando...</div>
          )}
          {!loading && priceLists.length === 0 && (
            <div className="col-span-full py-8 text-center text-stone-400 italic">
              Nenhuma lista de preços salva.
            </div>
          )}
          {!loading &&
            priceLists.map((list) => (
              <div
                key={list.id}
                className="p-4 border border-stone-200 rounded-xl hover:border-emerald-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-stone-800 truncate pr-2">{list.name}</h4>
                  {(currentUser.role === 'master' ||
                    currentUser.role === 'admin' ||
                    currentUser.role === 'manager' ||
                    (currentUser.permissions as any)?.macro_delete !== false) && (
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="text-red-400 hover:text-red-600 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1 text-xs text-stone-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-500" />
                    <span>
                      {locaisCarregamento.find((l) => l.id === list.local_carregamento_id)?.nome ??
                        'Sem local vinculado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(list.date).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {list.macros.length} macro(s) · {list.micros.length} micro(s)
                  </div>
                </div>
                <div className="text-[10px] text-stone-400 font-mono mt-1 mb-2">ID: {list.id}</div>
                <div className="mt-2 pt-3 flex flex-wrap items-center gap-3 border-t border-stone-100">
                  <button
                    onClick={() => {
                      setMacros(list.macros);
                      setMicros(list.micros);
                      setSelectedLocalId(list.local_carregamento_id || '');
                      setCurrency(list.currency || 'BRL');
                      if (list.currency === 'USD') setExchangeRate(list.exchangeRate || 0);
                      if (list.currency === 'BRL') setDollarRate(list.dollarRate || 0);
                      setListName(list.name);
                      setEditingListId(list.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Visualizar / Editar
                  </button>
                  <button
                    onClick={() => {
                      setMacros(list.macros);
                      setMicros(list.micros);
                      setSelectedLocalId(list.local_carregamento_id || '');
                      setCurrency(list.currency || 'BRL');
                      if (list.currency === 'USD') setExchangeRate(list.exchangeRate || 0);
                      if (list.currency === 'BRL') setDollarRate(list.dollarRate || 0);
                      setListName(list.name + ' (Cópia)');
                      setEditingListId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs text-emerald-600 font-bold hover:underline"
                  >
                    Copiar P/ Novo
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
