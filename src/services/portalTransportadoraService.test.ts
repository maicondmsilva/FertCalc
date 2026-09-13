import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc } }));

import { listarCotacoesPortal, responderCotacaoPortal } from './portalTransportadoraService';

describe('portalTransportadoraService', () => {
  beforeEach(() => rpc.mockReset());

  it('normaliza os valores numéricos retornados pelo banco', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'q1', quantidade_total: '12.5', valor_cotado: '480.90', prazo_dias: '2' }],
      error: null,
    });
    const [cotacao] = await listarCotacoesPortal();
    expect(cotacao).toMatchObject({ quantidade_total: 12.5, valor_cotado: 480.9, prazo_dias: 2 });
  });

  it('envia somente os parâmetros da resposta controlada', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await responderCotacaoPortal('q1', {
      aceitar: true,
      valorCotado: 500,
      prazoDias: 3,
      validadeCotacao: '2026-09-30',
      observacoes: '  proposta  ',
    });
    expect(rpc).toHaveBeenCalledWith('responder_cotacao_transportadora', {
      p_cotacao_id: 'q1',
      p_aceitar: true,
      p_valor_cotado: 500,
      p_prazo_dias: 3,
      p_validade_cotacao: '2026-09-30',
      p_observacoes: 'proposta',
    });
  });

  it('propaga falhas da operação protegida', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('negado') });
    await expect(responderCotacaoPortal('q1', { aceitar: false })).rejects.toThrow('negado');
  });
});
