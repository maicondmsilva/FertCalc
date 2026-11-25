import type { Address, User } from '../../types';

export const onlyDigits = (value?: string | null) => String(value ?? '').replace(/\D/g, '');

function validCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

function validCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Problema do CPF/CNPJ, ou null. Vazio só é problema quando obrigatório. */
export function documentProblem(value: string | undefined, required: boolean): string | null {
  const digits = onlyDigits(value);
  if (!digits) return required ? 'Informe o CPF ou CNPJ.' : null;
  if (digits.length === 11) return validCpf(digits) ? null : 'CPF inválido (confira os dígitos).';
  if (digits.length === 14) return validCnpj(digits) ? null : 'CNPJ inválido (confira os dígitos).';
  return 'CPF tem 11 dígitos e CNPJ tem 14.';
}

export const documentKind = (value?: string | null) => {
  const length = onlyDigits(value).length;
  return length === 11 ? 'CPF' : length === 14 ? 'CNPJ' : null;
};

export const emailProblem = (value?: string) =>
  value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? 'E-mail inválido.' : null;

export const phoneProblem = (value?: string) =>
  value && onlyDigits(value).length < 10 ? 'Telefone precisa de DDD e número.' : null;

const normalize = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Busca por nome, fazenda, cidade, código ou documento (com ou sem pontuação).
 * Não quebra com campos vazios (antes a busca de agentes travava a tela quando
 * algum cadastro não tinha documento).
 */
export function matchesRegistrySearch(
  item: {
    name?: string | null;
    code?: string | null;
    document?: string | null;
    fazenda?: string | null;
    email?: string | null;
    address?: Partial<Address> | null;
  },
  term: string
): boolean {
  const text = normalize(term).trim();
  if (!text) return true;
  const digits = onlyDigits(term);
  const haystack = [item.name, item.fazenda, item.email, item.address?.city, item.code]
    .map(normalize)
    .join(' ');
  if (haystack.includes(text)) return true;
  return digits.length >= 3 && onlyDigits(item.document).includes(digits);
}

/**
 * Outro cadastro com o mesmo documento. Para clientes, o mesmo CPF pode ter
 * várias inscrições estaduais (uma por fazenda): só é duplicado se a IE também
 * for igual.
 */
export function findDuplicate<
  T extends {
    id: string;
    name: string;
    document?: string | null;
    stateRegistration?: string | null;
  },
>(
  list: T[],
  draft: { document?: string; stateRegistration?: string },
  excludeId?: string,
  compareIe = false
): T | null {
  const digits = onlyDigits(draft.document);
  if (!digits) return null;
  const ie = onlyDigits(draft.stateRegistration);
  return (
    list.find(
      (item) =>
        item.id !== excludeId &&
        onlyDigits(item.document) === digits &&
        (!compareIe || onlyDigits(item.stateRegistration) === ie)
    ) || null
  );
}

export const emptyAddress = (): Address => ({
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
});

export function formatAddress(address?: Partial<Address> | null): string | null {
  if (!address) return null;
  const street = [address.street, address.number || (address.street ? 'S/N' : '')]
    .filter(Boolean)
    .join(', ');
  const place = [address.neighborhood, [address.city, address.state].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' · ');
  const line = [street, place, address.cep ? `CEP ${address.cep}` : ''].filter(Boolean).join(' — ');
  return line || null;
}

export const isAddressFilled = (address?: Partial<Address> | null) =>
  Boolean(address && (address.street || address.city || address.cep));

export type RegistryKind = 'clients' | 'agents';

export interface RegistryPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/** Mesma regra do banco: gestor cria/edita, admin exclui, ou a permissão concedida. */
export function registryPermissions(
  user: Pick<User, 'role' | 'permissions'>,
  kind: RegistryKind
): RegistryPermissions {
  const level =
    user.role === 'master' ? 100 : user.role === 'admin' ? 80 : user.role === 'manager' ? 60 : 0;
  const permissions = (user.permissions || {}) as Record<string, unknown>;
  return {
    canCreate: level >= 60 || permissions[`${kind}_create`] === true,
    canEdit: level >= 60 || permissions[`${kind}_edit`] === true,
    canDelete: level >= 80 || permissions[`${kind}_delete`] === true,
  };
}
