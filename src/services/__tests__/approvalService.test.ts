import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PricingRecord, User } from '../../types';
import { createNotification, updatePricingRecord } from '../db';
import { logAudit } from '../auditService';
import { processPricingApproval } from '../approvalService';
import { logger } from '../../utils/logger';

vi.mock('../db', () => ({
  createNotification: vi.fn(),
  updatePricingRecord: vi.fn(),
}));
vi.mock('../auditService', () => ({ logAudit: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

const approver = {
  id: 'approver-1',
  name: 'Aprovador',
} as User;
const pricing = {
  id: 'pricing-1',
  userId: 'seller-1',
  formattedCod: '42',
  history: [],
  factors: { client: { name: 'Cliente Teste' } },
} as PricingRecord;
const now = new Date('2026-08-23T10:00:00.000Z');

beforeEach(() => {
  vi.mocked(updatePricingRecord).mockReset().mockResolvedValue();
  vi.mocked(createNotification)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(logAudit).mockReset().mockResolvedValue();
  vi.mocked(logger.warn).mockReset();
});

describe('processPricingApproval', () => {
  it('persiste a aprovação antes de notificar e auditar', async () => {
    const historyEntry = await processPricingApproval({
      pricing,
      status: 'Aprovada',
      approver,
      now,
    });

    expect(updatePricingRecord).toHaveBeenCalledWith('pricing-1', {
      approvalStatus: 'Aprovada',
      rejectionObservation: '',
      history: [historyEntry],
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        title: 'Precificação Aprovada ✅',
        type: 'pricing_approval',
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pricing.approved', entity_id: 'pricing-1' })
    );
  });

  it('registra o motivo ao reprovar a precificação', async () => {
    const historyEntry = await processPricingApproval({
      pricing,
      status: 'Reprovada',
      reason: ' Margem insuficiente ',
      approver,
      now,
    });

    expect(historyEntry.action).toBe('Precificação Reprovada: Margem insuficiente');
    expect(updatePricingRecord).toHaveBeenCalledWith(
      'pricing-1',
      expect.objectContaining({ rejectionObservation: 'Margem insuficiente' })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Motivo: Margem insuficiente') })
    );
  });

  it('mantém a aprovação concluída quando apenas a notificação falha', async () => {
    vi.mocked(createNotification).mockRejectedValue(new Error('Realtime indisponível'));

    await expect(
      processPricingApproval({ pricing, status: 'Aprovada', approver, now })
    ).resolves.toMatchObject({ action: 'Precificação Aprovada' });

    expect(updatePricingRecord).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('não dispara efeitos auxiliares quando a persistência principal falha', async () => {
    vi.mocked(updatePricingRecord).mockRejectedValue(new Error('RLS negou a atualização'));

    await expect(
      processPricingApproval({ pricing, status: 'Aprovada', approver, now })
    ).rejects.toThrow('RLS negou a atualização');
    expect(createNotification).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
