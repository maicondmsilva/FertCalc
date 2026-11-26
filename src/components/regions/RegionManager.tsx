import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Edit2,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { Region, User } from '../../types';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import {
  CatalogModal,
  Field,
  FormSection,
  Switch,
  fieldClass,
  primaryButton,
  secondaryButton,
} from '../products/catalogUi';
import {
  buildRegionRows,
  matchesRegionSearch,
  regionProblem,
  regionStats,
  type RegionRow,
} from './regionModel';

const services = () => import('../../services/regionService');

/**
 * Configurações → Regiões. Quem tem a permissão "Regiões — Gerenciar" (ou é
 * admin/master) cria, edita, desativa e exclui; o banco confere a permissão.
 */
export default function RegionManager() {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [regions, setRegions] = useState<Region[]>([]);
  const [links, setLinks] = useState<{ userId: string; regionId: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<RegionRow | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [{ listRegions, listUserRegions }, { getUsers }] = await Promise.all([
          services(),
          import('../../services/db'),
        ]);
        const [regionList, linkList, userList] = await Promise.all([
          listRegions(),
          listUserRegions(),
          getUsers(),
        ]);
        if (!active) return;
        setRegions(regionList);
        setLinks(linkList);
        setUsers(userList);
      } catch {
        if (active) setError('Não foi possível carregar as regiões. Verifique a conexão.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const rows = useMemo(() => buildRegionRows(regions, links, users), [regions, links, users]);
  const filtered = rows.filter((row) => matchesRegionSearch(row, search));
  const stats = regionStats(rows, users);

  const save = async (draft: { name: string; code: string; ativo: boolean; userIds: string[] }) => {
    setSaving(true);
    try {
      const { saveRegion } = await services();
      const current =
        editing && editing !== 'new'
          ? { id: editing.id, userIds: editing.users.map((user) => user.id) }
          : { userIds: [] };
      await saveRegion(draft, current);
      showSuccess(editing === 'new' ? 'Região criada.' : 'Região atualizada.');
      setEditing(null);
      reload();
    } catch (saveError) {
      const { regionErrorMessage } = await services();
      showError(regionErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: RegionRow) => {
    const ok = await confirm({
      title: `Excluir ${row.name}?`,
      message:
        row.users.length > 0
          ? `A região tem ${row.users.length} usuário(s) vinculado(s), então será desativada (não aparece para novos registros, mas mantém o histórico).`
          : 'A região não está em uso e será excluída.',
      variant: 'danger',
      confirmLabel: row.users.length > 0 ? 'Desativar' : 'Excluir',
    });
    if (!ok) return;
    try {
      const { deleteOrDeactivateRegion } = await services();
      const result = await deleteOrDeactivateRegion(row.id);
      showSuccess(result === 'desativada' ? 'Região desativada.' : 'Região excluída.');
      reload();
    } catch (removeError) {
      const { regionErrorMessage } = await services();
      showError(regionErrorMessage(removeError));
    }
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MapIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-stone-900">Regiões</h1>
            <p className="text-sm text-stone-500">
              Cada vendedor enxerga e cria o que é das suas regiões. Quem não vende pode ficar sem
              região.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing('new')} className={primaryButton}>
          <Plus className="h-4 w-4" /> Nova região
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ['Regiões ativas', stats.activeRegions, false],
            ['Usuários com região', stats.usersWithRegion, false],
            ['Usuários sem região', stats.usersWithoutRegion, true],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
            <p className="text-2xl font-black tabular-nums text-stone-900">
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar região ou usuário"
              aria-label="Buscar região"
              className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-red-800"
          >
            <AlertTriangle className="h-6 w-6" /> {error}
            <button type="button" onClick={reload} className={secondaryButton}>
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-stone-400">
            {search ? 'Nada encontrado para essa busca.' : 'Nenhuma região cadastrada ainda.'}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 sm:w-56">
                  <p className="font-bold text-stone-900">{row.name}</p>
                  <p className="font-mono text-xs text-emerald-700">{row.code || '—'}</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {row.users.length > 0 ? (
                    row.users.map((user) => (
                      <span
                        key={user.id}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700"
                      >
                        {user.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-stone-400">Nenhum usuário</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      row.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {row.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    aria-label={`Editar ${row.name}`}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    aria-label={`Excluir ${row.name}`}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <RegionFormModal
          region={editing === 'new' ? null : editing}
          rows={rows}
          users={users.filter((user) => user.ativo !== false)}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RegionFormModal({
  region,
  rows,
  users,
  saving,
  onSave,
  onClose,
}: {
  region: RegionRow | null;
  rows: RegionRow[];
  users: User[];
  saving: boolean;
  onSave: (draft: { name: string; code: string; ativo: boolean; userIds: string[] }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(region?.name || '');
  const [code, setCode] = useState(region?.code || '');
  const [ativo, setAtivo] = useState(region?.ativo ?? true);
  const [userIds, setUserIds] = useState<string[]>(region?.users.map((user) => user.id) || []);
  const [userSearch, setUserSearch] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const problem = regionProblem({ name, code }, rows, region?.id);
  const userById = new Map(users.map((user) => [user.id, user]));
  const candidates = users
    .filter(
      (user) =>
        !userIds.includes(user.id) &&
        (!userSearch.trim() ||
          user.name.toLowerCase().includes(userSearch.trim().toLowerCase()) ||
          (user.email || '').toLowerCase().includes(userSearch.trim().toLowerCase()))
    )
    .slice(0, 8);

  const submit = () => {
    if (problem) {
      setShowErrors(true);
      return;
    }
    onSave({ name, code, ativo, userIds });
  };

  return (
    <CatalogModal
      isOpen
      size="md"
      title={region ? `Editar ${region.name}` : 'Nova região'}
      subtitle="Região e usuários vinculados"
      icon={<MapIcon className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButton}>
            <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar região'}
          </button>
        </>
      }
    >
      <FormSection title="Identificação">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nome" required className="col-span-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Sul de Goiás"
              className={fieldClass}
            />
          </Field>
          <Field label="Código">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="GO-SUL"
              className={`${fieldClass} font-mono`}
            />
          </Field>
        </div>
        {showErrors && problem && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {problem}
          </p>
        )}
      </FormSection>

      <FormSection
        title="Usuários da região"
        description="Um usuário pode estar em várias regiões. Também dá para vincular pela tela de Usuários."
      >
        <div className="flex flex-wrap gap-1.5">
          {userIds.length === 0 && <span className="text-sm text-stone-400">Nenhum usuário.</span>}
          {userIds.map((userId) => (
            <span
              key={userId}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"
            >
              {userById.get(userId)?.name || 'Usuário'}
              <button
                type="button"
                onClick={() => setUserIds((current) => current.filter((id) => id !== userId))}
                aria-label={`Remover ${userById.get(userId)?.name || 'usuário'}`}
                className="rounded-full p-0.5 hover:bg-emerald-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Adicionar usuário (nome ou e-mail)"
            aria-label="Adicionar usuário"
            className={`${fieldClass} pl-9`}
          />
        </div>
        {userSearch.trim() && (
          <ul className="max-h-52 overflow-y-auto rounded-xl border border-stone-200">
            {candidates.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Nenhum usuário encontrado.</li>
            ) : (
              candidates.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserIds((current) => [...current, user.id]);
                      setUserSearch('');
                    }}
                    className="block w-full border-b border-stone-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-emerald-50"
                  >
                    <span className="font-bold text-stone-800">{user.name}</span>
                    <span className="ml-2 text-xs text-stone-500">{user.email}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </FormSection>

      <FormSection title="Situação">
        <Switch
          checked={ativo}
          onChange={setAtivo}
          label={ativo ? 'Ativa' : 'Inativa'}
          description="Região inativa não aparece para escolher em novos registros."
        />
      </FormSection>
    </CatalogModal>
  );
}
