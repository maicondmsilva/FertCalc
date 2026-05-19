import { describe, expect, it } from 'vitest';
import { getStatusInicial } from './getStatusInicial';

describe('getStatusInicial', () => {
  it('retorna aguardando_liberacao para CIF', () => {
    expect(getStatusInicial('CIF')).toBe('aguardando_liberacao');
  });

  it('retorna aguardando_liberacao para FOB', () => {
    expect(getStatusInicial('FOB')).toBe('aguardando_liberacao');
  });
});
