import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  loginProblem,
  newPasswordProblem,
  passwordChecks,
  passwordStrength,
} from '../passwordRules';

describe('passwordRules', () => {
  it('regras mínimas: 8 caracteres, letra e número', () => {
    expect(passwordChecks('abc').map((check) => check.ok)).toEqual([false, true, false]);
    expect(passwordChecks('senha123').every((check) => check.ok)).toBe(true);
    expect(passwordChecks('çãoéíóú9').every((check) => check.ok)).toBe(true);
  });

  it('problema da nova senha', () => {
    expect(newPasswordProblem('abc', 'abc')).toMatch(/8 caracteres/);
    expect(newPasswordProblem('abcdefgh', 'abcdefgh')).toMatch(/um número/);
    expect(newPasswordProblem('12345678', '12345678')).toMatch(/uma letra/);
    expect(newPasswordProblem('senha123', 'senha124')).toMatch(/não coincidem/);
    expect(newPasswordProblem('senha123', 'senha123', 'senha123')).toMatch(/diferente/);
    expect(newPasswordProblem('senha123', 'senha123')).toBeNull();
  });

  it('força cresce com tamanho e variedade', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('senha123')).toBe(2);
    expect(passwordStrength('Senha123')).toBe(3);
    expect(passwordStrength('Senha-Muito-Longa-123')).toBe(4);
  });

  it('login e e-mail', () => {
    expect(loginProblem(' ', 'x')).toMatch(/e-mail ou usuário/);
    expect(loginProblem('ana', '')).toMatch(/senha/);
    expect(loginProblem('ana', 'x')).toBeNull();
    expect(isValidEmail('ana@empresa.com')).toBe(true);
    expect(isValidEmail('ana@empresa')).toBe(false);
  });
});
