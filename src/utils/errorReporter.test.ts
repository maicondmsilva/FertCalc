import { describe, expect, it, vi } from 'vitest';
import { logger } from './logger';
import { createIncidentId, reportRuntimeError } from './errorReporter';
import { persistRuntimeError } from '../services/runtimeErrorService';

vi.mock('../services/runtimeErrorService', () => ({
  persistRuntimeError: vi.fn().mockResolvedValue(undefined),
}));

describe('runtime error reporter', () => {
  it('creates a support-friendly incident identifier', () => {
    expect(createIncidentId()).toMatch(/^FERT-[A-Z0-9]+-[A-Z0-9-]+$/);
  });

  it('emits a structured error without throwing', () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    expect(() =>
      reportRuntimeError(new Error('falha'), {
        incidentId: 'FERT-TEST-1234',
        source: 'react-error-boundary',
      })
    ).not.toThrow();
    expect(loggerSpy).toHaveBeenCalledWith(
      '[runtime_error]',
      expect.objectContaining({
        incidentId: 'FERT-TEST-1234',
        message: 'falha',
        source: 'react-error-boundary',
      })
    );
    expect(persistRuntimeError).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: 'FERT-TEST-1234', message: 'falha' })
    );
  });
});
