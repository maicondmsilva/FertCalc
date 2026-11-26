import type { Region, User } from '../../types';

export interface RegionRow extends Region {
  users: Pick<User, 'id' | 'name'>[];
}

const normalize = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Junta regiões, vínculos e usuários; ordena ativas primeiro e por nome. */
export function buildRegionRows(
  regions: Region[],
  links: { userId: string; regionId: string }[],
  users: Pick<User, 'id' | 'name'>[]
): RegionRow[] {
  const userById = new Map(users.map((user) => [user.id, user]));
  return regions
    .map((region) => ({
      ...region,
      users: links
        .filter((link) => link.regionId === region.id)
        .map((link) => userById.get(link.userId))
        .filter((user): user is Pick<User, 'id' | 'name'> => Boolean(user))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }))
    .sort((a, b) =>
      a.ativo === b.ativo ? a.name.localeCompare(b.name, 'pt-BR') : a.ativo ? -1 : 1
    );
}

export const matchesRegionSearch = (row: RegionRow, term: string) => {
  const text = normalize(term);
  if (!text) return true;
  return [row.name, row.code, ...row.users.map((user) => user.name)].some((value) =>
    normalize(value).includes(text)
  );
};

export function regionStats(rows: RegionRow[], users: Pick<User, 'id' | 'ativo'>[]) {
  const linked = new Set(rows.flatMap((row) => row.users.map((user) => user.id)));
  const activeUsers = users.filter((user) => user.ativo !== false);
  return {
    activeRegions: rows.filter((row) => row.ativo).length,
    usersWithRegion: activeUsers.filter((user) => linked.has(user.id)).length,
    usersWithoutRegion: activeUsers.filter((user) => !linked.has(user.id)).length,
  };
}

/** Problema do formulário, ou null. */
export function regionProblem(
  draft: { name: string; code: string },
  rows: RegionRow[],
  editingId?: string
): string | null {
  const name = draft.name.trim();
  if (name.length < 2) return 'Informe o nome da região.';
  if (name.length > 80) return 'Nome muito longo (máximo 80).';
  if (draft.code.trim().length > 20) return 'Código muito longo (máximo 20).';
  const others = rows.filter((row) => row.id !== editingId);
  if (others.some((row) => normalize(row.name) === normalize(name)))
    return 'Já existe uma região com esse nome.';
  const code = draft.code.trim().toUpperCase();
  if (code && others.some((row) => (row.code || '').toUpperCase() === code))
    return 'Já existe uma região com esse código.';
  return null;
}
