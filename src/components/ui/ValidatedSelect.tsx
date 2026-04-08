/**
 * FertCalc Pro — ValidatedSelect component
 *
 * Select field with inline validation feedback
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ValidatedSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'onBlur'
> {
  label?: string;
  error?: string;
  touched?: boolean;
  showError?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  containerClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  errorClassName?: string;
  options?: Array<{ value: string | number; label: string }>;
}

/**
 * Select with integrated validation feedback
 *
 * @example
 * <ValidatedSelect
 *   label="Estado"
 *   value={state}
 *   error={errors.state}
 *   touched={touched.state}
 *   onChange={(value) => setState(value)}
 *   onBlur={() => handleBlur('state', state)}
 *   options={[
 *     { value: 'SP', label: 'São Paulo' },
 *     { value: 'RJ', label: 'Rio de Janeiro' }
 *   ]}
 * />
 */
export function ValidatedSelect({
  label,
  error,
  touched = false,
  showError = true,
  onChange,
  onBlur,
  containerClassName = '',
  labelClassName = '',
  selectClassName = '',
  errorClassName = '',
  className = '',
  options = [],
  children,
  ...selectProps
}: ValidatedSelectProps) {
  const hasError = touched && error && showError;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e.target.value);
  };

  const handleBlur = () => {
    onBlur?.();
  };

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectProps.id || selectProps.name}
          className={`text-sm font-medium text-stone-700 ${labelClassName}`}
        >
          {label}
          {selectProps.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          {...selectProps}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`
            w-full px-3 py-2 border rounded-lg text-sm
            focus:outline-none focus:ring-2
            transition-colors
            appearance-none
            ${
              hasError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                : 'border-stone-300 focus:border-purple-500 focus:ring-purple-200'
            }
            ${selectProps.disabled ? 'bg-stone-100 cursor-not-allowed opacity-60' : 'bg-white'}
            ${selectClassName}
            ${className}
          `}
        >
          {children ||
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <svg
              className="w-4 h-4 text-stone-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </div>

      {hasError && (
        <p
          className={`text-xs text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200 ${errorClassName}`}
        >
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
