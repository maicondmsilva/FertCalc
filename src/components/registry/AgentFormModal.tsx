import React, { useState } from 'react';
import { Save, UserCheck } from 'lucide-react';
import type { Address, Agent } from '../../types';
import { formatDocument, formatPhone } from '../../utils/formatters';
import {
  CatalogModal,
  Field,
  FormSection,
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

export type AgentDraft = Omit<Agent, 'id' | 'code' | 'organizationId'>;

export function agentDraftFrom(agent?: Agent | null): AgentDraft {
  return {
    name: agent?.name || '',
    document: agent?.document || '',
    email: agent?.email || '',
    phone: agent?.phone || '',
    ie: agent?.ie || '',
    address: { ...emptyAddress(), ...(agent?.address || {}) },
  };
}

/** Documento é opcional para agente, mas se informado precisa ser válido e único. */
export function agentProblems(
  draft: AgentDraft,
  agents: Agent[],
  editingId?: string
): Partial<Record<'name' | 'document' | 'email' | 'phone', string>> {
  const problems: ReturnType<typeof agentProblems> = {};
  if (draft.name.trim().length < 3) problems.name = 'Informe o nome (mínimo 3 letras).';
  const doc = documentProblem(draft.document, false);
  if (doc) problems.document = doc;
  const email = emailProblem(draft.email);
  if (email) problems.email = email;
  const phone = phoneProblem(draft.phone);
  if (phone) problems.phone = phone;
  if (!problems.document) {
    const duplicate = findDuplicate(agents, draft, editingId);
    if (duplicate)
      problems.document = `Já existe: cód. ${duplicate.code} · ${duplicate.name} (mesmo documento).`;
  }
  return problems;
}

export default function AgentFormModal({
  agent,
  agents,
  saving,
  onSave,
  onClose,
}: {
  agent: Agent | null;
  agents: Agent[];
  saving: boolean;
  onSave: (draft: AgentDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AgentDraft>(() => agentDraftFrom(agent));
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<AgentDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const problems = agentProblems(draft, agents, agent?.id);
  const error = (key: keyof typeof problems) => (showErrors ? problems[key] : undefined);
  const errorClass = (key: keyof typeof problems) =>
    error(key) ? 'border-red-400 bg-red-50 focus:ring-red-400' : '';
  const errorText = (key: keyof typeof problems) =>
    error(key) ? (
      <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
        {error(key)}
      </p>
    ) : null;

  const submit = () => {
    if (Object.keys(problems).length > 0) {
      setShowErrors(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), email: draft.email?.trim() });
  };

  return (
    <CatalogModal
      isOpen
      size="lg"
      title={agent ? `Editar ${agent.name}` : 'Novo agente'}
      subtitle={agent ? `Código ${agent.code}` : 'O código é gerado automaticamente.'}
      icon={<UserCheck className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButton}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : agent ? 'Salvar alterações' : 'Cadastrar agente'}
          </button>
        </>
      }
    >
      <FormSection title="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome do agente" required>
              <input
                value={draft.name}
                onChange={(event) => set({ name: event.target.value })}
                className={`${fieldClass} ${errorClass('name')}`}
                placeholder="Nome completo"
              />
            </Field>
            {errorText('name')}
          </div>
          <div>
            <Field label={documentKind(draft.document) || 'CPF / CNPJ'}>
              <input
                inputMode="numeric"
                value={draft.document || ''}
                onChange={(event) => set({ document: formatDocument(event.target.value) })}
                className={`${fieldClass} font-mono ${errorClass('document')}`}
                placeholder="000.000.000-00"
              />
            </Field>
            {errorText('document')}
          </div>
          <div>
            <Field label="Inscrição estadual">
              <input
                value={draft.ie || ''}
                onChange={(event) => set({ ie: event.target.value })}
                className={fieldClass}
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

      <FormSection title="Endereço">
        <AddressFields
          idPrefix="agent-address"
          value={draft.address as Address}
          onChange={(address) => set({ address })}
        />
      </FormSection>
    </CatalogModal>
  );
}
