import React, { useState, useEffect } from 'react';
import { X, Search, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { TargetFormula, RawMaterial } from '../types';
import { microGuaranteePercentToKg, microKgToGuaranteePercent } from '../utils/microGuarantee';

interface CalculatorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formula: TargetFormula | null;
  globalMacros: RawMaterial[];
  globalMicros: RawMaterial[];
  isMaterialsLoading?: boolean;
  hasNoMaterialsInDatabase?: boolean;
  protectedMaterialIds?: string[];
  onConfirm: (updatedFormula: TargetFormula) => void;
}

export const CalculatorSettingsModal: React.FC<CalculatorSettingsModalProps> = ({
  isOpen,
  onClose,
  formula,
  globalMacros,
  globalMicros,
  isMaterialsLoading = false,
  hasNoMaterialsInDatabase = false,
  protectedMaterialIds = [],
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'macros' | 'micros'>('macros');
  const [localFormula, setLocalFormula] = useState<TargetFormula | null>(null);
  const [search, setSearch] = useState('');
  const [productOrder, setProductOrder] = useState<Record<'macro' | 'micro', string[]>>({
    macro: [],
    micro: [],
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [microInputMode, setMicroInputMode] = useState<Record<string, 'kg' | 'percent'>>({});
  const [microGuaranteeName, setMicroGuaranteeName] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && formula) {
      setLocalFormula(JSON.parse(JSON.stringify(formula)));
      setSearch('');
      setActiveTab('macros');
      setProductOrder({
        macro: globalMacros.map((product) => product.id),
        micro: globalMicros.map((product) => product.id),
      });
      setMicroInputMode({});
      setMicroGuaranteeName({});
    }
  }, [isOpen, formula, globalMacros, globalMicros]);

  if (!isOpen) return null;

  const handleSelectProduct = (productId: string, type: 'macro' | 'micro') => {
    if (!localFormula) return;
    if (
      protectedMaterialIds.includes(productId) ||
      (type === 'micro' && protectedMaterialIds.length > 0)
    ) {
      return;
    }

    const arrKey = type === 'macro' ? 'macros' : 'micros';
    const savedArr = localFormula[arrKey] || [];
    const globalSource = type === 'macro' ? globalMacros : globalMicros;

    const isSelected = savedArr.some((p) => p.id === productId);

    if (isSelected) {
      // Deselect -> remove from array
      setLocalFormula({
        ...localFormula,
        [arrKey]: savedArr.filter((p) => p.id !== productId),
      });
    } else {
      // Select -> add to array
      const globalP = globalSource.find((p) => p.id === productId);
      if (globalP) {
        setLocalFormula({
          ...localFormula,
          [arrKey]: [
            ...savedArr,
            {
              ...globalP,
              selected: true,
              minQty: globalP.minQuantity || 0,
              maxQty: 0,
              quantity: 0,
            },
          ],
        });
      }
    }
  };

  const handleConfirm = () => {
    if (localFormula) {
      onConfirm({
        ...localFormula,
        macros: [...localFormula.macros].sort(
          (a, b) => productOrder.macro.indexOf(a.id) - productOrder.macro.indexOf(b.id)
        ),
        micros: [...localFormula.micros].sort(
          (a, b) => productOrder.micro.indexOf(a.id) - productOrder.micro.indexOf(b.id)
        ),
      });
    }
    onClose();
  };

  const moveProduct = (type: 'macro' | 'micro', productId: string, direction: -1 | 1) => {
    setProductOrder((current) => {
      const next = [...current[type]];
      const from = next.indexOf(productId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return { ...current, [type]: next };
    });
  };

  const renderProducts = (f: TargetFormula, type: 'macro' | 'micro') => {
    const savedProducts = type === 'macro' ? f.macros || [] : f.micros || [];
    const globalSource = type === 'macro' ? globalMacros : globalMicros;

    // Map all global products to show them all, but inject state if they are selected
    const currentProducts = globalSource
      .map((globalP) => {
        const savedP = savedProducts.find((s) => s.id === globalP.id);
        return savedP ? savedP : { ...globalP, selected: false, minQty: 0, maxQty: 0, quantity: 0 };
      })
      .sort((a, b) => productOrder[type].indexOf(a.id) - productOrder[type].indexOf(b.id));

    const filtered = currentProducts.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    if (isMaterialsLoading) {
      return (
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Carregando matérias-primas cadastradas...
        </div>
      );
    }

    if (currentProducts.length === 0 && hasNoMaterialsInDatabase) {
      return (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Nenhuma matéria-prima cadastrada. Acesse o cadastro de produtos para adicionar.
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Nenhum produto encontrado para o filtro informado.
        </div>
      );
    }

    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
        {filtered.map((p) =>
          (() => {
            const isProtected =
              protectedMaterialIds.includes(p.id) ||
              (type === 'micro' && protectedMaterialIds.length > 0);
            return (
              <div
                key={p.id}
                draggable={!search && !isProtected}
                onDragStart={() => setDraggedId(p.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedId || draggedId === p.id) return;
                  setProductOrder((current) => {
                    const next = [...current[type]];
                    const from = next.indexOf(draggedId);
                    const to = next.indexOf(p.id);
                    if (from < 0 || to < 0) return current;
                    next.splice(from, 1);
                    next.splice(to, 0, draggedId);
                    return { ...current, [type]: next };
                  });
                  setDraggedId(null);
                }}
                className={`p-3 transition-colors ${
                  p.selected ? 'bg-blue-50' : 'bg-white hover:bg-stone-50'
                }`}
              >
                {/* Header / Selection Toggle */}
                <div
                  className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[auto_minmax(180px,1fr)_minmax(220px,1.2fr)] ${isProtected ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                  onClick={() => handleSelectProduct(p.id, type)}
                >
                  <div className="mt-1 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-stone-300" aria-hidden="true" />
                    <input
                      type="checkbox"
                      checked={!!p.selected}
                      readOnly
                      disabled={isProtected}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col sm:hidden">
                      <button
                        type="button"
                        aria-label={`Mover ${p.name} para cima`}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveProduct(type, p.id, -1);
                        }}
                        disabled={isProtected || productOrder[type].indexOf(p.id) === 0}
                        className="text-stone-400 disabled:opacity-20"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover ${p.name} para baixo`}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveProduct(type, p.id, 1);
                        }}
                        disabled={
                          isProtected ||
                          productOrder[type].indexOf(p.id) === productOrder[type].length - 1
                        }
                        className="text-stone-400 disabled:opacity-20"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${p.selected ? 'text-blue-800' : 'text-stone-700'}`}
                    >
                      {p.name}
                    </div>
                    {isProtected && (
                      <div className="text-[10px] font-bold text-amber-700">
                        Protegido para preservar a descrição da formulação
                      </div>
                    )}
                  </div>
                  <div className="col-start-2 text-xs text-stone-500 sm:col-start-3">
                    {type === 'macro'
                      ? `N ${p.n}% · P ${p.p}% · K ${p.k}% · S ${p.s || 0}% · Ca ${p.ca || 0}%`
                      : p.microGuarantees?.length
                        ? p.microGuarantees
                            .map((g: { name: string; value: number }) => `${g.name} ${g.value}%`)
                            .join(' · ')
                        : 'Garantias não cadastradas'}
                  </div>
                </div>

                {/* Extended Input Fields */}
                {p.selected && (
                  <div className="mt-3 border-t border-blue-200/50 pt-3 text-xs">
                    {type === 'micro' && p.microGuarantees?.length > 0 && (
                      <div className="mb-3 grid gap-2 rounded-lg bg-white/70 p-3 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 font-semibold text-stone-500">
                          Informar por
                          <select
                            value={microInputMode[p.id] || 'kg'}
                            onChange={(event) =>
                              setMicroInputMode((current) => ({
                                ...current,
                                [p.id]: event.target.value as 'kg' | 'percent',
                              }))
                            }
                            className="rounded border border-blue-300 bg-white px-2 py-1.5 text-stone-800"
                          >
                            <option value="kg">Quantidade em kg</option>
                            <option value="percent">Garantia desejada (%)</option>
                          </select>
                        </label>
                        {(microInputMode[p.id] || 'kg') === 'percent' && (
                          <>
                            <label className="flex flex-col gap-1 font-semibold text-stone-500">
                              Garantia
                              <select
                                value={microGuaranteeName[p.id] || p.microGuarantees[0].name}
                                onChange={(event) =>
                                  setMicroGuaranteeName((current) => ({
                                    ...current,
                                    [p.id]: event.target.value,
                                  }))
                                }
                                className="rounded border border-blue-300 bg-white px-2 py-1.5 text-stone-800"
                              >
                                {p.microGuarantees.map((guarantee) => (
                                  <option key={guarantee.name} value={guarantee.name}>
                                    {guarantee.name} ({guarantee.value}%)
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 font-semibold text-stone-500">
                              Garantia final desejada (%)
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={(() => {
                                  const guarantee = p.microGuarantees.find(
                                    (item) =>
                                      item.name ===
                                      (microGuaranteeName[p.id] || p.microGuarantees[0].name)
                                  );
                                  const fixedKg = p.minQty === p.maxQty ? p.minQty : 0;
                                  return fixedKg && guarantee
                                    ? microKgToGuaranteePercent(fixedKg, guarantee.value)
                                    : '';
                                })()}
                                onChange={(event) => {
                                  if (!localFormula) return;
                                  const guarantee = p.microGuarantees.find(
                                    (item) =>
                                      item.name ===
                                      (microGuaranteeName[p.id] || p.microGuarantees[0].name)
                                  );
                                  const kg = microGuaranteePercentToKg(
                                    Number(event.target.value),
                                    guarantee?.value || 0
                                  );
                                  setLocalFormula({
                                    ...localFormula,
                                    micros: localFormula.micros.map((micro) =>
                                      micro.id === p.id
                                        ? { ...micro, minQty: kg, maxQty: kg }
                                        : micro
                                    ),
                                  });
                                }}
                                className="rounded border border-blue-300 bg-white px-2 py-1.5 text-stone-800"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex flex-col flex-1 min-w-[30%]">
                        <label className="text-stone-500 font-semibold mb-1">Mínimo (kg)</label>
                        <input
                          type="number"
                          value={p.minQty === 0 && p.minQuantity === 0 ? '' : p.minQty}
                          onChange={(e) => {
                            if (!localFormula) return;
                            const val = Number(e.target.value);
                            const arrKey = type === 'macro' ? 'macros' : 'micros';
                            setLocalFormula({
                              ...localFormula,
                              [arrKey]: localFormula[arrKey].map((m) =>
                                m.id === p.id ? { ...m, minQty: val } : m
                              ),
                            });
                          }}
                          placeholder={`Ex: ${p.minQuantity || 0}`}
                          min={0}
                          disabled={isProtected}
                          className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                        />
                      </div>

                      <div className="flex flex-col flex-1 min-w-[30%]">
                        <label className="text-stone-500 font-semibold mb-1">Máximo (kg)</label>
                        <input
                          type="number"
                          value={p.maxQty === 0 ? '' : p.maxQty}
                          onChange={(e) => {
                            if (!localFormula) return;
                            const val = Number(e.target.value);
                            const arrKey = type === 'macro' ? 'macros' : 'micros';
                            setLocalFormula({
                              ...localFormula,
                              [arrKey]: localFormula[arrKey].map((m) =>
                                m.id === p.id ? { ...m, maxQty: val } : m
                              ),
                            });
                          }}
                          placeholder="Sem Limite"
                          min={0}
                          disabled={isProtected}
                          className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                        />
                      </div>

                      <div className="flex flex-col flex-1 min-w-[30%]">
                        <label className="text-stone-500 font-semibold mb-1">Fixo (kg)</label>
                        <input
                          type="number"
                          value={p.minQty === p.maxQty && p.minQty > 0 ? p.minQty : ''}
                          onChange={(e) => {
                            if (!localFormula) return;
                            const val = Number(e.target.value);
                            const arrKey = type === 'macro' ? 'macros' : 'micros';
                            setLocalFormula({
                              ...localFormula,
                              [arrKey]: localFormula[arrKey].map((m) =>
                                m.id === p.id ? { ...m, minQty: val, maxQty: val } : m
                              ),
                            });
                          }}
                          placeholder="Auto"
                          min={0}
                          disabled={isProtected}
                          className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-white text-stone-800"
                          title="Preencher isso força a usar exatamente essa quantidade (iguala min e max)"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">Produtos da Fórmula</h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters/Tabs */}
        <div className="p-4 border-b border-stone-100 flex gap-4">
          <button
            onClick={() => setActiveTab('macros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'macros'
                ? 'bg-blue-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Matérias-Primas (Macro)
          </button>
          <button
            onClick={() => setActiveTab('micros')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'micros'
                ? 'bg-blue-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Micronutrientes
          </button>

          <div className="ml-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-stone-50/50">
          {!localFormula ? (
            <div className="text-center text-stone-500 py-8">Nenhuma fórmula selecionada.</div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="font-semibold text-stone-800 border-b border-stone-100 pb-3 mb-4 flex justify-between items-center">
                <span>
                  Configurando Fórmula:{' '}
                  <span className="text-blue-600">{localFormula.formula || 'Sem nome'}</span>
                </span>
                <span className="text-xs font-normal text-stone-500 hidden sm:block">
                  Ordem inicial da lista de preços · arraste para reorganizar
                </span>
              </h3>
              {renderProducts(localFormula, activeTab === 'macros' ? 'macro' : 'micro')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-stone-100 flex justify-end gap-3 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 border border-transparent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            Confirmar Seleção
          </button>
        </div>
      </div>
    </div>
  );
};
