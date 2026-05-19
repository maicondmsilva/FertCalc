import { describe, expect, it } from 'vitest';
import { getStatusInicial } from './getStatusInicial';

describe('getStatusInicial', () => {
  it('retorna aguardando_cotacao para CIF', () => {
    expect(getStatusInicial('CIF')).toBe('aguardando_cotacao');
  });

  it('retorna aguardando_liberacao para FOB', () => {
    expect(getStatusInicial('FOB')).toBe('aguardando_liberacao');
  });
});
