import { describe, expect, it } from 'vitest';
import type { Region, User } from '../../../types';
import {
  buildUserRows,
  effectivePrincipal,
  filterUserRows,
  userDraftProblem,
  userStats,
  type UserDraft,
} from '../userModel';
import {
  countEnabled,
  differencesFromProfile,
  filterPermissionGroups,
  PERMISSION_GROUPS,
  setGroup,
} from '../permissionCatalog';

const user = (over: Partial<User>): User =>
  ({
    id: 'u',
    name: 'Ana',
    email: 'ana@x.com',
    nickname: 'ana',
    role: 'user',
    ativo: true,
    permissions: {},
    ...over,
  }) as User;
const regions: Region[] = [
  { id: 'r1', name: 'Triângulo', ativo: true },
  { id: 'r2', name: 'Sul de Goiás', ativo: true },
];

describe('lista de usuários', () => {
  const rows = buildUserRows(
    [
      user({ id: 'a', name: 'Ana' }),
      user({ id: 'b', name: 'Bruno', requer_alteracao_senha: true }),
      user({ id: 'c', name: 'Carla', ativo: false }),
      user({ id: 'm', name: 'Master', role: 'master' }),
    ],
    regions,
    [
      { userId: 'a', regionId: 'r1', principal: false },
      { userId: 'a', regionId: 'r2', principal: true },
    ]
  );

  it('monta regiões, principal e situação', () => {
    const ana = rows.find((row) => row.user.id === 'a')!;
    expect(ana.regions.map((r) => r.name)).toEqual(['Sul de Goiás', 'Triângulo']);
    expect(ana.principalRegionId).toBe('r2');
    expect(rows.find((row) => row.user.id === 'b')!.status).toBe('primeiro_acesso');
  });

  it('conta sem região só para quem precisa (master/admin não)', () => {
    expect(userStats(rows)).toEqual({
      total: 4,
      active: 3,
      withoutRegion: 1,
      firstAccess: 1,
      inactive: 1,
    });
  });

  it('filtra por situação, região e busca sem acento', () => {
    const base = { search: '', role: '', regionId: '', situation: 'ativos' as const };
    expect(filterUserRows(rows, base).map((r) => r.user.id)).toEqual(['a', 'b', 'm']);
    expect(filterUserRows(rows, { ...base, regionId: 'none' }).map((r) => r.user.id)).toEqual([
      'b',
      'm',
    ]);
    expect(filterUserRows(rows, { ...base, regionId: 'r1' }).map((r) => r.user.id)).toEqual(['a']);
    expect(
      filterUserRows(rows, { ...base, search: 'goias' }, (row) =>
        row.regions.map((r) => r.name).join(' ')
      ).map((r) => r.user.id)
    ).toEqual(['a']);
  });
});

describe('validação da ficha', () => {
  const draft: UserDraft = {
    name: 'Ana',
    email: 'ana@x.com',
    nickname: 'ana',
    password: 'senha123',
    role: 'user',
    ativo: true,
    managedUserIds: [],
    filiais_permitidas: [],
    permissions: {},
    accessProfileId: '',
    regionIds: [],
    principalRegionId: '',
  };
  it('aponta a aba do problema', () => {
    expect(userDraftProblem({ ...draft, email: 'x' }, true)).toMatchObject({ tab: 'dados' });
    expect(userDraftProblem({ ...draft, password: 'curta' }, true)).toMatchObject({ tab: 'dados' });
    expect(userDraftProblem({ ...draft, password: '' }, false)).toBeNull();
    expect(userDraftProblem({ ...draft, principalRegionId: 'r9' }, false)).toMatchObject({
      tab: 'regioes',
    });
  });
  it('região única vira a principal', () => {
    expect(effectivePrincipal(['r1'], '')).toBe('r1');
    expect(effectivePrincipal(['r1', 'r2'], '')).toBe('');
    expect(effectivePrincipal(['r1', 'r2'], 'r2')).toBe('r2');
  });
});

describe('catálogo de permissões', () => {
  it('não repete ids', () => {
    const ids = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('compara com o perfil e conta', () => {
    expect(differencesFromProfile({ calculator: true, goals: true }, { calculator: true })).toEqual(
      ['goals']
    );
    expect(countEnabled({ calculator: true, creditCard: 'admin', inexistente: true })).toBe(1);
  });
  it('busca sem acento e marca grupo inteiro', () => {
    const found = filterPermissionGroups('cotacao');
    expect(found.flatMap((g) => g.items.map((i) => i.id))).toContain(
      'carregamento_solicitar_cotacao'
    );
    const group = PERMISSION_GROUPS.find((g) => g.id === 'aprovacoes')!;
    expect(setGroup({}, group, true)).toEqual({ approvals: true, approvals_canApprove: true });
  });
});
