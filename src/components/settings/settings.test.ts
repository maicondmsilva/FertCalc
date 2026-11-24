import { describe, expect, it } from 'vitest';
import { describeSkipped, normalizeDocument, parseAgentRows, parseClientRows } from './importRows';
import { fitWithin, validateLogoFile } from './logoUpload';

describe('importação de clientes e agentes', () => {
  it('ignora documento já cadastrado (com ou sem pontuação) e repetido na planilha', () => {
    const result = parseClientRows(
      [
        { 'Razão Social / Nome*': 'Fazenda A', 'CNPJ / CPF*': '12.345.678/0001-90' },
        { 'Razão Social / Nome*': 'Fazenda B', 'CNPJ / CPF*': '111.222.333-44' },
        { 'Razão Social / Nome*': 'Fazenda B de novo', 'CNPJ / CPF*': '11122233344' },
        { 'Razão Social / Nome*': '', 'CNPJ / CPF*': '999' },
        { 'Razão Social / Nome*': 'Sem doc' },
      ],
      ['12345678000190']
    );
    expect(result.items.map((item) => item.name)).toEqual(['Fazenda B']);
    expect(result.duplicated).toEqual([2, 4]);
    expect(result.missingRequired).toEqual([5, 6]);
    expect(describeSkipped(result)).toBe(
      '2 já cadastrado(s) ou repetido(s) (linhas 2, 4); 2 sem nome ou documento (linhas 5, 6)'
    );
  });

  it('monta o agente com endereço e UF em maiúsculas', () => {
    const { items } = parseAgentRows(
      [{ 'Nome*': ' Agente X ', 'Documento*': 123, CEP: '38000-000', 'Estado (UF)': 'mg' }],
      []
    );
    expect(items[0]).toMatchObject({ name: 'Agente X', document: '123' });
    expect(items[0].address?.state).toBe('MG');
  });

  it('normaliza documento', () => {
    expect(normalizeDocument(' 12.3-4/5 ')).toBe('12345');
  });
});

describe('logo da empresa', () => {
  it('aceita PNG, JPG e WEBP até 2 MB', () => {
    expect(validateLogoFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateLogoFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPG ou WEBP/);
    expect(validateLogoFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });

  it('reduz mantendo a proporção e não amplia imagem pequena', () => {
    expect(fitWithin(1200, 400)).toEqual({ width: 600, height: 200 });
    expect(fitWithin(300, 100)).toEqual({ width: 300, height: 100 });
  });
});
