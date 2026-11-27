import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PriceList, User } from '../../types';

const material = (id: string, price: number, priceUSD?: number) =>
  ({ id, name: id, price, priceUSD }) as never;

const lists: Partial<PriceList>[] = [
  {
    id: 'reais',
    name: 'Lista só em reais',
    date: '2026-11-01',
    currency: 'BRL',
    local_carregamento_id: 'local-1',
    macros: [material('ureia', 3000)],
    micros: [],
  },
  {
    id: 'dupla',
    name: 'Lista reais e dólar',
    date: '2026-10-01',
    currency: 'BRL',
    dollarRate: 5.4,
    local_carregamento_id: 'local-1',
    macros: [material('ureia', 3000, 560)],
    micros: [],
  },
];

vi.mock('../../services/db', () => ({
  getSavedFormulas: vi.fn().mockResolvedValue([]),
  getPriceLists: vi.fn(async () => lists),
  getAppSettings: vi.fn().mockResolvedValue(null),
  getClients: vi.fn().mockResolvedValue([]),
  getBrands: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/locaisCarregamentoService', () => ({
  getLocaisAtivos: vi.fn().mockResolvedValue([{ id: 'local-1', nome: 'Uberaba', filial_id: 'f1' }]),
}));
vi.mock('../../services/produtosFormuladosService', () => ({
  getProdutoFormuladoBySavedFormulaId: vi.fn(),
  getProdutosFormulados: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/savedFormulaService', () => ({ setSavedFormulaArchived: vi.fn() }));
vi.mock('../../services/historicoPrecoService', () => ({ addHistoricoPrecos: vi.fn() }));
vi.mock('../../services/embalagensService', () => ({
  getEmbalagens: vi.fn().mockResolvedValue([]),
}));
vi.mock('../calculatorBeta/SimplifiedCalculatorBeta', () => ({ default: () => null }));
vi.mock('../propostas/PropostasPanel', () => ({ default: () => null }));
vi.mock('../../services/propostaService', () => ({
  criarProposta: vi.fn(),
  getProposta: vi.fn(),
  registrarDocumentoProposta: vi.fn(),
}));

import SavedFormulas from '../SavedFormulas';

describe('Batidas Salvas: moeda da tabela de preços', () => {
  it('em US$ mostra só as listas que têm preço em dólar', async () => {
    render(
      <MemoryRouter>
        <SavedFormulas currentUser={{ id: 'u1', role: 'user', permissions: {} } as User} />
      </MemoryRouter>
    );
    const select = (await screen.findByLabelText(/Tabela de preços/i, {
      selector: 'select',
    })) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('reais'));
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Lista só em reais', 'Lista reais e dólar']);

    fireEvent.click(screen.getByRole('radio', { name: 'US$' }));

    await waitFor(() => expect(select.value).toBe('dupla'));
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Lista reais e dólar']);
  });
});
