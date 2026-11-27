import { describe, expect, it } from 'vitest';
import { documentoValido, formatarDocumento } from './documento';

describe('documento', () => {
  it('valida CPF e CNPJ pelos dígitos verificadores', () => {
    expect(documentoValido('123.456.789-09')).toBe(true);
    expect(documentoValido('123.456.789-00')).toBe(false);
    expect(documentoValido('111.111.111-11')).toBe(false);
    expect(documentoValido('11.222.333/0001-81')).toBe(true);
    expect(documentoValido('11.222.333/0001-80')).toBe(false);
    expect(documentoValido('123')).toBe(false);
  });

  it('formata', () => {
    expect(formatarDocumento('12345678909')).toBe('123.456.789-09');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });
});
