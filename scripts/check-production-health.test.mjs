import { describe, expect, it, vi } from 'vitest';
import { checkProductionHealth } from './check-production-health.mjs';

describe('production health monitor', () => {
  it('accepts a healthy FertCalc response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html><title>FertCalc Pro</title></html>', { status: 200 }));

    const result = await checkProductionHealth({
      targetUrl: 'https://fertcalc.example.com',
      fetchImpl,
    });

    expect(result).toMatchObject({ status: 'healthy', httpStatus: 200 });
  });

  it('fails when the deployment responds without the FertCalc marker', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>outro site</html>'));

    await expect(
      checkProductionHealth({ targetUrl: 'https://fertcalc.example.com', fetchImpl })
    ).rejects.toThrow('identificação esperada');
  });

  it('reports protected deployments when no bypass secret is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://vercel.com/sso-api?url=protected',
      text: () => Promise.resolve('<html>Vercel Login</html>'),
    });

    const result = await checkProductionHealth({
      targetUrl: 'https://fertcalc.example.com',
      fetchImpl,
    });

    expect(result.status).toBe('protected');
  });
});
