import { describe, expect, it } from 'vitest';
import { assertDeleted, DeleteBlockedError, toDeleteError } from './deleteErrors';

describe('erros de exclusão', () => {
  it('identifica dados ligados e diz quais são', () => {
    const error = toDeleteError({
      code: '23503',
      message: 'update or delete on table "branches" violates foreign key constraint',
      details: 'Key (id, organization_id)=(1, 2) is still referenced from table "price_lists".',
    });
    expect(error).toBeInstanceOf(DeleteBlockedError);
    expect((error as DeleteBlockedError).reason).toBe('linked');
    expect((error as DeleteBlockedError).linkedTo).toBe('listas de preço');
  });

  it('acusa falta de permissão quando nada foi excluído', () => {
    expect(() => assertDeleted([])).toThrow(DeleteBlockedError);
    expect(() => assertDeleted(null)).toThrow('permissão');
    expect(() => assertDeleted([{ id: '1' }])).not.toThrow();
  });

  it('mantém outros erros como estão', () => {
    const error = toDeleteError({ code: '42501', message: 'falha' });
    expect(error).not.toBeInstanceOf(DeleteBlockedError);
    expect(error.message).toBe('falha');
  });
});
