import React from 'react';
import { Save, ShoppingBag } from 'lucide-react';
import type { Embalagem } from '../../types';
import {
  CatalogModal,
  Field,
  FormSection,
  Switch,
  fieldClass,
  primaryButton,
  secondaryButton,
} from './catalogUi';

interface EmbalagemFormModalProps {
  isOpen: boolean;
  form: Partial<Embalagem>;
  onChange: (updater: (current: Partial<Embalagem>) => Partial<Embalagem>) => void;
  isEditing: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

function MoneyInput({
  value,
  onChange,
  id,
}: {
  value: number | null | undefined;
  onChange: (value: number) => void;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
        R$
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        id={id}
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${fieldClass} pl-9 text-right font-mono`}
      />
    </div>
  );
}

/** Embalagem: valor que acrescenta ou desconta no preço por tonelada. */
export default function EmbalagemFormModal({
  isOpen,
  form,
  onChange,
  isEditing,
  saving,
  onSave,
  onClose,
}: EmbalagemFormModalProps) {
  const set = (patch: Partial<Embalagem>) => onChange((current) => ({ ...current, ...patch }));
  return (
    <CatalogModal
      isOpen={isOpen}
      size="md"
      title={isEditing ? `Editar ${form.nome || 'embalagem'}` : 'Nova embalagem'}
      subtitle="Ajuste no preço por tonelada"
      icon={<ShoppingBag className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button type="button" onClick={onSave} disabled={saving} className={primaryButton}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar embalagem'}
          </button>
        </>
      }
    >
      <FormSection title="Identificação">
        <Field label="Nome" required>
          <input
            value={form.nome || ''}
            onChange={(event) => set({ nome: event.target.value })}
            placeholder="Ex.: Saco 50 kg, Big Bag 1 t"
            className={fieldClass}
          />
        </Field>
      </FormSection>

      <FormSection title="Valores (R$/t)">
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <Switch
              checked={!!form.cobrar}
              onChange={(checked) => set({ cobrar: checked })}
              label="Cobrar"
              description="Acrescenta ao preço."
            />
            {form.cobrar && (
              <Field label="Valor a cobrar">
                <MoneyInput
                  value={form.valor_cobrar}
                  onChange={(value) => set({ valor_cobrar: value })}
                />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <Switch
              checked={!!form.descontar}
              tone="blue"
              onChange={(checked) => set({ descontar: checked })}
              label="Descontar"
              description="Desconta do preço."
            />
            {form.descontar && (
              <Field label="Valor do desconto">
                <MoneyInput
                  value={form.valor_descontar}
                  onChange={(value) => set({ valor_descontar: value })}
                />
              </Field>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Status">
        <Switch
          checked={form.ativo !== false}
          onChange={(checked) => set({ ativo: checked })}
          label={form.ativo !== false ? 'Ativa' : 'Inativa'}
          description="Embalagem inativa não aparece nas calculadoras."
        />
      </FormSection>
    </CatalogModal>
  );
}
