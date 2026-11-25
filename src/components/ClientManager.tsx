import React, { useCallback, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { Client, User } from '../types';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { RegistryDetailModal, RegistryList } from './registry/RegistryList';
import ClientFormModal, { type ClientDraft } from './registry/ClientFormModal';
import { registrySaveError, useRegistryData } from './registry/useRegistryData';
import {
  formatAddress,
  isAddressFilled,
  matchesRegistrySearch,
  onlyDigits,
  registryPermissions,
} from './registry/registryModel';

const loadClients = () => import('../services/registryService').then((m) => m.listClients());

/** Cadastro de clientes: lista, ficha, novo/editar em modal e exclusão. */
export default function ClientManager({ currentUser }: { currentUser: User }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const { canCreate, canEdit, canDelete } = registryPermissions(currentUser, 'clients');
  const {
    items: clients,
    loading,
    error,
    reload,
  } = useRegistryData<Client>(useCallback(loadClients, []));
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Client | null>(null);
  const [editing, setEditing] = useState<Client | null | 'new'>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => clients.filter((client) => matchesRegistrySearch(client, search)),
    [clients, search]
  );
  const stats = useMemo(
    () => [
      { label: 'Clientes', value: clients.length },
      {
        label: 'CNPJ',
        value: clients.filter((client) => onlyDigits(client.document).length === 14).length,
      },
      {
        label: 'Sem endereço',
        value: clients.filter((client) => !isAddressFilled(client.address)).length,
        tone: 'warning' as const,
      },
      {
        label: 'Sem contato',
        value: clients.filter((client) => !client.phone && !client.email).length,
        tone: 'warning' as const,
      },
    ],
    [clients]
  );

  const save = async (draft: ClientDraft) => {
    setSaving(true);
    try {
      const { saveClient } = await import('../services/registryService');
      const id = editing && editing !== 'new' ? editing.id : undefined;
      await saveClient(draft, id);
      showSuccess(id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      setEditing(null);
      reload();
    } catch (saveError) {
      showError(registrySaveError(saveError, 'cliente'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (client: Client) => {
    const { countClientOrders, removeRegistry } = await import('../services/registryService');
    const orders = await countClientOrders(client.id);
    const ok = await confirm({
      title: `Excluir ${client.name}?`,
      message:
        orders > 0
          ? `Este cliente está em ${orders} pedido(s) de venda, que ficarão sem o vínculo. As precificações mantêm o nome gravado. Esta ação não pode ser desfeita.`
          : 'Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await removeRegistry('clients', client.id);
      showSuccess('Cliente excluído.');
      setViewing(null);
      reload();
    } catch {
      showError('Não foi possível excluir: sem permissão ou o cadastro está em uso.');
    }
  };

  return (
    <>
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <RegistryList<Client>
        title="Clientes"
        subtitle="Produtores e empresas atendidos, com documento, contato e endereços."
        icon={Users}
        itemLabel="cliente"
        items={filtered}
        totalCount={clients.length}
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
            cell: (client) => client.code || '—',
          },
          {
            header: 'Nome',
            cell: (client) => (
              <>
                <p className="font-bold text-stone-900">{client.name}</p>
                {client.fazenda && <p className="text-xs text-stone-500">{client.fazenda}</p>}
              </>
            ),
          },
          {
            header: 'Documento',
            className: 'whitespace-nowrap font-mono text-stone-600',
            cell: (client) => client.document || '—',
          },
          {
            header: 'IE',
            className: 'text-stone-600',
            cell: (client) => client.stateRegistration || '—',
          },
          {
            header: 'Cidade',
            className: 'text-stone-600',
            cell: (client) =>
              [client.address?.city, client.address?.state].filter(Boolean).join('/') || '—',
          },
        ]}
        cardLines={(client) => [
          [client.document, client.stateRegistration && `IE ${client.stateRegistration}`]
            .filter(Boolean)
            .join(' · '),
          [client.fazenda, client.address?.city].filter(Boolean).join(' · '),
        ]}
      />

      {viewing && (
        <RegistryDetailModal
          title={viewing.name}
          subtitle={`Cliente · código ${viewing.code || '—'}`}
          icon={<Users className="h-5 w-5" />}
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
                { label: 'Inscrição estadual', value: viewing.stateRegistration },
                { label: 'Fazenda', value: viewing.fazenda },
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
              title: 'Endereços',
              rows: [
                { label: 'Correspondência', value: formatAddress(viewing.address) },
                {
                  label: 'Entrega',
                  value: viewing.deliverySameAsAddress
                    ? 'Igual ao de correspondência'
                    : formatAddress(viewing.deliveryAddress),
                },
              ],
            },
          ]}
        />
      )}

      {editing && (
        <ClientFormModal
          client={editing === 'new' ? null : editing}
          clients={clients}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
