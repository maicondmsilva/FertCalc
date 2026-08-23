import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { runSystemHealthChecks } from './healthCheckService';

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe('system health checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as never);
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    } as never);
  });

  it('reports all essential services as operational', async () => {
    const snapshot = await runSystemHealthChecks();

    expect(snapshot.status).toBe('operational');
    expect(snapshot.checks).toHaveLength(4);
    expect(snapshot.checks.every((check) => check.status === 'operational')).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('app_users');
  });

  it('marks the system unavailable when the read-only database check fails', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        limit: vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') }),
      }),
    } as never);

    const snapshot = await runSystemHealthChecks();

    expect(snapshot.status).toBe('unavailable');
    expect(snapshot.checks.find((check) => check.id === 'database')).toMatchObject({
      status: 'unavailable',
    });
  });

  it('does not call remote services while the device is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const snapshot = await runSystemHealthChecks();

    expect(snapshot.status).toBe('unavailable');
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
