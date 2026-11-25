import React, { useState } from 'react';
import { MapPin, Save, Truck, User as UserIcon } from 'lucide-react';
import type { Address, Client } from '../../types';
import { formatDocument, formatPhone } from '../../utils/formatters';
import {
  CatalogModal,
  Field,
  FormSection,
  Switch,
  fieldClass,
  primaryButton,
  secondaryButton,
} from '../products/catalogUi';
import AddressFields from './AddressFields';
import {
  documentKind,
  documentProblem,
  emailProblem,
  emptyAddress,
  findDuplicate,
  phoneProblem,
} from './registryModel';

export type ClientDraft = Omit<Client, 'id' | 'code' | 'organizationId'>;

export function clientDraftFrom(client?: Client | null): ClientDraft {
  return {
    name: client?.name || '',
    document: client?.document || '',
    email: client?.email || '',
    phone: client?.phone || '',
    stateRegistration: client?.stateRegistration || '',
    fazenda: client?.fazenda || '',
    address: { ...emptyAddress(), ...(client?.address || {}) },
    deliveryAddress: { ...emptyAddress(), ...(client?.deliveryAddress || {}) },
    deliverySameAsAddress: Boolean(client?.deliverySameAsAddress),
  };
}

/** Problemas por campo (vazio = pode salvar). */
export function clientProblems(
  draft: ClientDraft,
  clients: Client[],
  editingId?: string
): Partial<Record<'name' | 'document' | 'stateRegistration' | 'email' | 'phone', string>> {
  const problems: ReturnType<typeof clientProblems> = {};
  if (draft.name.trim().length < 3) problems.name = 'Informe o nome (mínimo 3 letras).';
  const doc = documentProblem(draft.document, true);
  if (doc) problems.document = doc;
  if (!String(draft.stateRegistration || '').trim())
    problems.stateRegistration = 'Informe a inscrição estadual (ou "ISENTO").';
  const email = emailProblem(draft.email);
  if (email) problems.email = email;
  const phone = phoneProblem(draft.phone);
  if (phone) problems.phone = phone;
  if (!problems.document) {
    const duplicate = findDuplicate(clients, draft, editingId, true);
    if (duplicate)
      problems.document = `Já existe: cód. ${duplicate.code} · ${duplicate.name} (mesmo documento e IE).`;
  }
  return problems;
}

/** Ao salvar com "entrega igual", copia o endereço atual (antes ficava a cópia antiga). */
export function finalizeClientDraft(draft: ClientDraft): ClientDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    email: draft.email?.trim(),
    deliveryAddress: draft.deliverySameAsAddress
      ? { ...(draft.address as Address) }
      : draft.deliveryAddress,
  };
}

export default function ClientFormModal({
  client,
  clients,
  saving,
  onSave,
  onClose,
}: {
  client: Client | null;
  clients: Client[];
  saving: boolean;
  onSave: (draft: ClientDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ClientDraft>(() => clientDraftFrom(client));
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<ClientDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const problems = clientProblems(draft, clients, client?.id);
  const error = (key: keyof typeof problems) => (showErrors ? problems[key] : undefined);
  const kind = documentKind(draft.document);

  const submit = () => {
    if (Object.keys(problems).length > 0) {
      setShowErrors(true);
      return;
    }
    onSave(finalizeClientDraft(draft));
  };

  const errorClass = (key: keyof typeof problems) =>
    error(key) ? 'border-red-400 bg-red-50 focus:ring-red-400' : '';
  const errorText = (name: keyof typeof problems) =>
    error(name) ? (
      <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
        {error(name)}
      </p>
    ) : null;

  return (
    <CatalogModal
      isOpen
      size="xl"
      title={client ? `Editar ${client.name}` : 'Novo cliente'}
      subtitle={client ? `Código ${client.code}` : 'O código é gerado automaticamente.'}
      icon={<UserIcon className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButton}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : client ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </>
      }
    >
      <FormSection title="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome / razão social" required>
              <input
                value={draft.name}
                onChange={(event) => set({ name: event.target.value })}
                className={`${fieldClass} ${errorClass('name')}`}
                placeholder="Nome completo do cliente"
              />
            </Field>
            {errorText('name')}
          </div>
          <div>
            <Field label={kind ? `${kind}` : 'CPF / CNPJ'} required>
              <input
                inputMode="numeric"
                value={draft.document}
                onChange={(event) => set({ document: formatDocument(event.target.value) })}
                className={`${fieldClass} font-mono ${errorClass('document')}`}
                placeholder="000.000.000-00"
              />
            </Field>
            {errorText('document')}
          </div>
          <div>
            <Field label="Inscrição estadual" required hint="Use ISENTO quando não houver.">
              <input
                value={draft.stateRegistration || ''}
                onChange={(event) => set({ stateRegistration: event.target.value })}
                className={`${fieldClass} ${errorClass('stateRegistration')}`}
              />
            </Field>
            {errorText('stateRegistration')}
          </div>
          <div className="sm:col-span-2">
            <Field label="Fazenda">
              <input
                value={draft.fazenda || ''}
                onChange={(event) => set({ fazenda: event.target.value })}
                className={fieldClass}
                placeholder="Nome da fazenda"
              />
            </Field>
          </div>
        </div>
      </FormSection>

      <FormSection title="Contato">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Field label="E-mail">
              <input
                type="email"
                value={draft.email || ''}
                onChange={(event) => set({ email: event.target.value })}
                className={`${fieldClass} ${errorClass('email')}`}
                placeholder="email@exemplo.com"
              />
            </Field>
            {errorText('email')}
          </div>
          <div>
            <Field label="Telefone / celular">
              <input
                inputMode="tel"
                value={draft.phone || ''}
                onChange={(event) => set({ phone: formatPhone(event.target.value) })}
                className={`${fieldClass} ${errorClass('phone')}`}
                placeholder="(00) 00000-0000"
              />
            </Field>
            {errorText('phone')}
          </div>
        </div>
      </FormSection>

      <FormSection title="Endereço de correspondência">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-stone-500">
          <MapPin className="h-3.5 w-3.5" /> Digite o CEP para preencher o restante.
        </div>
        <AddressFields
          idPrefix="client-address"
          value={draft.address as Address}
          onChange={(address) => set({ address })}
        />
      </FormSection>

      <FormSection title="Endereço de entrega">
        <Switch
          checked={Boolean(draft.deliverySameAsAddress)}
          onChange={(checked) => set({ deliverySameAsAddress: checked })}
          label="Igual ao de correspondência"
          description="Acompanha as mudanças do endereço de correspondência."
        />
        {!draft.deliverySameAsAddress && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <Truck className="h-3.5 w-3.5" /> Onde a carga será entregue.
            </div>
            <AddressFields
              idPrefix="client-delivery"
              value={draft.deliveryAddress as Address}
              onChange={(deliveryAddress) => set({ deliveryAddress })}
            />
          </>
        )}
      </FormSection>
    </CatalogModal>
  );
}
