import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.error sempre chama console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { logger } = await import('./logger');
    logger.error('erro crítico');
    expect(spy).toHaveBeenCalledWith('erro crítico');
  });

  it('exporta as três funções esperadas', async () => {
    const { logger } = await import('./logger');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
