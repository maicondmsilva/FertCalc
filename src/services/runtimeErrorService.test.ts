import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { persistRuntimeError } from './runtimeErrorService';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn() },
}));

describe('runtime error persistence', () => {
  const insert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);
    insert.mockResolvedValue({ error: null });
  });

  it('stores a sanitized authenticated incident without a client-provided user id', async () => {
    await persistRuntimeError({
      incidentId: 'FERT-TEST-1234',
      source: 'react-error-boundary',
      message: 'Falha de renderização',
      path: '/pedidos',
      userAgent: 'browser',
    });

    expect(supabase.from).toHaveBeenCalledWith('runtime_error_events');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        incident_id: 'FERT-TEST-1234',
        message: 'Falha de renderização',
        path: '/pedidos',
      })
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty('user_id');
  });

  it('ignores a repeated incident id', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });

    await expect(
      persistRuntimeError({
        incidentId: 'FERT-TEST-1234',
        source: 'react-error-boundary',
        message: 'Falha repetida',
      })
    ).resolves.toBeUndefined();
  });

  it('propagates database failures to the reporter fallback', async () => {
    insert.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });

    await expect(
      persistRuntimeError({
        incidentId: 'FERT-TEST-1234',
        source: 'react-error-boundary',
        message: 'Falha',
      })
    ).rejects.toMatchObject({ code: '42501' });
  });
});
