import { describe, expect, it } from 'vitest';
import type { PricingRecord, User } from '../../types';
import { filterPricingQueue, summarizeApprovals } from './approvalsModel';

const gerente = { id: 'g1', role: 'manager', permissions: {} } as unknown as User;
const pricing = (id: string, userId: string, client: string, formula: string) =>
  ({
    id,
    userId,
    userName: userId === 'g1' ? 'Gerente' : 'João Vendedor',
    formattedCod: `PRC-${id}`,
    factors: { client: { name: client } },
    calculations: [{ formula }],
  }) as unknown as PricingRecord;

const fila = [
  pricing('1', 'v1', 'Fazenda São José', '04-14-08'),
  pricing('2', 'g1', 'Agro Boa Vista', '20-00-20'),
];

describe('fila de aprovações', () => {
  it('busca por cliente sem acento, vendedor, código ou fórmula', () => {
    const ids = (search: string) =>
      filterPricingQueue(fila, gerente, { search, onlyDecidable: false }).map((p) => p.id);
    expect(ids('sao jose')).toEqual(['1']);
    expect(ids('joão')).toEqual(['1']);
    expect(ids('20-00-20')).toEqual(['2']);
    expect(ids('PRC-2')).toEqual(['2']);
    expect(ids('')).toEqual(['1', '2']);
  });

  it('"só as que eu posso decidir" tira a própria precificação do gerente', () => {
    expect(
      filterPricingQueue(fila, gerente, { search: '', onlyDecidable: true }).map((p) => p.id)
    ).toEqual(['1']);
  });

  it('resumo conta o que o usuário pode decidir', () => {
    expect(
      summarizeApprovals({
        pendingPricings: fila,
        pendingDeletions: [fila[0]],
        goals: 2,
        guarantees: 0,
        user: gerente,
      })
    ).toEqual({ pricings: 2, decidable: 1, deletions: 1, goals: 2, guarantees: 0 });
  });
});
