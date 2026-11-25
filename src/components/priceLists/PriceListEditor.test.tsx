import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PriceListEditor } from './PriceListEditor';
import { emptyDraft } from './priceListEditorModel';

const baseProps = {
  isNew: false,
  canManage: true,
  dirty: false,
  saving: false,
  catalogMacros: [],
  catalogMicros: [],
  locais: [],
  onChange: vi.fn(),
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  onDuplicate: vi.fn(),
  onExportExcel: vi.fn(),
  onPdf: vi.fn(),
  onRemove: vi.fn(),
  onRestore: vi.fn(),
};

const draft = { ...emptyDraft(), id: 'l1', name: 'Lista Uberaba' };

describe('lista de preço: visualizar e editar', () => {
  it('abre em visualização, com os campos travados e o botão Editar', () => {
    const onEdit = vi.fn();
    render(<PriceListEditor {...baseProps} draft={draft} editing={false} onEdit={onEdit} />);
    expect(screen.getByText('Visualizando')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Salvar lista/ })).toBeNull();
    expect(screen.getByDisplayValue('Lista Uberaba')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('em edição libera os campos, mostra salvar e esconde Editar', () => {
    render(<PriceListEditor {...baseProps} draft={draft} editing onEdit={vi.fn()} />);
    expect(screen.getByText('Editando')).toBeTruthy();
    expect(screen.getByDisplayValue('Lista Uberaba')).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: /Salvar lista/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cancelar edição/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Editar$/ })).toBeNull();
  });

  it('quem não pode gerenciar não vê o botão Editar', () => {
    render(
      <PriceListEditor
        {...baseProps}
        canManage={false}
        draft={draft}
        editing={false}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText('Somente leitura')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
  });
});
