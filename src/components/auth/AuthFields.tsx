import React, { useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { passwordChecks, passwordStrength, STRENGTH_LABEL } from './passwordRules';

export const authInputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-[15px] text-stone-900 placeholder:text-stone-400 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:bg-stone-100';

export function AuthAlert({
  kind,
  children,
}: {
  kind: 'error' | 'success';
  children: React.ReactNode;
}) {
  const error = kind === 'error';
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        error
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function AuthField({
  label,
  action,
  hint,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold text-stone-700">
          {label}
        </label>
        {action}
      </div>
      {children(id)}
      {hint && <div className="mt-1.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

/** Campo de senha com mostrar/ocultar e aviso de Caps Lock ligado. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (event: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(Boolean(event.getModifierState?.('CapsLock')));
  return (
    <>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          className={`${authInputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" />
          ) : (
            <Eye className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
      {capsLock && (
        <p className="mt-1.5 text-xs font-semibold text-amber-700" role="status">
          Caps Lock está ligado.
        </p>
      )}
    </>
  );
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  tone = 'emerald',
  disabled,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
  tone?: 'emerald' | 'amber';
  disabled?: boolean;
}) {
  const color =
    tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25 focus-visible:ring-amber-500/30'
      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 focus-visible:ring-emerald-500/30';
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      aria-busy={loading}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-black text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </button>
  );
}

/** Nova senha + confirmação, com lista de requisitos e barra de força. */
export function NewPasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  disabled,
}: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  disabled?: boolean;
}) {
  const strength = passwordStrength(password);
  const bar = ['bg-stone-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'][
    strength
  ];
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return (
    <div className="space-y-4">
      <AuthField
        label="Nova senha"
        hint={
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-full flex-1 rounded-full ${step <= strength ? bar : 'bg-stone-200'}`}
                  />
                ))}
              </div>
              <span className="w-16 text-right font-bold text-stone-600">
                {STRENGTH_LABEL[strength]}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-3" aria-label="Requisitos da senha">
              {passwordChecks(password).map((check) => (
                <li
                  key={check.id}
                  className={`flex items-center gap-1.5 ${check.ok ? 'text-emerald-700' : 'text-stone-500'}`}
                >
                  {check.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        {(id) => (
          <PasswordInput
            id={id}
            value={password}
            onChange={onPasswordChange}
            autoComplete="new-password"
            disabled={disabled}
          />
        )}
      </AuthField>
      <AuthField
        label="Confirme a nova senha"
        hint={
          mismatch ? (
            <span className="font-semibold text-red-600">As senhas não coincidem.</span>
          ) : undefined
        }
      >
        {(id) => (
          <PasswordInput
            id={id}
            value={confirmation}
            onChange={onConfirmationChange}
            autoComplete="new-password"
            disabled={disabled}
          />
        )}
      </AuthField>
    </div>
  );
}
