import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import type { Branch, Region, User } from '../types';
import { deleteUser, getBranches, getUsers } from '../services/db';
import {
  adminDeleteAuthUser,
  adminUpdateAuthPassword,
  adminUpdateAuthUser,
  createAuthUser,
} from '../services/authService';
import { type AccessProfile, getAccessProfiles } from '../services/accessProfileService';
import { listRegions, listUserRegions, setUserRegions } from '../services/regionService';
import {
  canChangeUserRole,
  getUserManagementCapabilities,
  type UserManagementCapabilities,
} from '../services/hierarchyService';
import { useAccessLevels } from '../hooks/useAccessLevels';
import { usePagination } from '../hooks/usePagination';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import Pagination from './ui/Pagination';
import { hasUserPermission } from '../navigation/appNavigation';
import { navigateInsideApp } from './notifications/NotificationCard';
import UserFormModal from './users/UserFormModal';
import ResetPasswordModal from './users/ResetPasswordModal';
import {
  buildUserRows,
  effectivePrincipal,
  fallbackPermissionsForRole,
  filterUserRows,
  initials,
  needsRegion,
  type UserDraft,
  type UserFilters,
  type UserRegionLink,
  type UserRow,
  userStats,
} from './users/userModel';

interface UserManagerProps {
  currentUser: User;
}

const FALLBACK_LEVELS = [
  { code: 'user', name: 'Vendedor' },
  { code: 'manager', name: 'Gerente' },
  { code: 'admin', name: 'Administrador' },
  { code: 'master', name: 'Master' },
];

const ROLE_CHIP: Record<string, string> = {
  master: 'bg-stone-900 text-white',
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-violet-100 text-violet-700',
  transportadora: 'bg-amber-100 text-amber-700',
};

const STATUS_CHIP: Record<UserRow['status'], { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700' },
  inativo: { label: 'Inativo', className: 'bg-stone-100 text-stone-500' },
  primeiro_acesso: { label: 'Primeiro acesso', className: 'bg-amber-50 text-amber-700' },
};

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
      <p className="text-xs text-stone-500">{hint}</p>
    </div>
  );
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error || '');

/** Usuários: lista com indicadores e filtros; ficha em abas (Dados, Acesso, Regiões, Permissões). */
export default function UserManager({ currentUser }: UserManagerProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const { levels, byCode } = useAccessLevels();

  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [links, setLinks] = useState<UserRegionLink[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, UserManagementCapabilities>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ user: User | null; draft: UserDraft } | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    regionId: '',
    situation: 'ativos',
  });

  const accessLevels = levels.length > 0 ? levels : FALLBACK_LEVELS;
  const levelName = useCallback(
    (code: string) =>
      byCode.get(code)?.name || FALLBACK_LEVELS.find((level) => level.code === code)?.name || code,
    [byCode]
  );
  const defaultPermissionsFor = useCallback(
    (role: string): Record<string, unknown> => {
      const level = byCode.get(role);
      return level && Object.keys(level.default_permissions ?? {}).length > 0
        ? { ...(level.default_permissions as Record<string, unknown>) }
        : fallbackPermissionsForRole(role);
    },
    [byCode]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [userList, branchList, profileList, regionList, linkList] = await Promise.all([
        getUsers(),
        getBranches(),
        getAccessProfiles(),
        listRegions().catch(() => [] as Region[]),
        listUserRegions().catch(() => [] as UserRegionLink[]),
      ]);
      setUsers(userList);
      setBranches(branchList);
      setProfiles(profileList);
      setRegions(regionList);
      setLinks(linkList);
      setCapabilities(await getUserManagementCapabilities(userList.map((user) => user.id)));
    } catch (error) {
      setLoadError(errorText(error) || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => buildUserRows(users, regions, links), [users, regions, links]);
  const stats = useMemo(() => userStats(rows), [rows]);
  const profileName = useCallback(
    (id?: string) => profiles.find((profile) => profile.id === id)?.name || '',
    [profiles]
  );
  const filtered = useMemo(
    () =>
      filterUserRows(rows, filters, (row) =>
        [
          levelName(row.user.role),
          profileName(row.user.accessProfileId),
          ...row.regions.map((r) => r.name),
        ].join(' ')
      ),
    [rows, filters, levelName, profileName]
  );
  const pagination = usePagination(filtered, 12);
  const regionUserCount = useMemo(
    () =>
      links.reduce<Record<string, number>>((acc, link) => {
        acc[link.regionId] = (acc[link.regionId] || 0) + 1;
        return acc;
      }, {}),
    [links]
  );

  const canManage = (user: User) => capabilities[user.id]?.canManage === true;
  const canDelete = (user: User) => capabilities[user.id]?.canDelete === true;

  const openNew = () =>
    setForm({
      user: null,
      draft: {
        name: '',
        email: '',
        nickname: '',
        password: '',
        role: 'user',
        ativo: true,
        managedUserIds: [],
        filiais_permitidas: [],
        permissions: defaultPermissionsFor('user'),
        accessProfileId: '',
        regionIds: [],
        principalRegionId: '',
      },
    });

  const openEdit = (row: UserRow) => {
    if (!canManage(row.user)) {
      showError('Seu nível não permite editar este usuário.');
      return;
    }
    const { user } = row;
    const permissions = { ...(user.permissions || defaultPermissionsFor(user.role)) } as Record<
      string,
      unknown
    >;
    if (permissions.carregamento_all_filiais === undefined) {
      const ids = permissions.carregamento_filial_ids;
      permissions.carregamento_all_filiais = !(Array.isArray(ids) && ids.length > 0);
    }
    setForm({
      user,
      draft: {
        name: user.name,
        email: user.email,
        nickname: user.nickname || '',
        password: '',
        role: user.role,
        ativo: user.ativo,
        managedUserIds: user.managedUserIds || [],
        filiais_permitidas: user.filiais_permitidas || [],
        permissions,
        accessProfileId: user.accessProfileId || '',
        regionIds: row.regions.map((region) => region.id),
        principalRegionId: row.principalRegionId || '',
      },
    });
  };

  const save = async (draft: UserDraft) => {
    if (!form) return;
    const editing = form.user;
    setSaving(true);
    try {
      const email = draft.email.trim().toLowerCase();
      const nickname = draft.nickname.trim() || draft.name.trim();
      const managed = draft.role === 'manager' ? draft.managedUserIds : [];
      let userId = editing?.id;
      if (editing) {
        if (editing.role !== draft.role && !(await canChangeUserRole(editing.id, draft.role))) {
          throw new Error('Seu nível não permite atribuir este nível de acesso.');
        }
        const result = await adminUpdateAuthUser({
          user_id: editing.id,
          name: draft.name.trim(),
          email,
          nickname,
          role: draft.role,
          ativo: draft.ativo,
          managed_user_ids: managed,
          permissions: draft.permissions,
          filiais_permitidas: draft.filiais_permitidas,
          access_profile_id: draft.accessProfileId || undefined,
        });
        if (!result.success) throw new Error(result.error || 'Não foi possível salvar o usuário.');
      } else {
        const result = await createAuthUser({
          email,
          password: draft.password,
          name: draft.name.trim(),
          nickname,
          role: draft.role,
          ativo: draft.ativo,
          requer_alteracao_senha: true,
          managed_user_ids: managed,
          permissions: draft.permissions,
          filiais_permitidas: draft.filiais_permitidas,
          access_profile_id: draft.accessProfileId || undefined,
        });
        if (!result.success) throw new Error(result.error || 'Não foi possível criar o usuário.');
        userId = result.userId;
      }

      // Regiões: só grava se mudou (o banco confere quem pode).
      const before = form.draft;
      const principal = effectivePrincipal(draft.regionIds, draft.principalRegionId);
      const regionsChanged =
        [...draft.regionIds].sort().join() !== [...before.regionIds].sort().join() ||
        principal !== effectivePrincipal(before.regionIds, before.principalRegionId);
      let regionWarning = '';
      if (userId && regionsChanged) {
        try {
          await setUserRegions(userId, draft.regionIds, principal || null);
        } catch {
          regionWarning = ' As regiões não foram salvas: seu usuário não tem permissão para isso.';
        }
      }

      setForm(null);
      await load();
      if (regionWarning) showError(`Usuário salvo.${regionWarning}`);
      else
        showSuccess(
          editing ? 'Usuário atualizado.' : 'Usuário criado. Ele troca a senha no primeiro acesso.'
        );
    } catch (error) {
      const message = errorText(error);
      showError(
        /duplicate|already|exists|cadastrad/i.test(message)
          ? 'Este e-mail ou apelido já está em uso.'
          : message || 'Não foi possível salvar o usuário.'
      );
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (password: string) => {
    if (!resetting) return;
    setSaving(true);
    try {
      const result = await adminUpdateAuthPassword(resetting.id, password);
      if (!result.success) throw new Error(result.error || 'Não foi possível redefinir a senha.');
      showSuccess(`Senha de ${resetting.name} redefinida.`);
      setResetting(null);
    } catch (error) {
      showError(errorText(error) || 'Não foi possível redefinir a senha.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user: User) => {
    if (!canDelete(user)) {
      showError('Seu nível não permite excluir este usuário.');
      return;
    }
    const ok = await confirm({
      title: 'Excluir usuário',
      message: `Excluir ${user.name}? Ele não poderá mais entrar. Para só bloquear o acesso e manter o histórico, desative a conta em vez de excluir.`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const result = await adminDeleteAuthUser(user.id);
      if (!result.success) await deleteUser(user.id);
      showSuccess('Usuário excluído.');
      await load();
    } catch {
      showError('Não foi possível excluir o usuário.');
    }
  };

  const setFilter = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5 pb-12">
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">Usuários</h1>
          <p className="text-sm text-stone-500">
            Quem acessa o sistema, com que nível, perfil e regiões.
          </p>
        </div>
        <div className="flex gap-2">
          {hasUserPermission(currentUser, 'accessProfiles') && (
            <button
              type="button"
              onClick={() => navigateInsideApp('/access_profiles')}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              <ShieldCheck className="h-4 w-4" /> Perfis de acesso
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" /> Novo usuário
          </button>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {loadError}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Ativos"
          value={stats.active}
          hint={`de ${stats.total} cadastrados`}
          tone="text-stone-900"
        />
        <Kpi
          label="Sem região"
          value={stats.withoutRegion}
          hint="precisam de região para precificar"
          tone={stats.withoutRegion > 0 ? 'text-red-600' : 'text-stone-900'}
        />
        <Kpi
          label="Primeiro acesso"
          value={stats.firstAccess}
          hint="ainda não trocaram a senha"
          tone="text-amber-600"
        />
        <Kpi
          label="Inativos"
          value={stats.inactive}
          hint="sem acesso ao sistema"
          tone="text-stone-500"
        />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-stone-100 p-3 lg:flex-row lg:items-center">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-emerald-500">
            <Search className="h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Buscar por nome, apelido, e-mail, perfil ou região"
              aria-label="Buscar usuário"
              className="h-full w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              aria-label="Filtrar por nível"
              value={filters.role}
              onChange={(event) => setFilter('role', event.target.value)}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700"
            >
              <option value="">Nível: todos</option>
              {accessLevels.map((level) => (
                <option key={level.code} value={level.code}>
                  {level.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por região"
              value={filters.regionId}
              onChange={(event) => setFilter('regionId', event.target.value)}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700"
            >
              <option value="">Região: todas</option>
              <option value="none">Sem região</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div
            role="radiogroup"
            aria-label="Situação"
            className="flex h-10 rounded-xl bg-stone-100 p-1 text-sm font-bold"
          >
            {(['ativos', 'inativos', 'todos'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filters.situation === value}
                onClick={() => setFilter('situation', value)}
                className={`flex-1 rounded-lg px-3 capitalize ${
                  filters.situation === value
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-stone-500'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-stone-500">
            <Users className="mx-auto mb-2 h-8 w-8 text-stone-300" />
            {rows.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário com esses filtros.'}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead className="text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2">Nível</th>
                    <th className="px-4 py-2">Perfil</th>
                    <th className="px-4 py-2">Regiões</th>
                    <th className="px-4 py-2">Situação</th>
                    <th className="px-4 py-2" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((row) => (
                    <UserTableRow
                      key={row.user.id}
                      row={row}
                      levelName={levelName(row.user.role)}
                      profileName={profileName(row.user.accessProfileId)}
                      canManage={canManage(row.user)}
                      canDelete={canDelete(row.user)}
                      onEdit={() => openEdit(row)}
                      onPassword={() => setResetting(row.user)}
                      onDelete={() => void remove(row.user)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-stone-100 lg:hidden">
              {pagination.pageItems.map((row) => (
                <UserCard
                  key={row.user.id}
                  row={row}
                  levelName={levelName(row.user.role)}
                  profileName={profileName(row.user.accessProfileId)}
                  canManage={canManage(row.user)}
                  canDelete={canDelete(row.user)}
                  onEdit={() => openEdit(row)}
                  onPassword={() => setResetting(row.user)}
                  onDelete={() => void remove(row.user)}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        firstItemNumber={pagination.firstItemNumber}
        lastItemNumber={pagination.lastItemNumber}
        pageSize={pagination.pageSize}
        itemLabel="usuários"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      {form && (
        <UserFormModal
          initial={form.draft}
          editing={form.user}
          users={users}
          branches={branches}
          regions={regions}
          regionUserCount={regionUserCount}
          profiles={profiles}
          accessLevels={accessLevels}
          defaultPermissionsFor={defaultPermissionsFor}
          saving={saving}
          onSave={(draft) => void save(draft)}
          onClose={() => !saving && setForm(null)}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          saving={saving}
          onSave={(password) => void resetPassword(password)}
          onClose={() => !saving && setResetting(null)}
        />
      )}
    </div>
  );
}

interface RowProps {
  row: UserRow;
  levelName: string;
  profileName: string;
  canManage: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
}

function RegionChips({ row }: { row: UserRow }) {
  if (row.user.role === 'master' || row.user.role === 'admin') {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
        Todas
      </span>
    );
  }
  if (row.regions.length === 0) {
    return needsRegion(row.user) ? (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
        Sem região
      </span>
    ) : null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.regions.map((region) => (
        <span
          key={region.id}
          title={row.principalRegionId === region.id ? 'Região principal' : undefined}
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            row.principalRegionId === region.id
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {row.principalRegionId === region.id && '★ '}
          {region.name}
        </span>
      ))}
    </div>
  );
}

function Actions({
  canManage,
  canDelete,
  onEdit,
  onPassword,
  onDelete,
  name,
}: Omit<RowProps, 'row' | 'levelName' | 'profileName'> & { name: string }) {
  const base =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={!canManage}
        className={`${base} text-stone-700 hover:bg-stone-50`}
        aria-label={`Editar ${name}`}
      >
        <Pencil className="h-3.5 w-3.5" /> Editar
      </button>
      <button
        type="button"
        onClick={onPassword}
        disabled={!canManage}
        className={`${base} text-stone-600 hover:bg-amber-50`}
        aria-label={`Redefinir senha de ${name}`}
      >
        <KeyRound className="h-3.5 w-3.5" /> Senha
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={`Excluir ${name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
      {initials(name)}
    </span>
  );
}

function UserTableRow({ row, levelName, profileName, ...actions }: RowProps) {
  const status = STATUS_CHIP[row.status];
  return (
    <tr
      className={`border-t border-stone-100 hover:bg-stone-50 ${row.user.ativo ? '' : 'opacity-70'}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.user.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900">{row.user.name}</p>
            <p className="truncate text-xs text-stone-500">
              {row.user.nickname ? `@${row.user.nickname} · ` : ''}
              {row.user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_CHIP[row.user.role] || 'bg-blue-100 text-blue-700'}`}
        >
          {levelName}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-stone-600">{profileName || '—'}</td>
      <td className="px-4 py-3">
        <RegionChips row={row} />
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Actions {...actions} name={row.user.name} />
      </td>
    </tr>
  );
}

function UserCard({ row, levelName, profileName, ...actions }: RowProps) {
  const status = STATUS_CHIP[row.status];
  return (
    <li className={`space-y-2 p-4 ${row.user.ativo ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <Avatar name={row.user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-stone-900">{row.user.name}</p>
          <p className="truncate text-xs text-stone-500">
            {row.user.nickname ? `@${row.user.nickname}` : row.user.email}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-bold ${ROLE_CHIP[row.user.role] || 'bg-blue-100 text-blue-700'}`}
        >
          {levelName}
        </span>
        {profileName && <span className="text-stone-500">{profileName}</span>}
      </div>
      <RegionChips row={row} />
      <div className="flex justify-end">
        <Actions {...actions} name={row.user.name} />
      </div>
    </li>
  );
}
