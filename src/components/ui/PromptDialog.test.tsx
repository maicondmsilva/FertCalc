import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptDialog } from './PromptDialog';

describe('PromptDialog', () => {
  it('executa a confirmação apenas uma vez enquanto o salvamento está em andamento', async () => {
    let finishSave: (() => void) | undefined;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const onConfirm = vi.fn(() => pendingSave);

    render(
      <PromptDialog
        isOpen
        title="Salvar Batida"
        defaultValue="Formula 10-10-10"
        confirmLabel="Salvar"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const saveButton = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(saveButton);
    fireEvent.submit(saveButton.closest('form')!);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();

    finishSave?.();
    await pendingSave;
  });
});
