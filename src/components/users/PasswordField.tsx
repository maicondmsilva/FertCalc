import React, { useState } from 'react';
import { Check, CheckCircle2, Circle, Copy, Eye, EyeOff } from 'lucide-react';
import { passwordChecks, passwordStrength, STRENGTH_LABEL } from '../auth/passwordRules';

export const fieldClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-stone-100 disabled:text-stone-500';

/** Senha com mostrar/ocultar, copiar e requisitos (tema claro, telas internas). */
export default function PasswordField({
  id,
  value,
  onChange,
  showRules = true,
  allowCopy = false,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  showRules?: boolean;
  allowCopy?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const strength = passwordStrength(value);
  const bar = ['bg-stone-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'][
    strength
  ];
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          placeholder={placeholder}
          className={`${fieldClass} ${allowCopy ? 'pr-20' : 'pr-11'}`}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          {allowCopy && value && (
            <button
              type="button"
              onClick={copy}
              aria-label="Copiar senha"
              className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-emerald-700"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {showRules && (
        <div className="mt-2 space-y-1.5 text-xs">
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
          <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Requisitos da senha">
            {passwordChecks(value).map((check) => (
              <li
                key={check.id}
                className={`flex items-center gap-1 ${check.ok ? 'text-emerald-700' : 'text-stone-500'}`}
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
      )}
    </div>
  );
}
