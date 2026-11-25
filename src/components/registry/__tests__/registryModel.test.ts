import { describe, expect, it } from 'vitest';
import {
  documentProblem,
  findDuplicate,
  formatAddress,
  matchesRegistrySearch,
  registryPermissions,
} from '../registryModel';

describe('registryModel', () => {
  it('valida dígitos de CPF e CNPJ', () => {
    expect(documentProblem('529.982.247-25', true)).toBeNull();
    expect(documentProblem('529.982.247-24', true)).toMatch(/CPF inválido/);
    expect(documentProblem('111.111.111-11', true)).toMatch(/CPF inválido/);
    expect(documentProblem('11.222.333/0001-81', true)).toBeNull();
    expect(documentProblem('11.222.333/0001-80', true)).toMatch(/CNPJ inválido/);
    expect(documentProblem('123', true)).toMatch(/11 dígitos/);
    expect(documentProblem('', true)).toMatch(/Informe/);
    expect(documentProblem('', false)).toBeNull();
  });

  it('busca não quebra sem documento e aceita documento sem pontuação', () => {
    expect(matchesRegistrySearch({ name: 'Ana', document: null }, '123')).toBe(false);
    expect(matchesRegistrySearch({ name: null, document: null }, 'x')).toBe(false);
    expect(matchesRegistrySearch({ name: 'A', document: '529.982.247-25' }, '52998224725')).toBe(
      true
    );
    expect(matchesRegistrySearch({ name: 'José Antônio' }, 'jose antonio')).toBe(true);
    expect(matchesRegistrySearch({ name: 'X', address: { city: 'Rio Verde' } }, 'rio')).toBe(true);
    expect(matchesRegistrySearch({ name: 'X', code: '42' }, '42')).toBe(true);
  });

  it('duplicado: mesmo CPF com outra IE é permitido para clientes', () => {
    const list = [{ id: '1', name: 'Ana', document: '529.982.247-25', stateRegistration: '111' }];
    expect(
      findDuplicate(list, { document: '52998224725', stateRegistration: '222' }, undefined, true)
    ).toBeNull();
    expect(
      findDuplicate(list, { document: '52998224725', stateRegistration: '111' }, undefined, true)
        ?.id
    ).toBe('1');
    expect(findDuplicate(list, { document: '52998224725' })?.id).toBe('1');
    expect(findDuplicate(list, { document: '52998224725' }, '1')).toBeNull();
  });

  it('endereço em uma linha', () => {
    expect(
      formatAddress({
        street: 'Rua A',
        number: '10',
        city: 'Rio Verde',
        state: 'GO',
        cep: '75900-000',
      })
    ).toBe('Rua A, 10 — Rio Verde/GO — CEP 75900-000');
    expect(formatAddress({})).toBeNull();
  });

  it('permissões iguais às do banco', () => {
    expect(registryPermissions({ role: 'manager', permissions: {} } as never, 'clients')).toEqual({
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });
    expect(
      registryPermissions({ role: 'user', permissions: { agents_delete: true } } as never, 'agents')
    ).toEqual({ canCreate: false, canEdit: false, canDelete: true });
  });
});
