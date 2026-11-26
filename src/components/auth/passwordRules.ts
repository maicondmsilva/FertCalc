/** Regras da nova senha (primeiro acesso e redefinição). */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordCheck {
  id: 'length' | 'letter' | 'number';
  label: string;
  ok: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    {
      id: 'length',
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: 'letter', label: 'Uma letra', ok: /\p{L}/u.test(password) },
    { id: 'number', label: 'Um número', ok: /\d/.test(password) },
  ];
}

/** 0 a 4: só para a barra de força; a regra mínima é passwordChecks. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = passwordChecks(password).filter((check) => check.ok).length;
  if (password.length >= 12) score += 1;
  if (/[^\p{L}\d]/u.test(password) || (/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)))
    score += 1;
  return Math.min(4, Math.max(1, score - 1)) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABEL = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const;

/** Problema da nova senha, ou null. */
export function newPasswordProblem(
  password: string,
  confirmation: string,
  previous?: string
): string | null {
  const failed = passwordChecks(password).find((check) => !check.ok);
  if (failed) return `A senha precisa ter: ${failed.label.toLowerCase()}.`;
  if (previous && password === previous) return 'A nova senha precisa ser diferente da atual.';
  if (password !== confirmation) return 'As senhas não coincidem.';
  return null;
}

/** Validação dos campos do login antes de chamar o servidor. */
export function loginProblem(identifier: string, password: string): string | null {
  if (!identifier.trim()) return 'Informe seu e-mail ou usuário.';
  if (!password) return 'Informe sua senha.';
  return null;
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
