import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppSettings } from '../services/db';
import { getCheckedCount, getPendingCount } from '../services/expenseService';
import { useAppData } from './useAppData';

vi.mock('../services/db', () => ({ getAppSettings: vi.fn() }));
vi.mock('../services/expenseService', () => ({
  getPendingCount: vi.fn(),
  getCheckedCount: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getAppSettings).mockReset();
  vi.mocked(getPendingCount).mockReset();
  vi.mocked(getCheckedCount).mockReset();
  vi.mocked(getAppSettings).mockResolvedValue({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
  vi.mocked(getPendingCount).mockResolvedValue(0);
  vi.mocked(getCheckedCount).mockResolvedValue(0);
});

afterEach(cleanup);

describe('useAppData', () => {
  it('carrega a identidade visual configurada', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({
      companyName: 'Empresa Teste',
      companyLogo: 'logo.png',
    });
    const { result } = renderHook(() => useAppData('pricing', 'user-1'));

    await waitFor(() => expect(result.current.appSettings.companyName).toBe('Empresa Teste'));
    expect(result.current.appSettings.companyLogo).toBe('logo.png');
  });

  it('mantém a identidade padrão quando a configuração falha', async () => {
    vi.mocked(getAppSettings).mockRejectedValue(new Error('indisponível'));
    const { result } = renderHook(() => useAppData('pricing', 'user-1'));

    await waitFor(() => expect(getAppSettings).toHaveBeenCalledTimes(1));
    expect(result.current.appSettings).toEqual({ companyName: 'FertCalc Pro', companyLogo: '' });
  });

  it('carrega badges somente ao entrar no módulo de despesas autenticado', async () => {
    vi.mocked(getPendingCount).mockResolvedValue(5);
    vi.mocked(getCheckedCount).mockResolvedValue(3);
    const { result } = renderHook(() => useAppData('expenses', 'user-1'));

    await waitFor(() => expect(result.current.pendingExpenseCount).toBe(5));
    expect(result.current.checkedExpenseCount).toBe(3);
  });

  it('não consulta despesas fora do módulo correspondente', () => {
    renderHook(() => useAppData('pricing', 'user-1'));
    expect(getPendingCount).not.toHaveBeenCalled();
    expect(getCheckedCount).not.toHaveBeenCalled();
  });
});
