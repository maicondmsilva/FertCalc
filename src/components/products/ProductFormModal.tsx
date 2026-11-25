import React from 'react';
import { Box, Database, FlaskConical, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import type {
  Brand,
  CompatibilityCategory,
  MicroGuarantee,
  NutrientType,
  UnifiedProduct,
} from '../../types';
import type { LocalCarregamento } from '../../types/carregamento';
import type { Nutriente } from '../../services/nutrientesService';
import { normalizeMicronutrientKey } from '../../utils/micronutrients';
import {
  CatalogModal,
  Field,
  FormSection,
  Switch,
  fieldClass,
  primaryButton,
  secondaryButton,
} from './catalogUi';

export type ProductForm = Partial<UnifiedProduct>;

interface ProductFormModalProps {
  isOpen: boolean;
  type: NutrientType;
  form: ProductForm;
  onChange: (updater: (current: ProductForm) => ProductForm) => void;
  viewMode: boolean;
  isEditing: boolean;
  saving: boolean;
  brands: Brand[];
  categories: CompatibilityCategory[];
  nutrientes: Nutriente[];
  loadingLocations: LocalCarregamento[];
  onSave: () => void;
  onClose: () => void;
}

const TYPE_LABEL: Record<NutrientType, string> = {
  macro: 'Macro',
  micro: 'Micro',
  finished: 'Produto acabado',
};

const TYPE_ICON: Record<NutrientType, React.ReactNode> = {
  macro: <Database className="h-5 w-5" />,
  micro: <FlaskConical className="h-5 w-5" />,
  finished: <Box className="h-5 w-5" />,
};

const sameNutrient = (a: string, b: string) =>
  normalizeMicronutrientKey(a) === normalizeMicronutrientKey(b);

/** Formulário de matéria-prima em seções: identificação, garantias, batida e disponibilidade. */
export default function ProductFormModal({
  isOpen,
  type,
  form,
  onChange,
  viewMode,
  isEditing,
  saving,
  brands,
  categories,
  nutrientes,
  loadingLocations,
  onSave,
  onClose,
}: ProductFormModalProps) {
  const isMaterial = type === 'macro' || type === 'micro';
  const set = (patch: ProductForm) => onChange((current) => ({ ...current, ...patch }));
  const guarantees = form.microGuarantees || [];
  const updateGuarantee = (index: number, patch: Partial<MicroGuarantee>) =>
    onChange((current) => {
      const next = [...(current.microGuarantees || [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, microGuarantees: next };
    });
  const activeNutrients = nutrientes.filter((nutriente) => nutriente.ativo);
  const selectedLocations = form.extraLoadingLocationIds || [];

  const guaranteeSummary = [
    ...(type === 'macro'
      ? (['n', 'p', 'k', 's', 'ca'] as const)
          .filter((key) => Number(form[key]) > 0)
          .map((key) => `${key === 'ca' ? 'Ca' : key.toUpperCase()} ${Number(form[key])}%`)
      : []),
    ...guarantees
      .filter((guarantee) => guarantee.name && Number(guarantee.value) > 0)
      .map((guarantee) => `${guarantee.name} ${Number(guarantee.value)}%`),
  ];

  const title = viewMode
    ? form.name || 'Produto'
    : isEditing
      ? `Editar ${form.name || 'produto'}`
      : `Novo ${TYPE_LABEL[type].toLowerCase()}`;

  return (
    <CatalogModal
      isOpen={isOpen}
      title={title}
      subtitle={`${TYPE_LABEL[type]}${viewMode ? ' · visualização' : ''}`}
      icon={TYPE_ICON[type]}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            {viewMode ? 'Fechar' : 'Cancelar'}
          </button>
          {!viewMode && (
            <button type="button" onClick={onSave} disabled={saving} className={primaryButton}>
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar produto'}
            </button>
          )}
        </>
      }
    >
      <FormSection title="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome" required className={isMaterial ? '' : 'sm:col-span-2'}>
            <input
              disabled={viewMode}
              value={form.name || ''}
              onChange={(event) => set({ name: event.target.value })}
              className={fieldClass}
              placeholder="Ex.: KCL Granulado"
            />
          </Field>
          {isMaterial && (
            <Field label="Sufixo da fórmula" hint="Ex.: S, M, P">
              <input
                disabled={viewMode}
                value={form.formulaSuffix || ''}
                onChange={(event) => set({ formulaSuffix: event.target.value })}
                className={fieldClass}
              />
            </Field>
          )}
          {type === 'macro' && (
            <Field label="Marca" className="sm:col-span-2">
              <select
                disabled={viewMode}
                value={form.brandId || ''}
                onChange={(event) => set({ brandId: event.target.value })}
                className={fieldClass}
              >
                <option value="">— Sem marca —</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </FormSection>

      {isMaterial && (
        <FormSection
          title="Garantias"
          description="O cálculo soma todas as garantias, inclusive micros dentro de um macro."
        >
          {type === 'macro' && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(['n', 'p', 'k', 's', 'ca'] as const).map((key) => (
                <Field key={key} label={key === 'ca' ? 'Ca %' : `${key.toUpperCase()} %`}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    disabled={viewMode}
                    value={Number(form[key]) || 0}
                    onChange={(event) => set({ [key]: Number(event.target.value) })}
                    className={`${fieldClass} text-center font-mono`}
                  />
                </Field>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Nutrientes do cadastro
              </span>
              {!viewMode && (
                <button
                  type="button"
                  onClick={() => set({ microGuarantees: [...guarantees, { name: '', value: 0 }] })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              )}
            </div>
            <div className="space-y-2">
              {guarantees.map((guarantee, index) => {
                const registered = nutrientes.find((nutriente) =>
                  sameNutrient(nutriente.sigla, guarantee.name)
                );
                return (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      disabled={viewMode}
                      value={registered?.sigla ?? guarantee.name}
                      onChange={(event) => updateGuarantee(index, { name: event.target.value })}
                      aria-label="Nutriente da garantia"
                      className={`${fieldClass} h-10 flex-1`}
                    >
                      <option value="">Selecione o nutriente…</option>
                      {activeNutrients.map((nutriente) => (
                        <option key={nutriente.id} value={nutriente.sigla}>
                          {nutriente.sigla} – {nutriente.nome}
                        </option>
                      ))}
                      {guarantee.name && !registered && (
                        <option value={guarantee.name}>{guarantee.name} (fora do cadastro)</option>
                      )}
                    </select>
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={viewMode}
                        value={guarantee.value}
                        onChange={(event) =>
                          updateGuarantee(index, { value: Number(event.target.value) })
                        }
                        aria-label="Garantia em %"
                        className={`${fieldClass} h-10 pr-7 text-right font-mono`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                        %
                      </span>
                    </div>
                    {!viewMode && (
                      <button
                        type="button"
                        onClick={() =>
                          set({ microGuarantees: guarantees.filter((_, i) => i !== index) })
                        }
                        aria-label="Remover garantia"
                        className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {guarantees.length === 0 && (
                <p className="py-1 text-center text-xs text-stone-400">
                  Nenhum micro ou secundário adicionado.
                </p>
              )}
            </div>
          </div>

          {guaranteeSummary.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Resumo das garantias">
              {guaranteeSummary.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-800"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </FormSection>
      )}

      {type === 'finished' && (
        <FormSection title="Venda">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Preço (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={viewMode}
                value={form.price ?? ''}
                onChange={(event) => set({ price: Number(event.target.value) })}
                className={fieldClass}
              />
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <textarea
                disabled={viewMode}
                value={form.description || ''}
                onChange={(event) => set({ description: event.target.value })}
                rows={3}
                className={`${fieldClass} h-auto resize-none py-2`}
              />
            </Field>
          </div>
        </FormSection>
      )}

      <FormSection title="Quantidade na batida" description="Limites usados pelo cálculo (kg/t).">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mínima (kg)">
            <input
              type="number"
              min="0"
              disabled={viewMode}
              value={form.minQuantity || 0}
              onChange={(event) => set({ minQuantity: Number(event.target.value) })}
              className={fieldClass}
            />
          </Field>
          {isMaterial && (
            <Field label="Máxima (kg)" hint="Zero = sem limite.">
              <input
                type="number"
                min="0"
                disabled={viewMode}
                value={form.maxQuantity || 0}
                onChange={(event) => set({ maxQuantity: Number(event.target.value) })}
                className={fieldClass}
              />
            </Field>
          )}
        </div>
      </FormSection>

      {isMaterial && (
        <FormSection
          title="Categorias"
          description="Agrupam matérias-primas que podem substituir umas às outras."
        >
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((category) => category.ativo)
              .map((category) => {
                const active = (form.categories || []).includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={viewMode}
                    aria-pressed={active}
                    onClick={() =>
                      set({
                        categories: active
                          ? (form.categories || []).filter((id) => id !== category.id)
                          : [...(form.categories || []), category.id],
                      })
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-emerald-400'
                    }`}
                  >
                    {category.nome}
                  </button>
                );
              })}
            {categories.filter((category) => category.ativo).length === 0 && (
              <span className="text-xs text-stone-400">Nenhuma categoria ativa cadastrada.</span>
            )}
          </div>
        </FormSection>
      )}

      {isMaterial && (
        <FormSection title="Disponibilidade">
          <div className="space-y-3">
            <Switch
              checked={!!form.isPremiumLine}
              disabled={viewMode}
              onChange={(checked) => set({ isPremiumLine: checked })}
              label="Linha Diferenciada (Premium)"
              description="Chega desmarcado na calculadora."
            />
            <Switch
              checked={!!form.availableInCalculatorWithoutPriceList}
              disabled={viewMode}
              tone="blue"
              onChange={(checked) =>
                set({
                  availableInCalculatorWithoutPriceList: checked,
                  extraLoadingLocationIds: checked ? selectedLocations : [],
                })
              }
              label="Produto extra na calculadora"
              description="Usuários autorizados veem o produto mesmo fora da lista de preço."
            />
          </div>
          {form.availableInCalculatorWithoutPriceList && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-blue-900">
                  <MapPin className="h-4 w-4" /> Locais de carregamento
                </p>
                {!viewMode && loadingLocations.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        extraLoadingLocationIds:
                          selectedLocations.length === loadingLocations.length
                            ? []
                            : loadingLocations.map((location) => location.id),
                      })
                    }
                    className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    {selectedLocations.length === loadingLocations.length
                      ? 'Limpar seleção'
                      : 'Selecionar todos'}
                  </button>
                )}
              </div>
              <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {loadingLocations.map((location) => (
                  <label
                    key={location.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-blue-100 bg-white p-2 text-sm text-stone-700 hover:border-blue-300"
                  >
                    <input
                      type="checkbox"
                      disabled={viewMode}
                      checked={selectedLocations.includes(location.id)}
                      onChange={(event) =>
                        set({
                          extraLoadingLocationIds: event.target.checked
                            ? [...selectedLocations, location.id]
                            : selectedLocations.filter((id) => id !== location.id),
                        })
                      }
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block font-semibold">{location.nome}</span>
                      {(location.cidade || location.estado) && (
                        <span className="block text-xs text-stone-500">
                          {[location.cidade, location.estado].filter(Boolean).join(' — ')}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {loadingLocations.length === 0 && (
                  <p className="text-xs text-red-600">Nenhum local de carregamento ativo.</p>
                )}
              </div>
              {selectedLocations.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  Selecione ao menos um local para salvar.
                </p>
              )}
            </div>
          )}
        </FormSection>
      )}
    </CatalogModal>
  );
}
