/**
 * FertCalc Pro — ValidatedInput component
 *
 * Input field with inline validation feedback
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ValidatedInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'onBlur'
> {
  label?: React.ReactNode;
  error?: string;
  touched?: boolean;
  showError?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
}

/**
 * Input with integrated validation feedback
 *
 * @example
 * <ValidatedInput
 *   label="Nome"
 *   value={name}
 *   error={errors.name}
 *   touched={touched.name}
 *   onChange={(value) => setName(value)}
 *   onBlur={() => handleBlur('name', name)}
 * />
 */
export function ValidatedInput({
  label,
  error,
  touched = false,
  showError = true,
  onChange,
  onBlur,
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  errorClassName = '',
  className = '',
  ...inputProps
}: ValidatedInputProps) {
  const hasError = touched && error && showError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  const handleBlur = () => {
    onBlur?.();
  };

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputProps.id || inputProps.name}
          className={`text-sm font-medium text-stone-700 ${labelClassName}`}
        >
          {label}
          {inputProps.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          {...inputProps}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`
            w-full px-3 py-2 border rounded-lg text-sm
            focus:outline-none focus:ring-2
            transition-colors
            ${
              hasError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                : 'border-stone-300 focus:border-purple-500 focus:ring-purple-200'
            }
            ${inputProps.disabled ? 'bg-stone-100 cursor-not-allowed opacity-60' : 'bg-white'}
            ${inputClassName}
            ${className}
          `}
        />

        {hasError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
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
