import { describe, it, expect } from 'vitest';
import {
  formatDocument,
  formatPhone,
  formatCEP,
  formatGuarantee,
  formatNPK,
  truncateGuarantee,
} from './formatters';

describe('formatDocument', () => {
  it('formata CPF corretamente', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01');
  });

  it('formata CNPJ corretamente', () => {
    expect(formatDocument('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('ignora caracteres não numéricos antes de formatar', () => {
    expect(formatDocument('123.456.789-01')).toBe('123.456.789-01');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(formatDocument('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('formata telefone fixo (10 dígitos)', () => {
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
  });

  it('formata celular (11 dígitos)', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('ignora caracteres não numéricos', () => {
    expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });
});

describe('formatCEP', () => {
  it('formata CEP com hífen', () => {
    expect(formatCEP('01310100')).toBe('01310-100');
  });

  it('ignora caracteres não numéricos', () => {
    expect(formatCEP('01310-100')).toBe('01310-100');
  });
});

describe('formatNPK', () => {
  it('formata fórmula NPK simples', () => {
    expect(formatNPK('10-10-10', 10, 10, 10)).toBe('10-10-10');
  });

  it('usa valor calculado quando difere da fórmula alvo', () => {
    const result = formatNPK('10-10-10', 9.5, 10, 10);
    expect(result).toContain('9');
  });

  it('formata valores com decimal usando vírgula', () => {
    const result = formatNPK('10-10-10', 9.75, 10, 10);
    expect(result).toMatch(/9,75/);
  });

  it('usa separador - entre os valores', () => {
    const result = formatNPK('04-14-08', 4, 14, 8);
    expect(result).toBe('04-14-08');
  });
});

describe('garantia real (sem arredondar para cima)', () => {
  // Batida 05-25-15: Map 332,26 kg + Ureia 50 kg → N = 5,9548...%
  const realN = (332.26 * 0.11 + 50 * 0.46) / 10;

  it('mostra 5,95 e nunca 6,0 ou 5,96', () => {
    expect(realN).toBeCloseTo(5.9549, 3);
    expect(truncateGuarantee(realN)).toBe(5.95);
    expect(formatGuarantee(realN)).toBe('5,95');
    expect(formatNPK('05-25-15', realN, 25, 15)).toBe('5,95-25-15');
  });

  it('não transforma valores exatos em um a menos por imprecisão', () => {
    expect(formatGuarantee(25)).toBe('25,00');
    expect(formatGuarantee(0.1 + 0.2)).toBe('0,30');
    expect(formatGuarantee(14.999999999)).toBe('15,00');
    expect(formatGuarantee(24.9999993)).toBe('25,00');
    expect(formatGuarantee(2.9449)).toBe('2,94');
  });
});
