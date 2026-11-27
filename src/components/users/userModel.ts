import type { Region, User } from '../../types';
import { passwordChecks } from '../auth/passwordRules';

export const CRUD_RESOURCES = ['clients', 'agents', 'priceLists', 'branches', 'macro', 'micro'];

/** Permissões iniciais quando o nível não traz um padrão cadastrado. */
export function fallbackPermissionsForRole(role: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    dashboard: true,
    calculator: true,
    simplified_calculator: true,
    simplified_calculator_beta: false,
    history: true,
    pedidosVenda: true,
    pedidosVenda_create: true,
    pedidosVenda_edit: true,
    pedidosVenda_cancel: true,
    clients: true,
    agents: true,
    goals: false,
    priceLists: true,
    branches: false,
    users: false,
    settings: false,
    approvals: false,
    savedFormulas: true,
    propostas: true,
    propostas_criar: true,
    propostas_editar: true,
    produtosFormulados: false,
    reports: true,
    pricingReport: true,
    commissionReport: true,
    pricingBySeller: false,
    managementReports: false,
    calculator_profitabilityCheck: false,
    calculator_extraProducts: false,
    calculator_overrideGuaranteeDivergence: false,
  };
  const allCrud = () =>
    Object.fromEntries(
      CRUD_RESOURCES.flatMap((resource) => [
        [resource, true],
        [`${resource}_create`, true],
        [`${resource}_edit`, true],
        [`${resource}_delete`, true],
      ])
    );
  if (role === 'master' || role === 'admin') {
    const all: Record<string, unknown> = {
      approvals_canApprove: true,
      calculator_profitabilityCheck: true,
      calculator_extraProducts: true,
      calculator_overrideGuaranteeDivergence: true,
      ...allCrud(),
    };
    Object.keys(base).forEach((key) => {
      all[key] = true;
    });
    return { ...all, creditCard: 'admin' };
  }
  if (role === 'manager') {
    return {
      ...base,
      approvals: true,
      approvals_canApprove: true,
      pricingBySeller: true,
      goals: true,
      goals_create: true,
      goals_edit: true,
      goals_delete: true,
      transportadoras_create: true,
      transportadoras_edit: true,
      calculator_profitabilityCheck: true,
      calculator_overrideGuaranteeDivergence: true,
      creditCard: 'approver',
      ...allCrud(),
    };
  }
  return { ...base, creditCard: 'none' };
}

export interface UserRegionLink {
  userId: string;
  regionId: string;
  principal: boolean;
}

export type UserStatus = 'ativo' | 'inativo' | 'primeiro_acesso';

export interface UserRow {
  user: User;
  regions: Region[];
  principalRegionId: string | null;
  status: UserStatus;
}

export const userStatus = (user: User): UserStatus =>
  !user.ativo ? 'inativo' : user.requer_alteracao_senha ? 'primeiro_acesso' : 'ativo';

/** Master e admin enxergam tudo: não precisam de região para trabalhar. */
export const needsRegion = (user: User) => user.role !== 'master' && user.role !== 'admin';

export function buildUserRows(
  users: User[],
  regions: Region[],
  links: UserRegionLink[]
): UserRow[] {
  const regionById = new Map(regions.map((region) => [region.id, region]));
  return users.map((user) => {
    const own = links.filter((link) => link.userId === user.id);
    return {
      user,
      regions: own
        .map((link) => regionById.get(link.regionId))
        .filter((region): region is Region => Boolean(region))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
      principalRegionId: own.find((link) => link.principal)?.regionId ?? null,
      status: userStatus(user),
    };
  });
}

export function userStats(rows: UserRow[]) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.user.ativo).length,
    withoutRegion: rows.filter(
      (row) => row.user.ativo && needsRegion(row.user) && row.regions.length === 0
    ).length,
    firstAccess: rows.filter((row) => row.status === 'primeiro_acesso').length,
    inactive: rows.filter((row) => !row.user.ativo).length,
  };
}

export interface UserFilters {
  search: string;
  role: string;
  regionId: string; // '' = todas, 'none' = sem região
  situation: 'ativos' | 'inativos' | 'todos';
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterUserRows(
  rows: UserRow[],
  filters: UserFilters,
  extraText: (row: UserRow) => string = () => ''
): UserRow[] {
  const term = normalize(filters.search.trim());
  return rows
    .filter((row) =>
      filters.situation === 'todos'
        ? true
        : filters.situation === 'ativos'
          ? row.user.ativo
          : !row.user.ativo
    )
    .filter((row) => !filters.role || row.user.role === filters.role)
    .filter((row) =>
      !filters.regionId
        ? true
        : filters.regionId === 'none'
          ? row.regions.length === 0
          : row.regions.some((region) => region.id === filters.regionId)
    )
    .filter((row) => {
      if (!term) return true;
      const haystack = normalize(
        [row.user.name, row.user.email, row.user.nickname || '', extraText(row)].join(' ')
      );
      return haystack.includes(term);
    })
    .sort((left, right) => left.user.name.localeCompare(right.user.name, 'pt-BR'));
}

export interface UserDraft {
  name: string;
  email: string;
  nickname: string;
  password: string;
  role: string;
  ativo: boolean;
  managedUserIds: string[];
  filiais_permitidas: string[];
  permissions: Record<string, unknown>;
  accessProfileId: string;
  regionIds: string[];
  principalRegionId: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Primeiro problema que impede salvar, com a aba onde ele está. */
export function userDraftProblem(
  draft: UserDraft,
  isNew: boolean
): { tab: 'dados' | 'acesso' | 'regioes'; message: string } | null {
  if (!draft.name.trim()) return { tab: 'dados', message: 'Informe o nome.' };
  if (!EMAIL.test(draft.email.trim().toLowerCase()))
    return { tab: 'dados', message: 'Informe um e-mail válido.' };
  if (!draft.nickname.trim())
    return { tab: 'dados', message: 'Informe o apelido usado para entrar.' };
  if (isNew) {
    const failed = passwordChecks(draft.password).find((check) => !check.ok);
    if (failed)
      return {
        tab: 'dados',
        message: `A senha inicial precisa ter: ${failed.label.toLowerCase()}.`,
      };
  }
  if (!draft.role) return { tab: 'acesso', message: 'Escolha o nível de acesso.' };
  if (draft.principalRegionId && !draft.regionIds.includes(draft.principalRegionId))
    return { tab: 'regioes', message: 'A região principal precisa estar marcada.' };
  return null;
}

/** Região principal efetiva: a escolhida, ou a única marcada. */
export function effectivePrincipal(regionIds: string[], principal: string): string {
  if (principal && regionIds.includes(principal)) return principal;
  return regionIds.length === 1 ? regionIds[0] : '';
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
