import { describe, expect, it } from 'vitest';
import { defaultNotificationUrl, notificationTarget } from './notificationLinks';

const id = '4981dd6a-e7e7-458c-b5c2-dc851765b81d';

describe('notificationTarget', () => {
  it('corrige endereços antigos', () => {
    expect(notificationTarget({ action_url: '/carregamento' })).toBe('/carregamento_visao_geral');
    expect(notificationTarget({ action_url: `/calculator?id=${id}` })).toBe(
      `/history?pricing=${id}`
    );
    expect(notificationTarget({ action_url: '/carregamento_solicitacao' })).toBe(
      '/carregamento_solicitacao'
    );
  });

  it('proposta aceita abre a aba Propostas na proposta', () => {
    expect(
      notificationTarget({ type: 'PROPOSTA_ACEITA', action_url: '/saved_formulas', data_id: id })
    ).toBe(`/saved_formulas?aba=propostas&proposta=${id}`);
  });

  it('avisos de precificação sem link', () => {
    expect(
      notificationTarget({
        type: 'pricing_approval',
        title: 'Nova Precificação Pendente',
        data_id: id,
      })
    ).toBe('/approvals');
    expect(
      notificationTarget({
        type: 'pricing_approval',
        title: 'Precificação Aprovada ✅',
        data_id: id,
      })
    ).toBe(`/history?pricing=${id}`);
    expect(
      notificationTarget({ type: 'pricing_approval', title: 'Reenvio de Precificação Reprovada' })
    ).toBe('/approvals');
    expect(
      notificationTarget({ type: 'pricing_approval', title: 'Autorização de garantias solicitada' })
    ).toBe('/approvals?aba=guarantees');
    expect(
      notificationTarget({ type: 'pricing_approval', title: 'Solicitação de Exclusão Aprovada' })
    ).toBe('/history');
    expect(
      notificationTarget({ type: 'pricing_deletion_request', title: 'Solicitação de Exclusão' })
    ).toBe('/approvals?aba=deletions');
    expect(notificationTarget({ type: 'pricing_transfer', data_id: id })).toBe(
      `/history?pricing=${id}`
    );
  });

  it('metas', () => {
    expect(notificationTarget({ type: 'goal_approval', title: 'Nova Meta Pendente' })).toBe(
      '/approvals?aba=goals'
    );
    expect(notificationTarget({ type: 'goal_approval', title: 'Meta aprovada' })).toBe('/goals');
  });

  it('grupo como último recurso', () => {
    expect(defaultNotificationUrl({ type: 'X', group_type: 'CARREGAMENTO' })).toBe(
      '/carregamento_visao_geral'
    );
    expect(defaultNotificationUrl({ type: 'COTACAO_NOVA', group_type: 'CARREGAMENTO' })).toBe(
      '/carregamento_solicitacao'
    );
    expect(defaultNotificationUrl({ type: 'X', group_type: 'SYSTEM' })).toBeNull();
  });
});
