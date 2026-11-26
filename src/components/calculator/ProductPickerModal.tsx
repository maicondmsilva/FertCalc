import { getPriceWarnings, materialNames } from '../../utils/unpricedMaterials';
import CustomMaterialForm, { buildCustomMaterial } from './CustomMaterialForm';
import {
  filterCounts,
  guaranteeChips,
  isPicked,
  matchesFilter,
  matchesSearch,
  targetCoverage,
  type ProductFilter,
} from './productPickerModel';
import { isUnpricedMaterial } from '../../utils/unpricedMaterials';
import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  FlaskConical,
  Trash2,
  Check,
  Star,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { TargetFormula, RawMaterial } from '../../types';
import { microGuaranteePercentToKg } from '../../utils/microGuarantee';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { belongsToCategory } from '../../utils/categoryFilter';
import { useModalBackNavigation } from '../../hooks/useModalBackNavigation';
import {
  applyTemporaryMaterialPrice,
  restoreOfficialMaterialPrice,
} from '../../utils/temporaryMaterialPrice';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  formula: TargetFormula | null;
  globalMacros: RawMaterial[];
  globalMicros: RawMaterial[];
  isMaterialsLoading?: boolean;
  hasNoMaterialsInDatabase?: boolean;
  protectedMaterialIds?: string[];
  currency?: 'BRL' | 'USD';
  onConfirm: (updatedFormula: TargetFormula) => void;
}

/**
 * Tela de Produtos da fórmula, visual novo (Calculadora teste). Mesma lógica do
 * CalculatorSettingsModal das calculadoras oficiais, que continua com o visual atual.
 */
export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  isOpen,
  onClose,
  formula,
  globalMacros,
  globalMicros,
  isMaterialsLoading = false,
  hasNoMaterialsInDatabase = false,
  protectedMaterialIds = [],
  currency = 'BRL',
  onConfirm,
}) => {
  useModalBackNavigation(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'macros' | 'micros'>('macros');
  const [localFormula, setLocalFormula] = useState<TargetFormula | null>(null);
  const [search, setSearch] = useState('');
  const [productOrder, setProductOrder] = useState<Record<'macro' | 'micro', string[]>>({
    macro: [],
    micro: [],
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [microPercentInputs, setMicroPercentInputs] = useState<Record<string, string>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && formula) {
      setLocalFormula(JSON.parse(JSON.stringify(formula)));
      setSearch('');
      setActiveTab('macros');
      setShowCustomForm(false);
      setFilter('all');
      setExpanded(new Set());
      setMicroPercentInputs(
        Object.fromEntries(
          (formula.micros || [])
            .filter((product) => product.desiredGuaranteePercent != null)
            .map((product) => [
              product.id,
              String(product.desiredGuaranteePercent).replace('.', ','),
            ])
        )
      );
      setPriceInputs(
        Object.fromEntries(
          [...(formula.macros || []), ...(formula.micros || [])].map((product) => [
            product.id,
            String(product.price ?? 0).replace('.', ','),
          ])
        )
      );
      const resolveOrder = (globalProducts: RawMaterial[], savedProducts: RawMaterial[]) => {
        const customIds = savedProducts
          .filter((product) => product.materialOrder != null)
          .sort((a, b) => Number(a.materialOrder) - Number(b.materialOrder))
          .map((product) => product.id);
        return [
          ...customIds,
          ...globalProducts.map((product) => product.id).filter((id) => !customIds.includes(id)),
        ];
      };
      setProductOrder({
        macro: resolveOrder(globalMacros, formula.macros || []),
        micro: resolveOrder(globalMicros, formula.micros || []),
      });
    }
  }, [isOpen, formula, globalMacros, globalMicros]);

  if (!isOpen) return null;

  /**
   * Marcado à mão fica fixado (📌) e continua marcado ao trocar o filtro:
   * qualquer micro, ou macro que não é da categoria escolhida.
   */
  const pinWhenManual = (material: RawMaterial, type: 'macro' | 'micro') =>
    type === 'micro' || !belongsToCategory(material, localFormula?.category, 'macro');

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

    // Na lista com selected=false (ex.: sem preço, Premium) conta como desmarcado.
    const existing = savedArr.find((p) => p.id === productId);
    const isSelected = !!existing && existing.selected !== false;

    if (existing && !isSelected) {
      setLocalFormula({
        ...localFormula,
        [arrKey]: savedArr.map((p) =>
          p.id === productId ? { ...p, selected: true, pinned: pinWhenManual(p, type) } : p
        ),
      });
    } else if (isSelected) {
      // Personalizada só desmarca (sumiria, pois não está no cadastro); as demais saem da lista.
      setLocalFormula({
        ...localFormula,
        [arrKey]: existing?.isCustomMaterial
          ? savedArr.map((p) => (p.id === productId ? { ...p, selected: false, pinned: false } : p))
          : savedArr.filter((p) => p.id !== productId),
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
              pinned: pinWhenManual(globalP, type),
              minQty: globalP.minQuantity || 0,
              maxQty: globalP.maxQuantity || 0,
              quantity: 0,
              microInputMode: type === 'micro' ? 'kg' : undefined,
              selectedMicroGuarantee:
                type === 'micro' ? globalP.microGuarantees?.[0]?.name : undefined,
              materialOrder: productOrder[type].indexOf(globalP.id),
            },
          ],
        });
      }
    }
  };

  const handleSelectAllProducts = (type: 'macro' | 'micro', selectAll: boolean) => {
    if (!localFormula) return;
    const arrKey = type === 'macro' ? 'macros' : 'micros';
    const globalSource = type === 'macro' ? globalMacros : globalMicros;
    const savedProducts = localFormula[arrKey] || [];
    const isProtected = (productId: string) =>
      protectedMaterialIds.includes(productId) ||
      (type === 'micro' && protectedMaterialIds.length > 0);

    const nextProducts = selectAll
      ? globalSource.map((product) => {
          const savedProduct = savedProducts.find((saved) => saved.id === product.id);
          return (
            (savedProduct && { ...savedProduct, selected: true }) || {
              ...product,
              selected: true,
              minQty: product.minQuantity || 0,
              maxQty: product.maxQuantity || 0,
              quantity: 0,
              microInputMode: type === 'micro' ? ('kg' as const) : undefined,
              selectedMicroGuarantee:
                type === 'micro' ? product.microGuarantees?.[0]?.name : undefined,
              materialOrder: productOrder[type].indexOf(product.id),
            }
          );
        })
      : savedProducts.filter((product) => isProtected(product.id));
    // Personalizadas continuam na fórmula (marcadas ou não), pois não estão no cadastro.
    const customProducts = savedProducts
      .filter((product) => product.isCustomMaterial)
      .map((product) => ({ ...product, selected: selectAll }));

    setLocalFormula({ ...localFormula, [arrKey]: [...nextProducts, ...customProducts] });
  };

  const pinnedCount = localFormula
    ? [...localFormula.macros, ...localFormula.micros].filter(
        (material) => material.selected && material.pinned
      ).length
    : 0;

  /** Solta os alfinetes: continuam marcados agora, mas voltam a seguir o filtro. */
  const clearPinned = () => {
    if (!localFormula) return;
    const unpin = (list: RawMaterial[]) => list.map((material) => ({ ...material, pinned: false }));
    setLocalFormula({
      ...localFormula,
      macros: unpin(localFormula.macros),
      micros: unpin(localFormula.micros),
    });
  };

  const handleConfirm = () => {
    const invalidMaterial = localFormula
      ? [...localFormula.macros, ...localFormula.micros].find(
          (material) =>
            Number(material.minQty) < 0 ||
            Number(material.maxQty) < 0 ||
            (Number(material.maxQty) > 0 && Number(material.minQty) > Number(material.maxQty))
        )
      : undefined;
    if (invalidMaterial) return;
    if (localFormula) {
      onConfirm({
        ...localFormula,
        macros: [...localFormula.macros]
          .sort((a, b) => productOrder.macro.indexOf(a.id) - productOrder.macro.indexOf(b.id))
          .map((product, index) => ({ ...product, materialOrder: index })),
        micros: [...localFormula.micros]
          .sort((a, b) => productOrder.micro.indexOf(a.id) - productOrder.micro.indexOf(b.id))
          .map((product, index) => ({ ...product, materialOrder: index })),
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

  const resetProductOrder = (type: 'macro' | 'micro') => {
    const source = type === 'macro' ? globalMacros : globalMicros;
    setProductOrder((current) => ({ ...current, [type]: source.map((product) => product.id) }));
  };

  const updateLocalProduct = (
    type: 'macro' | 'micro',
    productId: string,
    patch: Partial<RawMaterial>
  ) => {
    if (!localFormula) return;
    const arrKey = type === 'macro' ? 'macros' : 'micros';
    setLocalFormula({
      ...localFormula,
      [arrKey]: localFormula[arrKey].map((material) =>
        material.id === productId ? { ...material, ...patch } : material
      ),
      ...('price' in patch ? { summary: undefined } : {}),
    });
  };

  const addCustomMaterial = (draft: Parameters<typeof buildCustomMaterial>[0]) => {
    if (!localFormula) return;
    const material = buildCustomMaterial(draft, productOrder.macro.length);
    setLocalFormula({
      ...localFormula,
      macros: [...(localFormula.macros || []), material],
      summary: undefined,
    });
    setProductOrder((current) => ({ ...current, macro: [...current.macro, material.id] }));
    setPriceInputs((current) => ({
      ...current,
      [material.id]: String(material.price).replace('.', ','),
    }));
    setShowCustomForm(false);
  };

  const removeCustomMaterial = (productId: string) => {
    if (!localFormula) return;
    setLocalFormula({
      ...localFormula,
      macros: (localFormula.macros || []).filter((material) => material.id !== productId),
      summary: undefined,
    });
    setProductOrder((current) => ({
      ...current,
      macro: current.macro.filter((id) => id !== productId),
    }));
  };

  const formulaHasInvalidLimits =
    !!localFormula &&
    [...localFormula.macros, ...localFormula.micros].some(
      (material) =>
        Number(material.minQty) < 0 ||
        Number(material.maxQty) < 0 ||
        (Number(material.maxQty) > 0 && Number(material.minQty) > Number(material.maxQty))
    );

  /** Produtos exibidos: cadastro + personalizadas da fórmula, na ordem escolhida. */
  const productsOf = (f: TargetFormula, type: 'macro' | 'micro'): RawMaterial[] => {
    const savedProducts = type === 'macro' ? f.macros || [] : f.micros || [];
    const globalSource = type === 'macro' ? globalMacros : globalMicros;
    return globalSource
      .map((globalP) => {
        const savedP = savedProducts.find((saved) => saved.id === globalP.id);
        return savedP
          ? savedP
          : {
              ...globalP,
              selected: false,
              minQty: globalP.minQuantity || 0,
              maxQty: globalP.maxQuantity || 0,
              quantity: 0,
            };
      })
      .concat(
        // Personalizadas não estão no cadastro: vêm só da fórmula.
        savedProducts.filter(
          (saved) => saved.isCustomMaterial && !globalSource.some((g) => g.id === saved.id)
        )
      )
      .sort((a, b) => productOrder[type].indexOf(a.id) - productOrder[type].indexOf(b.id));
  };

  const toggleExpanded = (productId: string, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      const shouldOpen = open ?? !next.has(productId);
      if (shouldOpen) next.add(productId);
      else next.delete(productId);
      return next;
    });

  const symbol = currency === 'USD' ? 'US$' : 'R$';
  const detailInput =
    'h-10 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100';
  const detailLabel =
    'flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-stone-500';

  const renderDetails = (p: RawMaterial, type: 'macro' | 'micro', isProtected: boolean) => (
    <div className="space-y-3 border-t border-stone-100 bg-stone-50/70 px-3 py-3">
      <div
        className={`rounded-xl border p-3 ${p.isManualPrice ? 'border-blue-300 bg-blue-50' : 'border-stone-200 bg-white'}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <label className={`${detailLabel} min-w-0 flex-1`}>
            {p.isCustomMaterial ? 'Preço' : 'Preço temporário'} ({symbol}/t)
            <input
              type="text"
              inputMode="decimal"
              value={priceInputs[p.id] ?? String(p.price ?? 0).replace('.', ',')}
              onChange={(event) => {
                const inputValue = event.target.value;
                if (!/^\d*(?:[.,]\d*)?$/.test(inputValue)) return;
                setPriceInputs((current) => ({ ...current, [p.id]: inputValue }));
                if (inputValue === '' || inputValue === ',' || inputValue === '.') return;
                const price = Number(inputValue.replace(',', '.'));
                if (!Number.isFinite(price)) return;
                updateLocalProduct(type, p.id, applyTemporaryMaterialPrice(p, price));
              }}
              onFocus={() => {
                // Produto sem preço: o zero some para digitar direto.
                if (priceInputs[p.id] === undefined && !(Number(p.price) > 0))
                  setPriceInputs((current) => ({ ...current, [p.id]: '' }));
              }}
              onBlur={() =>
                setPriceInputs((current) => {
                  if (current[p.id] !== '') return current;
                  const next = { ...current };
                  delete next[p.id];
                  return next;
                })
              }
              className={`${detailInput} font-mono normal-case tracking-normal`}
            />
          </label>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {!p.isCustomMaterial && (
              <span className="text-xs text-stone-500">
                Lista: {symbol} {Number(p.listPrice ?? p.price ?? 0).toFixed(2)}
              </span>
            )}
            {p.isManualPrice && (
              <button
                type="button"
                onClick={() => {
                  const restored = restoreOfficialMaterialPrice(p);
                  setPriceInputs((current) => ({
                    ...current,
                    [p.id]: String(restored.price).replace('.', ','),
                  }));
                  updateLocalProduct(type, p.id, restored);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-950"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
              </button>
            )}
          </div>
        </div>
        {p.isManualPrice && (
          <p className="mt-2 text-xs font-semibold text-blue-800">
            Preço fora da lista — válido somente nesta precificação.
          </p>
        )}
      </div>

      {type === 'micro' && (p.microGuarantees?.length || 0) > 0 && (
        <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 sm:grid-cols-3">
          <label className={detailLabel}>
            Informar por
            <select
              value={p.microInputMode || 'kg'}
              onChange={(event) =>
                updateLocalProduct('micro', p.id, {
                  microInputMode: event.target.value as 'kg' | 'percent',
                  selectedMicroGuarantee: p.selectedMicroGuarantee || p.microGuarantees[0].name,
                })
              }
              className={`${detailInput} normal-case tracking-normal`}
            >
              <option value="kg">Quantidade em kg</option>
              <option value="percent">Garantia desejada (%)</option>
            </select>
          </label>
          {(p.microInputMode || 'kg') === 'percent' && (
            <>
              <label className={detailLabel}>
                Garantia
                <select
                  value={p.selectedMicroGuarantee || p.microGuarantees[0].name}
                  onChange={(event) => {
                    const selectedGuarantee = p.microGuarantees.find(
                      (guarantee) => guarantee.name === event.target.value
                    );
                    const kg = microGuaranteePercentToKg(
                      p.desiredGuaranteePercent || 0,
                      selectedGuarantee?.value || 0
                    );
                    updateLocalProduct('micro', p.id, {
                      selectedMicroGuarantee: event.target.value,
                      minQty: kg,
                      maxQty: kg,
                    });
                  }}
                  className={`${detailInput} normal-case tracking-normal`}
                >
                  {p.microGuarantees.map((guarantee) => (
                    <option key={guarantee.name} value={guarantee.name}>
                      {guarantee.name} ({guarantee.value}%)
                    </option>
                  ))}
                </select>
              </label>
              <label className={detailLabel}>
                Garantia final desejada (%)
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    microPercentInputs[p.id] ??
                    (p.desiredGuaranteePercent != null
                      ? String(p.desiredGuaranteePercent).replace('.', ',')
                      : '')
                  }
                  onChange={(event) => {
                    const inputValue = event.target.value;
                    if (!/^\d*(?:[.,]\d*)?$/.test(inputValue)) return;
                    setMicroPercentInputs((current) => ({ ...current, [p.id]: inputValue }));
                    const guarantee = p.microGuarantees.find(
                      (item) =>
                        item.name === (p.selectedMicroGuarantee || p.microGuarantees[0].name)
                    );
                    const desiredGuaranteePercent = Number(inputValue.replace(',', '.'));
                    if (!Number.isFinite(desiredGuaranteePercent)) return;
                    const kg = microGuaranteePercentToKg(
                      desiredGuaranteePercent,
                      guarantee?.value || 0
                    );
                    updateLocalProduct('micro', p.id, {
                      desiredGuaranteePercent,
                      minQty: kg,
                      maxQty: kg,
                    });
                  }}
                  className={`${detailInput} font-mono normal-case tracking-normal`}
                />
                <span className="text-[11px] font-bold normal-case tracking-normal text-emerald-700">
                  Quantidade calculada: {Number(p.minQty || 0).toFixed(2)} kg
                </span>
              </label>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label className={detailLabel}>
          Mínimo (kg)
          <input
            type="number"
            value={p.minQty === 0 && p.minQuantity === 0 ? '' : p.minQty}
            onChange={(event) =>
              updateLocalProduct(type, p.id, { minQty: Number(event.target.value) })
            }
            placeholder={`Ex: ${p.minQuantity || 0}`}
            min={0}
            disabled={isProtected}
            className={`${detailInput} normal-case tracking-normal`}
          />
        </label>
        <label className={detailLabel}>
          Máximo (kg)
          <input
            type="number"
            value={p.maxQty === 0 ? '' : p.maxQty}
            onChange={(event) =>
              updateLocalProduct(type, p.id, { maxQty: Number(event.target.value) })
            }
            placeholder={`Sem limite${p.maxQuantity ? ` · padrão ${p.maxQuantity}` : ''}`}
            min={0}
            disabled={isProtected}
            className={`${detailInput} normal-case tracking-normal`}
          />
        </label>
        <label className={detailLabel}>
          Fixo (kg)
          <input
            type="number"
            value={p.minQty === p.maxQty && p.minQty > 0 ? p.minQty : ''}
            onChange={(event) => {
              const rawValue = event.target.value;
              const val = Number(rawValue);
              updateLocalProduct(type, p.id, {
                minQty: rawValue === '' ? Number(p.minQuantity) || 0 : val,
                maxQty: rawValue === '' ? Number(p.maxQuantity) || 0 : val,
                ...(type === 'micro'
                  ? { microInputMode: 'kg' as const, desiredGuaranteePercent: undefined }
                  : {}),
              });
            }}
            placeholder="Auto"
            min={0}
            disabled={isProtected}
            title="Preencher isso força a usar exatamente essa quantidade (iguala mínimo e máximo)"
            className={`${detailInput} normal-case tracking-normal`}
          />
        </label>
      </div>
    </div>
  );

  const renderRow = (p: RawMaterial, type: 'macro' | 'micro') => {
    const isProtected =
      protectedMaterialIds.includes(p.id) || (type === 'micro' && protectedMaterialIds.length > 0);
    const selected = isPicked(p);
    const isOpen = selected && expanded.has(p.id);
    const unpriced = isUnpricedMaterial(p);
    const chips = guaranteeChips(p);
    const position = productOrder[type].indexOf(p.id);
    return (
      <li
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
        className={`overflow-hidden rounded-2xl border bg-white transition ${
          selected ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-stone-200'
        }`}
      >
        <div className="flex items-center gap-2 p-3 sm:gap-3">
          <GripVertical
            className="hidden h-4 w-4 shrink-0 cursor-grab text-stone-300 sm:block"
            aria-hidden="true"
          />
          <div className="flex flex-col sm:hidden">
            <button
              type="button"
              aria-label={`Mover ${p.name} para cima`}
              onClick={() => moveProduct(type, p.id, -1)}
              disabled={isProtected || position === 0}
              className="text-stone-400 disabled:opacity-20"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Mover ${p.name} para baixo`}
              onClick={() => moveProduct(type, p.id, 1)}
              disabled={isProtected || position === productOrder[type].length - 1}
              className="text-stone-400 disabled:opacity-20"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div
            className={`flex min-w-0 flex-1 items-center gap-3 ${isProtected ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
            onClick={() => {
              if (isProtected) return;
              if (!selected) toggleExpanded(p.id, true);
              handleSelectProduct(p.id, type);
            }}
          >
            <span
              role="checkbox"
              aria-checked={selected}
              aria-label={`Selecionar ${p.name}`}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-stone-300 bg-white'
              }`}
            >
              {selected && <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-stone-900">{p.name}</span>
                {selected && <span className="sr-only">Selecionado</span>}
                {selected && p.pinned && (
                  <span
                    title="Marcado à mão: continua marcado ao trocar o filtro"
                    className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800"
                  >
                    📌 Fixado
                  </span>
                )}
                {p.isCustomMaterial && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                    Personalizada
                  </span>
                )}
                {p.isPremiumLine && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Premium
                  </span>
                )}
                {p.isManualPrice && !p.isCustomMaterial && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    Preço alterado
                  </span>
                )}
                {p.isMissingListPrice && !p.isOutsidePriceList && !p.isManualPrice && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    Sem preço na lista
                  </span>
                )}
              </div>
              {chips.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-stone-700"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-stone-400">Garantias não cadastradas</p>
              )}
              {isProtected && (
                <p className="mt-1 text-[11px] font-bold text-amber-700">
                  Protegido para preservar a descrição da formulação
                </p>
              )}
              {p.isOutsidePriceList && (
                <p className="mt-1 text-[11px] font-bold text-amber-700">
                  Produto extra · sem preço na lista atual (seleção permitida)
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`flex h-9 items-center gap-1 rounded-lg border px-2 font-mono text-sm ${
                unpriced
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-stone-200 bg-stone-50 text-stone-800'
              }`}
            >
              <span className="text-[11px] text-stone-400">{symbol}</span>
              {Number(p.price || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <span className="text-[10px] text-stone-400">por tonelada</span>
          </div>
          {p.isCustomMaterial ? (
            <button
              type="button"
              onClick={() => removeCustomMaterial(p.id)}
              aria-label={`Remover ${p.name}`}
              title="Remover personalizada"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          {selected && (
            <button
              type="button"
              onClick={() => toggleExpanded(p.id)}
              aria-label={isOpen ? `Recolher ajustes de ${p.name}` : `Ajustes de ${p.name}`}
              aria-expanded={isOpen}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
        {isOpen && renderDetails(p, type, isProtected)}
      </li>
    );
  };

  const type: 'macro' | 'micro' = activeTab === 'macros' ? 'macro' : 'micro';
  const allMacros = localFormula ? productsOf(localFormula, 'macro') : [];
  const allMicros = localFormula ? productsOf(localFormula, 'micro') : [];
  const currentProducts = type === 'macro' ? allMacros : allMicros;
  const counts = filterCounts(currentProducts);
  const visibleProducts = currentProducts.filter(
    (product) => matchesFilter(product, filter) && matchesSearch(product, search)
  );
  const selectableProducts = currentProducts.filter(
    (product) =>
      !protectedMaterialIds.includes(product.id) &&
      !(type === 'micro' && protectedMaterialIds.length > 0)
  );
  const allSelectableSelected =
    selectableProducts.length > 0 && selectableProducts.every((product) => isPicked(product));
  const selectedAll = [...allMacros, ...allMicros].filter(isPicked);
  const warnings = getPriceWarnings(selectedAll);
  const coverage = localFormula ? targetCoverage(localFormula, selectedAll) : [];
  const hasWarnings =
    warnings.unpriced.length + warnings.manual.length + warnings.custom.length > 0;
  const microTargetText = Object.entries(localFormula?.targetMicros || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([name, value]) => `${name} ${String(value).replace('.', ',')}%`)
    .join(' · ');

  const filterChips: { id: ProductFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'selected', label: 'Selecionados' },
    { id: 'unpriced', label: 'Sem preço' },
    { id: 'premium', label: 'Premium' },
    { id: 'custom', label: 'Personalizadas' },
  ];

  const warningsBox = hasWarnings && (
    <div
      role="alert"
      className="space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p className="flex items-center gap-1.5 font-black">
        <AlertTriangle className="h-4 w-4" /> Atenção aos preços
      </p>
      {warnings.unpriced.length > 0 && (
        <p>
          <strong>Sem preço ({symbol} 0,00):</strong> {materialNames(warnings.unpriced)}. O custo
          não inclui esses produtos — informe um valor no campo de preço.
        </p>
      )}
      {warnings.manual.length > 0 && (
        <p>
          <strong>Valor informado por você:</strong> {materialNames(warnings.manual)}. Vale só nesta
          precificação; a lista não muda.
        </p>
      )}
      {warnings.custom.length > 0 && (
        <p>
          <strong>Matéria-prima personalizada:</strong> {materialNames(warnings.custom)}. Garantias
          e preço informados por você; não está no cadastro.
        </p>
      )}
    </div>
  );

  const customBlock =
    activeTab === 'macros' &&
    (showCustomForm ? (
      <CustomMaterialForm
        currency={currency}
        onAdd={addCustomMaterial}
        onCancel={() => setShowCustomForm(false)}
      />
    ) : (
      <button
        type="button"
        onClick={() => setShowCustomForm(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-sm font-black text-violet-800 hover:border-violet-400"
      >
        <FlaskConical className="h-4 w-4" /> Adicionar matéria-prima personalizada
      </button>
    ));

  return (
    <div
      className="mobile-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Produtos da fórmula"
        className="mobile-modal-panel flex h-[100dvh] w-full flex-col overflow-hidden bg-stone-50 shadow-2xl sm:h-[92vh] sm:max-w-6xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Produtos da Fórmula
            </p>
            <h2 className="truncate text-xl font-black text-stone-900 sm:text-2xl">
              {localFormula?.formula || 'Sem fórmula'}
              {microTargetText && (
                <span className="ml-2 align-middle text-sm font-bold text-stone-400">
                  + {microTargetText}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="shrink-0 space-y-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex rounded-xl bg-stone-100 p-1" role="tablist">
              {(
                [
                  ['macros', 'Macros', allMacros],
                  ['micros', 'Micronutrientes', allMicros],
                ] as const
              ).map(([id, label, list]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => {
                    setActiveTab(id);
                    setFilter('all');
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors sm:flex-none ${
                    activeTab === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-xs ${activeTab === id ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}
                  >
                    {list.filter(isPicked).length}/{list.length}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder="Buscar produto ou garantia (ex.: Zn)…"
                aria-label="Buscar produto ou garantia"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={filter === chip.id}
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  filter === chip.id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-emerald-400'
                }`}
              >
                {chip.label}
                {chip.id !== 'all' && ` (${counts[chip.id]})`}
              </button>
            ))}
            {pinnedCount > 0 && (
              <button
                type="button"
                onClick={clearPinned}
                title="Os fixados voltam a seguir o filtro ao trocar de categoria"
                className="shrink-0 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
              >
                📌 Limpar fixados ({pinnedCount})
              </button>
            )}
            <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-bold text-emerald-700">
              <input
                type="checkbox"
                checked={allSelectableSelected}
                onChange={(event) => handleSelectAllProducts(type, event.target.checked)}
                disabled={selectableProducts.length === 0}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              {type === 'macro' ? 'Selecionar todos os macros' : 'Selecionar todos os micros'}
            </label>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="space-y-3 lg:hidden">
              {warningsBox}
              {customBlock}
            </div>
            {!localFormula ? (
              <p className="py-8 text-center text-stone-500">Nenhuma fórmula selecionada.</p>
            ) : isMaterialsLoading ? (
              <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-600">
                Carregando matérias-primas cadastradas...
              </p>
            ) : currentProducts.length === 0 && hasNoMaterialsInDatabase ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
                Nenhuma matéria-prima cadastrada. Acesse o cadastro de produtos para adicionar.
              </p>
            ) : visibleProducts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
                Nenhum produto encontrado para o filtro informado.
              </p>
            ) : (
              <ul className="space-y-2">{visibleProducts.map((p) => renderRow(p, type))}</ul>
            )}
          </main>

          <aside className="hidden w-80 shrink-0 space-y-4 overflow-y-auto border-l border-stone-200 bg-white p-5 lg:block">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Seleção</p>
              <p className="mt-1 text-3xl font-black text-stone-900">
                {selectedAll.length}{' '}
                <span className="text-base font-bold text-stone-400">
                  produto{selectedAll.length === 1 ? '' : 's'}
                </span>
              </p>
              {coverage.length > 0 && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {coverage.map((item) => (
                      <span
                        key={item.label}
                        className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                          item.covered ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {item.label} {item.covered ? '✓' : '✗'}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {coverage.every((item) => item.covered)
                      ? 'Todas as garantias da meta têm fonte selecionada.'
                      : `Sem fonte selecionada: ${coverage
                          .filter((item) => !item.covered)
                          .map((item) => item.label)
                          .join(', ')}.`}
                  </p>
                </>
              )}
            </div>
            {warningsBox}
            {customBlock}
            <div className="text-xs text-stone-500">
              Arraste pela alça <GripVertical className="inline h-3 w-3" /> para mudar a ordem.{' '}
              <button
                type="button"
                onClick={() => resetProductOrder(type)}
                className="font-bold text-emerald-700 hover:underline"
              >
                Restaurar ordem da lista
              </button>
            </div>
          </aside>
        </div>

        <footer className="app-safe-bottom flex shrink-0 flex-col gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-sm text-stone-500">
            {formulaHasInvalidLimits ? (
              <span className="font-semibold text-red-600">
                Revise os limites: o mínimo não pode superar o máximo.
              </span>
            ) : (
              <>
                <b className="text-stone-800">{selectedAll.length}</b> selecionado
                {selectedAll.length === 1 ? '' : 's'} · preços em {symbol}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-700 hover:bg-stone-100 sm:flex-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={formulaHasInvalidLimits}
              className="h-11 flex-[2] rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 sm:flex-none"
            >
              Confirmar Seleção
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
