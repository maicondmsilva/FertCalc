import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useModalBackNavigation } from './useModalBackNavigation';

describe('useModalBackNavigation', () => {
  it('fecha o modal quando o usuário usa a navegação Voltar', () => {
    const onClose = vi.fn();
    renderHook(() => useModalBackNavigation(true, onClose));

    act(() => window.dispatchEvent(new Event('popstate')));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('não interfere no histórico quando o modal está fechado', () => {
    const onClose = vi.fn();
    renderHook(() => useModalBackNavigation(false, onClose));

    act(() => window.dispatchEvent(new Event('popstate')));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mantém o modal aberto quando outra camada retorna para sua entrada', () => {
    const onClose = vi.fn();
    renderHook(() => useModalBackNavigation(true, onClose));
    const event = new Event('popstate');
    Object.defineProperty(event, 'state', { value: window.history.state });

    act(() => window.dispatchEvent(event));
    expect(onClose).not.toHaveBeenCalled();
  });
});
