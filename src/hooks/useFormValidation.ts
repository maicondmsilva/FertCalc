/**
 * FertCalc Pro — useFormValidation hook
 *
 * Hook reutilizável para validação inline de formulários
 */

import { useState, useCallback } from 'react';

export type ValidationRule<T = any> = {
  validate: (value: T) => boolean;
  message: string;
};

export type FieldValidation = {
  rules: ValidationRule[];
  required?: boolean;
};

export type ValidationSchema = Record<string, FieldValidation>;

export type ValidationErrors = Record<string, string>;

/**
 * Hook para validação de formulários com feedback inline
 *
 * @example
 * const schema: ValidationSchema = {
 *   name: {
 *     required: true,
 *     rules: [
 *       { validate: (v) => v.length >= 3, message: 'Nome deve ter pelo menos 3 caracteres' }
 *     ]
 *   },
 *   email: {
 *     required: true,
 *     rules: [
 *       { validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email inválido' }
 *     ]
 *   }
 * };
 *
 * const { errors, validateField, validateAll, clearError } = useFormValidation(schema);
 */
export function useFormValidation(schema: ValidationSchema) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (fieldName: string, value: any): string | null => {
      const fieldSchema = schema[fieldName];
      if (!fieldSchema) return null;

      // Check required
      if (fieldSchema.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return 'Campo obrigatório';
      }

      // Run validation rules
      for (const rule of fieldSchema.rules) {
        if (!rule.validate(value)) {
          return rule.message;
        }
      }

      return null;
    },
    [schema]
  );

  const setFieldError = useCallback((fieldName: string, error: string | null) => {
    setErrors((prev) => {
      if (error === null) {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fieldName]: error };
    });
  }, []);

  const setFieldTouched = useCallback((fieldName: string, isTouched: boolean = true) => {
    setTouched((prev) => ({ ...prev, [fieldName]: isTouched }));
  }, []);

  const handleBlur = useCallback(
    (fieldName: string, value: any) => {
      setFieldTouched(fieldName, true);
      const error = validateField(fieldName, value);
      setFieldError(fieldName, error);
    },
    [validateField, setFieldError, setFieldTouched]
  );

  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      // Only validate if field was already touched
      if (touched[fieldName]) {
        const error = validateField(fieldName, value);
        setFieldError(fieldName, error);
      }
    },
    [touched, validateField, setFieldError]
  );

  const validateAll = useCallback(
    (values: Record<string, any>): boolean => {
      const newErrors: ValidationErrors = {};
      const newTouched: Record<string, boolean> = {};

      Object.keys(schema).forEach((fieldName) => {
        newTouched[fieldName] = true;
        const error = validateField(fieldName, values[fieldName]);
        if (error) {
          newErrors[fieldName] = error;
        }
      });

      setTouched(newTouched);
      setErrors(newErrors);

      return Object.keys(newErrors).length === 0;
    },
    [schema, validateField]
  );

  const clearError = useCallback(
    (fieldName: string) => {
      setFieldError(fieldName, null);
    },
    [setFieldError]
  );

  const clearAllErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const hasError = useCallback(
    (fieldName: string): boolean => {
      return Boolean(touched[fieldName] && errors[fieldName]);
    },
    [touched, errors]
  );

  return {
    errors,
    touched,
    hasError,
    validateField,
    validateAll,
    clearError,
    clearAllErrors,
    handleBlur,
    handleChange,
    setFieldTouched,
  };
}

// Common validation rules
export const validationRules = {
  minLength: (min: number): ValidationRule => ({
    validate: (value: string) => value.length >= min,
    message: `Deve ter pelo menos ${min} caracteres`,
  }),

  maxLength: (max: number): ValidationRule => ({
    validate: (value: string) => value.length <= max,
    message: `Deve ter no máximo ${max} caracteres`,
  }),

  email: (): ValidationRule => ({
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Email inválido',
  }),

  phone: (): ValidationRule => ({
    validate: (value: string) => /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(value),
    message: 'Telefone inválido (formato: (00) 00000-0000)',
  }),

  cnpj: (): ValidationRule => ({
    validate: (value: string) => {
      const cleanValue = value.replace(/\D/g, '');
      return cleanValue.length === 14;
    },
    message: 'CNPJ deve ter 14 dígitos',
  }),

  cpf: (): ValidationRule => ({
    validate: (value: string) => {
      const cleanValue = value.replace(/\D/g, '');
      return cleanValue.length === 11;
    },
    message: 'CPF deve ter 11 dígitos',
  }),

  positiveNumber: (): ValidationRule => ({
    validate: (value: number) => value > 0,
    message: 'Deve ser um número positivo',
  }),

  nonNegativeNumber: (): ValidationRule => ({
    validate: (value: number) => value >= 0,
    message: 'Não pode ser negativo',
  }),

  inRange: (min: number, max: number): ValidationRule => ({
    validate: (value: number) => value >= min && value <= max,
    message: `Deve estar entre ${min} e ${max}`,
  }),

  url: (): ValidationRule => ({
    validate: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'URL inválida',
  }),

  noWhitespace: (): ValidationRule => ({
    validate: (value: string) => !/\s/.test(value),
    message: 'Não pode conter espaços',
  }),

  alphanumeric: (): ValidationRule => ({
    validate: (value: string) => /^[a-zA-Z0-9]+$/.test(value),
    message: 'Apenas letras e números',
  }),
};
