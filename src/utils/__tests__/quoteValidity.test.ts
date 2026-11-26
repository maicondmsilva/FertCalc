import { describe, expect, it } from 'vitest';
import { defaultValidity, quoteValidity, validityProblem } from '../quoteValidity';

const now = new Date('2026-11-26T15:00:00');

describe('validade da cotação', () => {
  it('sem data continua disponível', () => {
    expect(quoteValidity(null, now)).toMatchObject({ expired: false, daysLeft: null });
  });

  it('conta os dias e marca vencida', () => {
    expect(quoteValidity('2026-11-30', now)).toMatchObject({ expired: false, daysLeft: 4 });
    expect(quoteValidity('2026-11-26', now).label).toBe('Vence hoje');
    expect(quoteValidity('2026-11-25', now)).toMatchObject({ expired: true });
  });

  it('sugere hoje + 7 e não aceita data passada nem vazia', () => {
    expect(defaultValidity(7, now)).toBe('2026-12-03');
    expect(validityProblem('', now)).toMatch(/Informe/);
    expect(validityProblem('2026-11-20', now)).toMatch(/já passou/);
    expect(validityProblem('2026-11-26', now)).toBeNull();
  });
});
