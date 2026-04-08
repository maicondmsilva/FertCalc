/**
 * FertCalc Pro — useFormValidation tests
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation, validationRules, ValidationSchema } from '../hooks/useFormValidation';

describe('useFormValidation', () => {
  const schema: ValidationSchema = {
    name: {
      required: true,
      rules: [validationRules.minLength(3)],
    },
    email: {
      required: false,
      rules: [validationRules.email()],
    },
    age: {
      required: true,
      rules: [validationRules.positiveNumber()],
    },
  };

  it('should initialize with empty errors and touched', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('should validate required field', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.handleBlur('name', '');
    });

    expect(result.current.hasError('name')).toBe(true);
    expect(result.current.errors.name).toBe('Campo obrigatório');
  });

  it('should validate minLength rule', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.handleBlur('name', 'ab');
    });

    expect(result.current.hasError('name')).toBe(true);
    expect(result.current.errors.name).toBe('Deve ter pelo menos 3 caracteres');
  });

  it('should validate email format', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.handleBlur('email', 'invalid-email');
    });

    expect(result.current.hasError('email')).toBe(true);
    expect(result.current.errors.email).toBe('Email inválido');
  });

  it('should pass valid email', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.handleBlur('email', 'test@example.com');
    });

    expect(result.current.hasError('email')).toBe(false);
  });

  it('should validate all fields', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    let isValid: boolean = false;

    act(() => {
      isValid = result.current.validateAll({
        name: '',
        email: 'invalid',
        age: -1,
      });
    });

    expect(isValid).toBe(false);
    expect(result.current.errors.name).toBe('Campo obrigatório');
    expect(result.current.errors.email).toBe('Email inválido');
    expect(result.current.errors.age).toBe('Deve ser um número positivo');
  });

  it('should pass validateAll with valid data', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    let isValid: boolean = false;

    act(() => {
      isValid = result.current.validateAll({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      });
    });

    expect(isValid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('should only validate touched fields on change', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    // Initially field is not touched
    act(() => {
      result.current.handleChange('name', '');
    });

    // hasError returns false when field is not touched (even if invalid)
    expect(result.current.touched.name).toBeUndefined();
    expect(result.current.hasError('name')).toBe(false);

    // After blur, field is touched
    act(() => {
      result.current.handleBlur('name', '');
    });

    expect(result.current.touched.name).toBe(true);
    expect(result.current.hasError('name')).toBe(true);

    // Now change should validate
    act(() => {
      result.current.handleChange('name', 'John');
    });

    expect(result.current.hasError('name')).toBe(false);
  });

  it('should clear error for a field', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.handleBlur('name', '');
    });

    expect(result.current.hasError('name')).toBe(true);

    act(() => {
      result.current.clearError('name');
    });

    expect(result.current.hasError('name')).toBe(false);
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useFormValidation(schema));

    act(() => {
      result.current.validateAll({
        name: '',
        email: 'invalid',
        age: 0,
      });
    });

    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });
});

describe('validationRules', () => {
  it('should validate phone format', () => {
    const rule = validationRules.phone();

    expect(rule.validate('(11) 98765-4321')).toBe(true);
    expect(rule.validate('11987654321')).toBe(true);
    expect(rule.validate('invalid')).toBe(false);
  });

  it('should validate CNPJ format', () => {
    const rule = validationRules.cnpj();

    expect(rule.validate('12.345.678/0001-90')).toBe(true);
    expect(rule.validate('12345678000190')).toBe(true);
    expect(rule.validate('123')).toBe(false);
  });

  it('should validate CPF format', () => {
    const rule = validationRules.cpf();

    expect(rule.validate('123.456.789-00')).toBe(true);
    expect(rule.validate('12345678900')).toBe(true);
    expect(rule.validate('123')).toBe(false);
  });

  it('should validate inRange', () => {
    const rule = validationRules.inRange(1, 10);

    expect(rule.validate(5)).toBe(true);
    expect(rule.validate(1)).toBe(true);
    expect(rule.validate(10)).toBe(true);
    expect(rule.validate(0)).toBe(false);
    expect(rule.validate(11)).toBe(false);
  });

  it('should validate URL', () => {
    const rule = validationRules.url();

    expect(rule.validate('https://example.com')).toBe(true);
    expect(rule.validate('http://localhost:3000')).toBe(true);
    expect(rule.validate('invalid-url')).toBe(false);
  });
});
