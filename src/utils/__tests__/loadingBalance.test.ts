import { describe, expect, it } from 'vitest';
import { loadingBalance } from '../loadingBalance';
import type { ExecucaoCarregamento } from '../../types/carregamento';

const base = {
  quantidade_total: 100,
  quantidade_liberada: 20,
  quantidade_carregada: 0,
  quantidade_cancelada: 0,
};
const execution = (status: ExecucaoCarregamento['status'], scheduled: number, loaded = 0) =>
  ({
    status,
    quantidade_agendada: scheduled,
    quantidade_carregada: loaded,
  }) as ExecucaoCarregamento;

describe('saldos da operação de carregamento', () => {
  it('só oferece para agendamento o volume liberado', () => {
    expect(loadingBalance(base, [])).toMatchObject({
      available: 20,
      awaitingRelease: 80,
      cancellable: 100,
    });
  });
  it('reservar todo o liberado não representa carga física', () => {
    expect(loadingBalance(base, [execution('agendado', 20)])).toMatchObject({
      available: 0,
      loaded: 0,
      reserved: 20,
      cancellable: 80,
    });
  });
  it('conclusão parcial devolve a diferença para agendar', () => {
    expect(loadingBalance(base, [execution('concluido', 20, 18)])).toMatchObject({
      available: 2,
      loaded: 18,
    });
  });
  it('veículo cancelado libera a reserva', () => {
    expect(loadingBalance(base, [execution('cancelado', 20)])).toMatchObject({
      available: 20,
      reserved: 0,
    });
  });
  it('não subtrai cancelamentos duas vezes da liberação', () => {
    expect(
      loadingBalance(
        { ...base, quantidade_total: 100, quantidade_cancelada: 90, quantidade_liberada: 10 },
        []
      )
    ).toMatchObject({ available: 10, cancellable: 10, awaitingRelease: 0 });
  });
  it('mantém precisão de três casas sem resíduos de ponto flutuante', () => {
    expect(
      loadingBalance({ ...base, quantidade_liberada: 0.3 }, [execution('concluido', 0.2, 0.2)])
        .available
    ).toBe(0.1);
  });
});
