import React, { useCallback, useMemo, useState } from 'react';
import { UserCheck } from 'lucide-react';
import type { Agent, User } from '../types';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { RegistryDetailModal, RegistryList } from './registry/RegistryList';
import AgentFormModal, { type AgentDraft } from './registry/AgentFormModal';
import { registrySaveError, useRegistryData } from './registry/useRegistryData';
import {
  formatAddress,
  isAddressFilled,
  matchesRegistrySearch,
  onlyDigits,
  registryPermissions,
} from './registry/registryModel';

const loadAgents = () => import('../services/registryService').then((m) => m.listAgents());

/** Cadastro de agentes (representantes): lista, ficha, novo/editar em modal e exclusão. */
export default function AgentManager({ currentUser }: { currentUser: User }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const { canCreate, canEdit, canDelete } = registryPermissions(currentUser, 'agents');
  const {
    items: agents,
    loading,
    error,
    reload,
  } = useRegistryData<Agent>(useCallback(loadAgents, []));
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Agent | null>(null);
  const [editing, setEditing] = useState<Agent | null | 'new'>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => agents.filter((agent) => matchesRegistrySearch(agent, search)),
    [agents, search]
  );
  const stats = useMemo(
    () => [
      { label: 'Agentes', value: agents.length },
      {
        label: 'Sem documento',
        value: agents.filter((agent) => !onlyDigits(agent.document)).length,
        tone: 'warning' as const,
      },
      {
        label: 'Sem contato',
        value: agents.filter((agent) => !agent.phone && !agent.email).length,
        tone: 'warning' as const,
      },
      {
        label: 'Sem endereço',
        value: agents.filter((agent) => !isAddressFilled(agent.address)).length,
        tone: 'warning' as const,
      },
    ],
    [agents]
  );

  const save = async (draft: AgentDraft) => {
    setSaving(true);
    try {
      const { saveAgent } = await import('../services/registryService');
      const id = editing && editing !== 'new' ? editing.id : undefined;
      await saveAgent(draft, id);
      showSuccess(id ? 'Agente atualizado.' : 'Agente cadastrado.');
      setEditing(null);
      reload();
    } catch (saveError) {
      showError(registrySaveError(saveError, 'agente'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (agent: Agent) => {
    const ok = await confirm({
      title: `Excluir ${agent.name}?`,
      message: 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      const { removeRegistry } = await import('../services/registryService');
      await removeRegistry('agents', agent.id);
      showSuccess('Agente excluído.');
      setViewing(null);
      reload();
    } catch {
      showError('Não foi possível excluir: sem permissão ou o cadastro está em uso.');
    }
  };

  return (
    <>
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <RegistryList<Agent>
        title="Agentes"
        subtitle="Representantes comerciais, com documento, contato e endereço."
        icon={UserCheck}
        itemLabel="agente"
        items={filtered}
        totalCount={agents.length}
        stats={stats}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        error={error}
        onRetry={reload}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        onCreate={() => setEditing('new')}
        onView={setViewing}
        onEdit={setEditing}
        onDelete={remove}
        columns={[
          {
            header: 'Cód.',
            className: 'w-20 font-mono font-bold text-emerald-700',
            cell: (agent) => agent.code || '—',
          },
          {
            header: 'Nome',
            cell: (agent) => <span className="font-bold text-stone-900">{agent.name}</span>,
          },
          {
            header: 'Documento',
            className: 'whitespace-nowrap font-mono text-stone-600',
            cell: (agent) => agent.document || '—',
          },
          {
            header: 'Contato',
            className: 'text-stone-600',
            cell: (agent) => agent.phone || agent.email || '—',
          },
          {
            header: 'Cidade',
            className: 'text-stone-600',
            cell: (agent) =>
              [agent.address?.city, agent.address?.state].filter(Boolean).join('/') || '—',
          },
        ]}
        cardLines={(agent) => [
          agent.document || 'Sem documento',
          [agent.phone || agent.email, agent.address?.city].filter(Boolean).join(' · '),
        ]}
      />

      {viewing && (
        <RegistryDetailModal
          title={viewing.name}
          subtitle={`Agente · código ${viewing.code || '—'}`}
          icon={<UserCheck className="h-5 w-5" />}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Identificação',
              rows: [
                { label: 'CPF / CNPJ', value: viewing.document },
                { label: 'Inscrição estadual', value: viewing.ie },
              ],
            },
            {
              title: 'Contato',
              rows: [
                {
                  label: 'E-mail',
                  value: viewing.email && (
                    <a className="text-blue-700 underline" href={`mailto:${viewing.email}`}>
                      {viewing.email}
                    </a>
                  ),
                },
                {
                  label: 'Telefone',
                  value: viewing.phone && (
                    <a
                      className="text-blue-700 underline"
                      href={`tel:${onlyDigits(viewing.phone)}`}
                    >
                      {viewing.phone}
                    </a>
                  ),
                },
              ],
            },
            {
              title: 'Endereço',
              rows: [{ label: 'Endereço', value: formatAddress(viewing.address) }],
            },
          ]}
        />
      )}

      {editing && (
        <AgentFormModal
          agent={editing === 'new' ? null : editing}
          agents={agents}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
