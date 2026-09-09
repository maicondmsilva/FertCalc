import { describe, expect, it, vi } from 'vitest';
import { closeModalOnBackdrop } from './modalUtils';

describe('closeModalOnBackdrop', () => {
  it('fecha somente quando o clique ocorre no fundo', () => {
    const onClose = vi.fn();
    const backdrop = {};

    closeModalOnBackdrop({ target: backdrop, currentTarget: backdrop } as never, onClose);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('não fecha ao clicar no conteúdo ou durante operação bloqueada', () => {
    const onClose = vi.fn();
    const backdrop = {};

    closeModalOnBackdrop({ target: {}, currentTarget: backdrop } as never, onClose);
    closeModalOnBackdrop({ target: backdrop, currentTarget: backdrop } as never, onClose, true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
