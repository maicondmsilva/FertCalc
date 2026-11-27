import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), lookup: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('../../utils/formatters', () => ({ lookupCEP: mocks.lookup }));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn() } }));

import { buscarCep } from '../cepService';

const endereco = { street: 'Rua Goiás', neighborhood: 'Centro', city: 'Rio Verde', state: 'GO' };

beforeEach(() => vi.clearAllMocks());

describe('busca de CEP', () => {
  it('usa a função do servidor', async () => {
    mocks.invoke.mockResolvedValue({ data: { endereco }, error: null });
    await expect(buscarCep('75900-000')).resolves.toEqual(endereco);
    expect(mocks.invoke).toHaveBeenCalledWith('buscar-cep', { body: { cep: '75900000' } });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('CEP inexistente: não encontrado, sem cair no plano B', async () => {
    mocks.invoke.mockResolvedValue({ data: { endereco: null }, error: null });
    await expect(buscarCep('00000000')).resolves.toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('função fora do ar: busca direto nos serviços', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('FunctionsFetchError') });
    mocks.lookup.mockResolvedValue(endereco);
    await expect(buscarCep('75900000')).resolves.toEqual(endereco);
    expect(mocks.lookup).toHaveBeenCalledWith('75900000');
  });
});
