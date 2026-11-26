import React, { useState } from 'react';
import { KeyRound, Loader2, X } from 'lucide-react';
import type { User } from '../../types';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { newPasswordProblem } from '../auth/passwordRules';
import PasswordField from './PasswordField';

/** Redefinir a senha de outro usuário (ele troca no próximo acesso). */
export default function ResetPasswordModal({
  user,
  saving,
  onSave,
  onClose,
}: {
  user: User;
  saving: boolean;
  onSave: (password: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const mismatch = confirmation.length > 0 && confirmation !== password;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = newPasswordProblem(password, confirmation);
    if (found) {
      setProblem(found);
      return;
    }
    onSave(password);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`Redefinir senha de ${user.name}`}
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <p className="font-black text-stone-900">Redefinir senha</p>
              <p className="text-xs text-stone-500">
                {user.name} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            O usuário entra com esta senha e é obrigado a criar uma nova no próximo acesso.
          </p>
          {problem && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {problem}
            </p>
          )}
          <div>
            <label
              htmlFor="reset-password"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
            >
              Nova senha
            </label>
            <PasswordField id="reset-password" value={password} onChange={setPassword} allowCopy />
          </div>
          <div>
            <label
              htmlFor="reset-password-confirm"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500"
            >
              Confirme a nova senha
            </label>
            <PasswordField
              id="reset-password-confirm"
              value={confirmation}
              onChange={setConfirmation}
              showRules={false}
            />
            {mismatch && (
              <p className="mt-1 text-xs font-semibold text-red-600">As senhas não coincidem.</p>
            )}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl px-4 text-sm font-bold text-stone-600 hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white hover:bg-amber-700 disabled:bg-stone-300"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Redefinir senha'}
          </button>
        </footer>
      </form>
    </div>
  );
}
