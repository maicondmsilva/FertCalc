import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { registrarAuditLog } from '../auditLogService';
import { logAudit } from '../auditService';

describe('audit services', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it('registra auditoria geral por RPC sem aceitar identidade do cliente', async () => {
    await logAudit({
      user_id: 'forged-id',
      user_name: 'Forged Name',
      action: 'pricing.approved',
      entity_type: 'pricing_record',
      entity_id: 'pricing-1',
      metadata: { status: 'approved' },
    });

    expect(rpcMock).toHaveBeenCalledWith('write_audit_logs_entry', {
      p_action: 'pricing.approved',
      p_entity_type: 'pricing_record',
      p_entity_id: 'pricing-1',
      p_metadata: { status: 'approved' },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('registra auditoria de carregamento por RPC e calcula campos alterados', async () => {
    await registrarAuditLog({
      tabela: 'carregamentos',
      registro_id: 'load-1',
      acao: 'UPDATE',
      dados_anteriores: { status: 'aberto', peso: 10 },
      dados_novos: { status: 'fechado', peso: 10 },
      usuario_id: 'forged-id',
      usuario_nome: 'Forged Name',
    });

    expect(rpcMock).toHaveBeenCalledWith('write_audit_log_entry', {
      p_tabela: 'carregamentos',
      p_registro_id: 'load-1',
      p_acao: 'UPDATE',
      p_dados_anteriores: { status: 'aberto', peso: 10 },
      p_dados_novos: { status: 'fechado', peso: 10 },
      p_campos_alterados: ['status'],
      p_motivo: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
