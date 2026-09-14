import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from } }));

import {
  desativarVinculoTransportadora,
  listarUsuariosPortalTransportadora,
  vincularUsuarioTransportadora,
} from './transportadoraAccessService';

describe('transportadoraAccessService', () => {
  beforeEach(() => from.mockReset());

  it('lista somente usuários com perfil de transportadora', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'u1', name: 'Portal ABC', email: 'abc@teste.com', ativo: true }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    await expect(listarUsuariosPortalTransportadora()).resolves.toEqual([
      { id: 'u1', nome: 'Portal ABC', email: 'abc@teste.com', ativo: true },
    ]);
    expect(eq).toHaveBeenCalledWith('role', 'transportadora');
  });

  it('reativa ou troca o vínculo pelo usuário sem criar duplicidade', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });

    await vincularUsuarioTransportadora({
      organizationId: 'org1',
      transportadoraId: 't1',
      userId: 'u1',
      criadoPor: 'admin1',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org1',
        transportadora_id: 't1',
        user_id: 'u1',
        ativo: true,
      }),
      { onConflict: 'user_id' }
    );
  });

  it('desativa o vínculo de forma recuperável', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });

    await desativarVinculoTransportadora('v1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ativo: false }));
    expect(eq).toHaveBeenCalledWith('id', 'v1');
  });
});

