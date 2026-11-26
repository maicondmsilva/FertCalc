import { describe, expect, it, vi } from 'vitest';
import { navigateInsideApp } from '../NotificationCard';

describe('navigateInsideApp', () => {
  it('endereço do sistema troca de página sem recarregar', () => {
    const listener = vi.fn();
    window.addEventListener('popstate', listener);
    navigateInsideApp('/pricing?id=1');
    expect(window.location.pathname).toBe('/pricing');
    expect(window.location.search).toBe('?id=1');
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('popstate', listener);
  });
});
