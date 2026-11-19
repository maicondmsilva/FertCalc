import { describe, expect, it } from 'vitest';
import { getCompanyDisplayName } from './companyBranding';

describe('nome da empresa junto à logo', () => {
  it('mostra o nome por padrão', () => {
    expect(getCompanyDisplayName({ companyName: 'Fertigran', companyLogo: 'logo' })).toBe(
      'Fertigran'
    );
  });

  it('esconde o nome quando o usuário escolhe só a logo', () => {
    expect(
      getCompanyDisplayName({
        companyName: 'Fertigran',
        companyLogo: 'logo',
        showCompanyName: false,
      })
    ).toBe('');
  });

  it('mostra o nome sem logo cadastrada, mesmo com a opção desmarcada', () => {
    expect(
      getCompanyDisplayName({ companyName: 'Fertigran', companyLogo: '', showCompanyName: false })
    ).toBe('Fertigran');
  });

  it('aceita nome vazio', () => {
    expect(getCompanyDisplayName({ companyName: '  ', companyLogo: 'logo' })).toBe('');
  });
});
