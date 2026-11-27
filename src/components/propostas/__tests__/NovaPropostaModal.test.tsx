import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const criarProposta = vi.fn();
const getProposta = vi.fn();
vi.mock('../../../services/propostaService', () => ({
  criarProposta: (...args: unknown[]) => criarProposta(...args),
  getProposta: (...args: unknown[]) => getProposta(...args),
  linkProposta: vi.fn(),
  registrarDocumentoProposta: vi.fn(),
  urlPropostaCliente: (token: string) => `https://x/proposta/${token}`,
}));
vi.mock('../../../services/db', () => ({
  getClients: () =>
    Promise.resolve([
      {
        id: 'c1',
        name: 'Fazenda Boa Vista',
        document: '123.456.789-09',
        address: { city: 'Uruaçu', state: 'GO' },
      },
    ]),
}));
vi.mock('../../../services/embalagensService', () => ({
  getEmbalagens: () => Promise.resolve([]),
}));
vi.mock('../../../services/produtosFormuladosService', () => ({
  getProdutoFormuladoBySavedFormulaId: () => Promise.resolve(null),
}));
vi.mock('../../../services/historicoPrecoService', () => ({ addHistoricoPrecos: vi.fn() }));
vi.mock('../../../services/cotacaoSolicitadaService', () => ({
  getMinhasCotacoesDisponiveis: () => Promise.resolve([]),
}));
vi.mock('../../../hooks/useMyRegions', () => ({
  useMyRegions: () => ({
    options: [],
    all: [],
    principalId: '',
    orgHasRegions: false,
    loading: false,
  }),
  defaultRegionId: () => '',
}));
vi.mock('../../Toast', () => {
  const toast = { showError: vi.fn(), showSuccess: vi.fn() };
  return { useToast: () => toast };
});

import NovaPropostaModal from '../NovaPropostaModal';

const formula = {
  id: 'sf1',
  id_numeric: 45,
  userId: 'u1',
  userName: 'Maria',
  name: '04-14-08 SOJA',
  date: '',
  targetFormula: '04-14-08',
  category: 'all',
  macros: [{ id: 'm1', name: 'MAP', quantity: 300, price: 3000 }],
  micros: [],
} as never;

function setup() {
  return render(
    <NovaPropostaModal
      isOpen
      formulas={[formula]}
      selectedList={{ id: 'l1', name: 'Novembro', currency: 'BRL' } as never}
      selectedLocal={{ id: 'loc1', nome: 'CATALÃO' } as never}
      currentUser={{ id: 'u1', name: 'Maria', role: 'admin', permissions: {} } as never}
      settings={{ companyName: 'X', companyLogo: '', defaultFactorBRL: 0.9 } as never}
      getFormulaCost={() => ({ total: 1000, missingItems: [] })}
      onClose={vi.fn()}
    />
  );
}

describe('NovaPropostaModal', () => {
  beforeEach(() => {
    criarProposta.mockReset();
    getProposta.mockReset();
  });

  it('exige o cliente antes de salvar', async () => {
    setup();
    expect(await screen.findByText('Escolha o cliente.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Salvar proposta/ })).toBeDisabled();
  });

  it('usa o fator de Configurações e salva com a fotografia da batida', async () => {
    criarProposta.mockResolvedValue('p1');
    getProposta.mockResolvedValue({ id: 'p1', numero: 7, validaAte: '2999-01-01', itens: [] });
    setup();
    expect((screen.getByLabelText(/Fator/i) as HTMLInputElement).value).toBe('0.9');
    fireEvent.change(screen.getByLabelText(/Cliente/), { target: { value: 'boa' } });
    fireEvent.click(await screen.findByText('Fazenda Boa Vista'));
    fireEvent.change(screen.getByLabelText(/Quantidade em toneladas/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar proposta/ }));
    await waitFor(() => expect(criarProposta).toHaveBeenCalledTimes(1));
    const nova = criarProposta.mock.calls[0][0];
    expect(nova.clientId).toBe('c1');
    expect(nova.itens[0]).toMatchObject({
      savedFormulaId: 'sf1',
      quantidadeSugerida: 40,
      formula: { targetFormula: '04-14-08', macros: [{ id: 'm1', quantity: 300 }] },
    });
    expect(nova.itens[0].fatores.factor).toBe(0.9);
    expect(await screen.findByText(/PROP-000007 salva/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /PDF/ })).toBeTruthy();
  });
});
