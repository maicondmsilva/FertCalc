import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { User } from '../types';
import {
  type AccessProfile,
  createAccessProfile,
  deleteAccessProfile,
  getAccessProfiles,
  updateAccessProfile,
} from '../services/accessProfileService';
import { getUsers, updateUser } from '../services/db';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import PermissionEditor from './users/PermissionEditor';
import { fieldClass } from './users/PasswordField';
import {
  countEnabled,
  differencesFromProfile,
  type PermissionMap,
} from './users/permissionCatalog';

interface Draft {
  id: string | null;
  name: string;
  description: string;
  permissions: PermissionMap;
}

const fromProfile = (profile: AccessProfile): Draft => ({
  id: profile.id,
  name: profile.name,
  description: profile.description || '',
  permissions: { ...profile.permissions },
});

const emptyDraft = (): Draft => ({ id: null, name: '', description: '', permissions: {} });

/** Mensagem do banco em linguagem do usuário. */
export function profileErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error || '');
  if (/23505|duplicate|access_profiles_org_name_key/i.test(text))
    return 'Já existe um perfil com esse nome.';
  if (/42501|row-level|permission/i.test(text))
    return 'Só administradores podem criar, editar ou excluir perfis.';
  return 'Não foi possível salvar o perfil. Tente novamente.';
}

/**
 * Perfis de acesso: modelos de permissões aplicados aos usuários.
 * Lista à esquerda, editor à direita. Só admin/master alteram (o banco confere).
 */
export default function AccessProfileManager({ currentUser }: { currentUser?: User }) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const canEdit = !currentUser || currentUser.role === 'master' || currentUser.role === 'admin';

  const load = useCallback(async (selectId?: string | null) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profileList, userList] = await Promise.all([getAccessProfiles(), getUsers()]);
      setProfiles(profileList);
      setUsers(userList);
      setDraft((current) => {
        const id = selectId === undefined ? current?.id : selectId;
        const chosen = profileList.find((profile) => profile.id === id) || profileList[0];
        if (current && current.id === null && selectId === undefined) return current;
        return chosen ? fromProfile(chosen) : null;
      });
    } catch {
      setLoadError('Não foi possível carregar os perfis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usersByProfile = useMemo(
    () =>
      users.reduce<Record<string, number>>((acc, user) => {
        if (user.accessProfileId) acc[user.accessProfileId] = (acc[user.accessProfileId] || 0) + 1;
        return acc;
      }, {}),
    [users]
  );

  const saved = draft?.id ? profiles.find((profile) => profile.id === draft.id) : undefined;
  const dirty =
    !!draft &&
    (!saved ||
      saved.name !== draft.name ||
      (saved.description || '') !== draft.description ||
      differencesFromProfile(draft.permissions, saved.permissions).length > 0);

  const select = async (profile: AccessProfile) => {
    if (draft?.id === profile.id) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Descartar alterações?',
        message: 'O perfil aberto tem alterações não salvas.',
        confirmLabel: 'Descartar',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setDraft(fromProfile(profile));
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (name.length < 2) {
      showError('Dê um nome ao perfil.');
      return;
    }
    if (
      profiles.some(
        (profile) =>
          profile.id !== draft.id && profile.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      showError('Já existe um perfil com esse nome.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: draft.description.trim() || undefined,
        permissions: draft.permissions as Record<string, boolean | string>,
      };
      // Quem usa o perfil sem ajustes próprios acompanha a mudança (se confirmar).
      const followers = saved
        ? users.filter(
            (user) =>
              user.accessProfileId === saved.id &&
              differencesFromProfile(user.permissions as PermissionMap, saved.permissions)
                .length === 0
          )
        : [];
      const result = draft.id
        ? await updateAccessProfile(draft.id, payload)
        : await createAccessProfile(payload);
      let updated = 0;
      if (
        followers.length > 0 &&
        differencesFromProfile(draft.permissions, saved?.permissions).length > 0
      ) {
        const ok = await confirm({
          title: 'Atualizar os usuários deste perfil?',
          message: `${followers.length} usuário(s) usam "${name}" sem ajustes próprios. Aplicar as novas permissões a eles também? Quem tem ajustes próprios não muda.`,
          confirmLabel: 'Atualizar usuários',
          cancelLabel: 'Só o perfil',
          variant: 'warning',
        });
        if (ok) {
          for (const user of followers) {
            try {
              await updateUser(user.id, {
                permissions: {
                  ...(user.permissions || {}),
                  ...draft.permissions,
                } as User['permissions'],
              });
              updated += 1;
            } catch {
              // Sem permissão para algum usuário (hierarquia): segue com os demais.
            }
          }
        }
      }
      showSuccess(
        draft.id
          ? updated > 0
            ? `Perfil salvo e ${updated} usuário(s) atualizado(s).`
            : 'Perfil salvo.'
          : 'Perfil criado.'
      );
      await load(result.id);
    } catch (error) {
      showError(profileErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const duplicate = () => {
    if (!draft) return;
    setDraft({
      id: null,
      name: `${draft.name} (cópia)`,
      description: draft.description,
      permissions: { ...draft.permissions },
    });
  };

  const remove = async () => {
    if (!draft?.id) return;
    const count = usersByProfile[draft.id] || 0;
    const ok = await confirm({
      title: 'Excluir perfil',
      message:
        count > 0
          ? `${count} usuário(s) usam "${draft.name}". Eles mantêm as permissões que têm hoje, mas ficam sem perfil.`
          : `Excluir o perfil "${draft.name}"?`,
      confirmLabel: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAccessProfile(draft.id);
      showSuccess('Perfil excluído.');
      await load(null);
    } catch (error) {
      showError(profileErrorMessage(error));
    }
  };

  const userCount = draft?.id ? usersByProfile[draft.id] || 0 : 0;

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
      <header>
        <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">Perfis de acesso</h1>
        <p className="text-sm text-stone-500">
          Modelos de permissões. Ao aplicar um perfil, o usuário recebe estas permissões e pode ter
          ajustes próprios.
        </p>
      </header>

      {!canEdit && (
        <p className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
          <Lock className="h-4 w-4" /> Somente leitura: só administradores alteram perfis.
        </p>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
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

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="font-black text-stone-900">Perfis</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-xs font-black text-white hover:bg-emerald-800"
              >
                <Plus className="h-3.5 w-3.5" /> Novo
              </button>
            )}
          </div>
          {loading && profiles.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded-xl bg-stone-100" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <p className="px-1 py-4 text-sm text-stone-500">Nenhum perfil cadastrado.</p>
          ) : (
            <ul className="space-y-1">
              {profiles.map((profile) => {
                const active = draft?.id === profile.id;
                const count = usersByProfile[profile.id] || 0;
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => void select(profile)}
                      aria-current={active}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-stone-50'
                      }`}
                    >
                      <span className="block text-sm font-bold text-stone-900">{profile.name}</span>
                      <span className="block text-xs text-stone-500">
                        {count} {count === 1 ? 'usuário' : 'usuários'} ·{' '}
                        {countEnabled(profile.permissions)} permissões
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {draft ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-black text-stone-900">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {draft.id ? draft.name || 'Perfil sem nome' : 'Novo perfil'}
                </p>
                <p className="text-sm text-stone-500">
                  {draft.id
                    ? `Usado por ${userCount} ${userCount === 1 ? 'usuário' : 'usuários'}. Ao salvar, você escolhe se quem usa o perfil sem ajustes próprios acompanha a mudança.`
                    : 'Escolha as permissões e salve.'}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  {draft.id && (
                    <>
                      <button
                        type="button"
                        onClick={duplicate}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
                      >
                        <Copy className="h-4 w-4" /> Duplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove()}
                        aria-label="Excluir perfil"
                        className="grid h-10 w-10 place-items-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !dirty}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:bg-stone-300"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {draft.id ? 'Salvar perfil' : 'Criar perfil'}
                  </button>
                </div>
              )}
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
                >
                  Nome
                </label>
                <input
                  id="profile-name"
                  value={draft.name}
                  disabled={!canEdit}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="profile-description"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
                >
                  Descrição
                </label>
                <input
                  id="profile-description"
                  value={draft.description}
                  disabled={!canEdit}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Para quem é este perfil"
                  className={fieldClass}
                />
              </div>
            </div>
            <PermissionEditor
              permissions={draft.permissions}
              onChange={(permissions) => setDraft({ ...draft, permissions })}
              disabled={!canEdit}
            />
          </section>
        ) : (
          !loading && (
            <section className="grid place-items-center rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
              {canEdit ? 'Crie o primeiro perfil com “Novo”.' : 'Nenhum perfil para mostrar.'}
            </section>
          )
        )}
      </div>
    </div>
  );
}
