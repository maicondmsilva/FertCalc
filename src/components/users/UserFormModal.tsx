import React, { useMemo, useState } from 'react';
import { Check, Loader2, MapPin, ShieldCheck, Star, X } from 'lucide-react';
import type { Branch, Region, User } from '../../types';
import type { AccessProfile } from '../../services/accessProfileService';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import PermissionEditor from './PermissionEditor';
import PasswordField, { fieldClass } from './PasswordField';
import { countEnabled, differencesFromProfile, isEnabled } from './permissionCatalog';
import { effectivePrincipal, initials, type UserDraft, userDraftProblem } from './userModel';

export type UserTab = 'dados' | 'acesso' | 'regioes' | 'permissoes';

interface AccessLevelOption {
  code: string;
  name: string;
}

interface UserFormModalProps {
  initial: UserDraft;
  editing: User | null;
  users: User[];
  branches: Branch[];
  regions: Region[];
  regionUserCount: Record<string, number>;
  profiles: AccessProfile[];
  accessLevels: AccessLevelOption[];
  defaultPermissionsFor: (role: string) => Record<string, unknown>;
  saving: boolean;
  onSave: (draft: UserDraft) => void;
  onClose: () => void;
}

const CREDIT_CARD_ROLES = [
  { value: 'none', label: 'Sem acesso' },
  { value: 'viewer', label: 'Visualizador — só vê' },
  { value: 'launcher', label: 'Lançador — lança gastos' },
  { value: 'checker', label: 'Conferente — lança e confere' },
  { value: 'approver', label: 'Aprovador — lança, confere e aprova' },
  { value: 'admin', label: 'Administrador do módulo' },
];

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function CheckCard({
  checked,
  onChange,
  title,
  subtitle,
  aside,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        checked ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-white'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
      >
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded ${
            checked ? 'bg-emerald-600 text-white' : 'border border-stone-300 bg-white'
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-stone-900">{title}</span>
          {subtitle && <span className="block text-xs text-stone-500">{subtitle}</span>}
        </span>
      </button>
      {aside}
    </div>
  );
}

const sameList = (left: string[], right: string[]) =>
  left.length === right.length && [...left].sort().join() === [...right].sort().join();

/** Ficha do usuário em abas: Dados, Acesso, Regiões e Permissões. */
export default function UserFormModal({
  initial,
  editing,
  users,
  branches,
  regions,
  regionUserCount,
  profiles,
  accessLevels,
  defaultPermissionsFor,
  saving,
  onSave,
  onClose,
}: UserFormModalProps) {
  const [draft, setDraft] = useState<UserDraft>(initial);
  const [tab, setTab] = useState<UserTab>('dados');
  const [problem, setProblem] = useState<string | null>(null);
  const isNew = !editing;
  const set = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const setPermission = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, permissions: { ...current.permissions, [key]: value } }));

  const profile = profiles.find((item) => item.id === draft.accessProfileId);
  const differences = differencesFromProfile(draft.permissions, profile?.permissions);
  const principal = effectivePrincipal(draft.regionIds, draft.principalRegionId);
  const activeRegions = regions.filter(
    (region) => region.ativo || draft.regionIds.includes(region.id)
  );
  const managedCandidates = users.filter((user) => user.role === 'user' && user.id !== editing?.id);
  const levelName = accessLevels.find((level) => level.code === draft.role)?.name || draft.role;

  // O que mudou, por aba — para o rodapé avisar antes de salvar ou fechar.
  const changes = useMemo(() => {
    const list: string[] = [];
    if (
      draft.name !== initial.name ||
      draft.email !== initial.email ||
      draft.nickname !== initial.nickname ||
      draft.ativo !== initial.ativo ||
      draft.password
    )
      list.push('Dados');
    if (
      draft.role !== initial.role ||
      draft.accessProfileId !== initial.accessProfileId ||
      !sameList(draft.managedUserIds, initial.managedUserIds) ||
      !sameList(draft.filiais_permitidas, initial.filiais_permitidas) ||
      draft.permissions.creditCard !== initial.permissions.creditCard
    )
      list.push('Acesso');
    if (
      !sameList(draft.regionIds, initial.regionIds) ||
      principal !== effectivePrincipal(initial.regionIds, initial.principalRegionId)
    )
      list.push('Regiões');
    const permissionChanges = differencesFromProfile(draft.permissions, initial.permissions).length;
    if (permissionChanges > 0)
      list.push(`${permissionChanges} ${permissionChanges === 1 ? 'permissão' : 'permissões'}`);
    return list;
  }, [draft, initial, principal]);

  const applyProfile = (profileId: string) => {
    const chosen = profiles.find((item) => item.id === profileId);
    setDraft((current) => ({
      ...current,
      accessProfileId: profileId,
      permissions: chosen ? { ...current.permissions, ...chosen.permissions } : current.permissions,
    }));
  };

  const changeRole = (role: string) => {
    setDraft((current) => ({
      ...current,
      role,
      accessProfileId: '',
      permissions: {
        ...defaultPermissionsFor(role),
        // Configurações próprias que o nível não define continuam como estavam.
        carregamento_filial_ids: current.permissions.carregamento_filial_ids,
      },
    }));
  };

  const toggleRegion = (regionId: string) => {
    setDraft((current) => {
      const has = current.regionIds.includes(regionId);
      const regionIds = has
        ? current.regionIds.filter((id) => id !== regionId)
        : [...current.regionIds, regionId];
      return {
        ...current,
        regionIds,
        principalRegionId:
          has && current.principalRegionId === regionId ? '' : current.principalRegionId,
      };
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = userDraftProblem(draft, isNew);
    if (found) {
      setTab(found.tab);
      setProblem(found.message);
      return;
    }
    setProblem(null);
    onSave({ ...draft, principalRegionId: principal });
  };

  const tabs: Array<{ id: UserTab; label: string; badge?: string }> = [
    { id: 'dados', label: 'Dados' },
    { id: 'acesso', label: 'Acesso' },
    { id: 'regioes', label: 'Regiões', badge: String(draft.regionIds.length) },
    { id: 'permissoes', label: 'Permissões', badge: String(countEnabled(draft.permissions)) },
  ];

  const carregamentoFiliais: string[] = Array.isArray(draft.permissions.carregamento_filial_ids)
    ? (draft.permissions.carregamento_filial_ids as string[])
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Novo usuário' : `Editar ${initial.name}`}
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="border-b border-stone-100 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 font-black text-emerald-800">
                {initials(draft.name || 'Novo usuário')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-stone-900">
                  {draft.name || 'Novo usuário'}
                </p>
                <p className="truncate text-xs text-stone-500">
                  {[
                    draft.nickname && `@${draft.nickname}`,
                    levelName,
                    profile ? `perfil ${profile.name}` : 'sem perfil',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-5 overflow-x-auto" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`shrink-0 border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors ${
                  tab === item.id
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {item.label}
                {item.badge !== undefined && (
                  <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-[10px] text-stone-600">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {problem && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            >
              {problem}
            </p>
          )}

          {tab === 'dados' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" htmlFor="user-name" required>
                <input
                  id="user-name"
                  value={draft.name}
                  onChange={(event) => set('name', event.target.value)}
                  className={fieldClass}
                  autoComplete="off"
                />
              </Field>
              <Field label="E-mail" htmlFor="user-email" required>
                <input
                  id="user-email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => set('email', event.target.value)}
                  className={fieldClass}
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Apelido para entrar"
                htmlFor="user-nickname"
                required
                hint="O usuário pode entrar com o e-mail ou com este apelido."
              >
                <input
                  id="user-nickname"
                  value={draft.nickname}
                  onChange={(event) => set('nickname', event.target.value.replace(/\s/g, ''))}
                  placeholder="ex.: joao.silva"
                  className={fieldClass}
                  autoComplete="off"
                />
              </Field>
              {isNew ? (
                <Field
                  label="Senha inicial"
                  htmlFor="user-password"
                  required
                  hint="No primeiro acesso o usuário é obrigado a trocar."
                >
                  <PasswordField
                    id="user-password"
                    value={draft.password}
                    onChange={(value) => set('password', value)}
                    allowCopy
                  />
                </Field>
              ) : (
                <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                  Para trocar a senha, use <strong>Senha</strong> na lista de usuários.
                </div>
              )}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.ativo}
                  onClick={() => set('ativo', !draft.ativo)}
                  className="flex w-full items-center justify-between rounded-xl border border-stone-200 p-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-bold text-stone-900">Conta ativa</span>
                    <span className="block text-xs text-stone-500">
                      Desativada, o usuário não consegue entrar; o histórico é mantido.
                    </span>
                  </span>
                  <span
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full ${draft.ativo ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.ativo ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </span>
                </button>
              </div>
            </div>
          )}

          {tab === 'acesso' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nível de acesso"
                  htmlFor="user-role"
                  required
                  hint="Define a hierarquia: quem gerencia quem."
                >
                  <select
                    id="user-role"
                    value={draft.role}
                    onChange={(event) => changeRole(event.target.value)}
                    className={fieldClass}
                  >
                    {accessLevels.map((level) => (
                      <option key={level.code} value={level.code}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Perfil de acesso"
                  htmlFor="user-profile"
                  hint="Preenche as permissões; dá para ajustar na aba Permissões."
                >
                  <select
                    id="user-profile"
                    value={draft.accessProfileId}
                    onChange={(event) => applyProfile(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Sem perfil</option>
                    {profiles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {draft.role === 'manager' && (
                <section>
                  <h4 className="mb-1 text-sm font-black text-stone-900">Vendedores gerenciados</h4>
                  <p className="mb-3 text-xs text-stone-500">
                    O gerente acompanha e aprova o trabalho destes vendedores.
                  </p>
                  {managedCandidates.length === 0 ? (
                    <p className="text-sm text-stone-500">Nenhum vendedor cadastrado.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {managedCandidates.map((user) => (
                        <CheckCard
                          key={user.id}
                          checked={draft.managedUserIds.includes(user.id)}
                          onChange={() =>
                            set(
                              'managedUserIds',
                              draft.managedUserIds.includes(user.id)
                                ? draft.managedUserIds.filter((id) => id !== user.id)
                                : [...draft.managedUserIds, user.id]
                            )
                          }
                          title={user.name}
                          subtitle={user.ativo ? undefined : 'inativo'}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section>
                <h4 className="mb-1 text-sm font-black text-stone-900">Filiais permitidas</h4>
                <p className="mb-3 text-xs text-stone-500">
                  Filiais em que o usuário trabalha. Nenhuma marcada: sem restrição de filial.
                </p>
                {branches.length === 0 ? (
                  <p className="text-sm text-stone-500">Nenhuma filial cadastrada.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {branches.map((branch) => (
                      <CheckCard
                        key={branch.id}
                        checked={draft.filiais_permitidas.includes(branch.id)}
                        onChange={() =>
                          set(
                            'filiais_permitidas',
                            draft.filiais_permitidas.includes(branch.id)
                              ? draft.filiais_permitidas.filter((id) => id !== branch.id)
                              : [...draft.filiais_permitidas, branch.id]
                          )
                        }
                        title={branch.name}
                        subtitle={branch.ativo === false ? 'inativa' : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Gastos com cartão"
                  htmlFor="user-credit-card"
                  hint="Papel no módulo de gastos, independente do nível."
                >
                  <select
                    id="user-credit-card"
                    value={String(draft.permissions.creditCard || 'none')}
                    onChange={(event) => setPermission('creditCard', event.target.value)}
                    className={fieldClass}
                  >
                    {CREDIT_CARD_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {isEnabled(draft.permissions, 'carregamento') && (
                <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-stone-900">
                        Filiais no módulo Carregamento
                      </h4>
                      <p className="text-xs text-stone-500">
                        Quais filiais o usuário vê em cotações e carregamentos.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled(draft.permissions, 'carregamento_all_filiais')}
                      onClick={() =>
                        setDraft((current) => {
                          const all = !isEnabled(current.permissions, 'carregamento_all_filiais');
                          return {
                            ...current,
                            permissions: {
                              ...current.permissions,
                              carregamento_all_filiais: all,
                              ...(all ? { carregamento_filial_ids: [] } : {}),
                            },
                          };
                        })
                      }
                      className="flex items-center gap-2 text-sm font-semibold text-stone-700"
                    >
                      Todas as filiais
                      <span
                        className={`relative inline-flex h-5 w-9 rounded-full ${isEnabled(draft.permissions, 'carregamento_all_filiais') ? 'bg-emerald-600' : 'bg-stone-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${isEnabled(draft.permissions, 'carregamento_all_filiais') ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                        />
                      </span>
                    </button>
                  </div>
                  {!isEnabled(draft.permissions, 'carregamento_all_filiais') && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {branches.map((branch) => (
                        <CheckCard
                          key={branch.id}
                          checked={carregamentoFiliais.includes(branch.id)}
                          onChange={() =>
                            setPermission(
                              'carregamento_filial_ids',
                              carregamentoFiliais.includes(branch.id)
                                ? carregamentoFiliais.filter((id) => id !== branch.id)
                                : [...carregamentoFiliais, branch.id]
                            )
                          }
                          title={branch.name}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === 'regioes' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <section>
                <h4 className="mb-1 text-sm font-black text-stone-900">Regiões do usuário</h4>
                <p className="mb-3 text-sm text-stone-500">
                  A precificação é salva numa destas regiões. A <strong>principal</strong> já vem
                  marcada ao salvar; com uma região só, ela é a principal.
                </p>
                {activeRegions.length === 0 ? (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                    Nenhuma região cadastrada. Cadastre em Configurações → Regiões.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeRegions.map((region) => {
                      const checked = draft.regionIds.includes(region.id);
                      const isPrincipal = principal === region.id;
                      return (
                        <CheckCard
                          key={region.id}
                          checked={checked}
                          onChange={() => toggleRegion(region.id)}
                          title={
                            <>
                              {region.name}
                              {region.code && (
                                <span className="ml-1.5 text-xs font-semibold text-stone-400">
                                  {region.code}
                                </span>
                              )}
                            </>
                          }
                          subtitle={
                            region.ativo
                              ? `${regionUserCount[region.id] || 0} usuário(s)`
                              : 'Região inativa'
                          }
                          aside={
                            checked && (
                              <button
                                type="button"
                                onClick={() => set('principalRegionId', region.id)}
                                aria-pressed={isPrincipal}
                                aria-label={`Tornar ${region.name} a região principal`}
                                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                                  isPrincipal
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-emerald-700 hover:bg-white'
                                }`}
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${isPrincipal ? 'fill-white' : ''}`}
                                />
                                {isPrincipal ? 'Principal' : 'Tornar principal'}
                              </button>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
                {draft.regionIds.length > 1 && !principal && (
                  <p className="mt-3 text-xs font-semibold text-amber-700">
                    Escolha a região principal (⭐) para ela já vir marcada na precificação.
                  </p>
                )}
              </section>
              <aside className="space-y-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled(draft.permissions, 'pricing_viewAllRegions')}
                  onClick={() =>
                    setPermission(
                      'pricing_viewAllRegions',
                      !isEnabled(draft.permissions, 'pricing_viewAllRegions')
                    )
                  }
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-stone-200 p-3 text-left"
                >
                  <span>
                    <span className="block text-xs font-bold uppercase text-stone-500">
                      Ver outras regiões
                    </span>
                    <span className="mt-1 block text-sm text-stone-800">
                      Ver precificações de todas as regiões
                    </span>
                    <span className="mt-1 block text-xs text-stone-500">
                      Editar e excluir seguem as permissões.
                    </span>
                  </span>
                  <span
                    className={`relative mt-1 inline-flex h-5 w-9 shrink-0 rounded-full ${isEnabled(draft.permissions, 'pricing_viewAllRegions') ? 'bg-emerald-600' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${isEnabled(draft.permissions, 'pricing_viewAllRegions') ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                    />
                  </span>
                </button>
                <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <MapPin className="h-4 w-4 shrink-0" />
                  Gerente vê as precificações das regiões em que está vinculado.
                </p>
              </aside>
            </div>
          )}

          {tab === 'permissoes' && (
            <div className="space-y-3">
              {profile ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <ShieldCheck className="h-4 w-4" />
                  Baseado no perfil <strong>{profile.name}</strong>.
                  {differences.length === 0
                    ? ' Igual ao perfil.'
                    : ` ${differences.length} ${differences.length === 1 ? 'permissão está diferente' : 'permissões estão diferentes'} do perfil.`}
                  {differences.length > 0 && (
                    <button
                      type="button"
                      onClick={() => applyProfile(profile.id)}
                      className="font-bold underline"
                    >
                      Voltar ao perfil
                    </button>
                  )}
                </p>
              ) : (
                <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  Sem perfil: as permissões abaixo são só deste usuário.
                </p>
              )}
              <PermissionEditor
                permissions={draft.permissions}
                onChange={(permissions) => set('permissions', permissions)}
                baseline={profile?.permissions}
                toolbar={
                  profiles.length > 0 && (
                    <select
                      aria-label="Aplicar perfil"
                      value=""
                      onChange={(event) => event.target.value && applyProfile(event.target.value)}
                      className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700"
                    >
                      <option value="">Aplicar perfil…</option>
                      {profiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  )
                }
              />
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-xs text-stone-500">
            {changes.length > 0
              ? `Alterações não salvas: ${changes.join(', ')}`
              : isNew
                ? 'Preencha os dados e salve.'
                : 'Nenhuma alteração.'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl px-4 text-sm font-bold text-stone-600 hover:bg-stone-100 sm:flex-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || (!isNew && changes.length === 0)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:flex-none"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando…' : isNew ? 'Criar usuário' : 'Salvar usuário'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
