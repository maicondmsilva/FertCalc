import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { CalculatorSettingsModal } from '../CalculatorSettingsModal';

describe('CalculatorSettingsModal', () => {
  const mockGlobalMacros: any[] = [
    { id: '1', name: 'Ureia', n: 45, p: 0, k: 0, selected: false },
    { id: '2', name: 'MAP', n: 11, p: 52, k: 0, selected: true },
  ];

  const mockFormula: any = {
    id: 'f1',
    formula: '04-14-08',
    macros: [],
    micros: [],
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CalculatorSettingsModal
        isOpen={false}
        onClose={vi.fn()}
        formula={mockFormula}
        globalMacros={mockGlobalMacros}
        globalMicros={[]}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when isOpen is true', () => {
    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={mockFormula}
        globalMacros={mockGlobalMacros}
        globalMicros={[]}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Produtos da Fórmula')).toBeDefined();
    expect(screen.getByText('Ureia')).toBeDefined();
    expect(screen.getByText('MAP')).toBeDefined();
  });

  it('calls onConfirm with updated local formula when confirmed', () => {
    const handleConfirm = vi.fn();
    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={mockFormula}
        globalMacros={mockGlobalMacros}
        globalMicros={[]}
        onConfirm={handleConfirm}
      />
    );

    // Toggle Ureia selection
    const ureiaCard = screen.getByText('Ureia');
    fireEvent.click(ureiaCard);

    const confirmButton = screen.getByText('Confirmar Seleção');
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    const updatedFormula = handleConfirm.mock.calls[0][0];

    // Check if Ureia was marked as selected
    const ureiaInFormula = updatedFormula.macros.find((m: any) => m.name === 'Ureia');
    expect(ureiaInFormula.selected).toBe(true);
  });

  it('shows friendly message when there are no materials in database', () => {
    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={mockFormula}
        globalMacros={[]}
        globalMicros={[]}
        hasNoMaterialsInDatabase={true}
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        'Nenhuma matéria-prima cadastrada. Acesse o cadastro de produtos para adicionar.'
      )
    ).toBeDefined();
  });

  it('does not allow a protected material to be changed', () => {
    const handleConfirm = vi.fn();
    const protectedFormula = {
      ...mockFormula,
      macros: [{ ...mockGlobalMacros[0], selected: true, minQty: 10, maxQty: 20 }],
    };

    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={protectedFormula}
        globalMacros={mockGlobalMacros}
        globalMicros={[]}
        protectedMaterialIds={['1']}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByText('Ureia'));
    fireEvent.click(screen.getByText('Confirmar Seleção'));

    expect(screen.getByText('Protegido para preservar a descrição da formulação')).toBeDefined();
    expect(handleConfirm.mock.calls[0][0].macros[0]).toMatchObject({
      id: '1',
      selected: true,
      minQty: 10,
      maxQty: 20,
    });
  });

  it('converts a desired micro guarantee into a fixed quantity in kg', () => {
    const handleConfirm = vi.fn();
    const micro: any = {
      id: 'micro-1',
      name: 'Boro 5%',
      type: 'micro',
      selected: false,
      microGuarantees: [{ name: 'B', value: 5 }],
      minQty: 0,
      maxQty: 0,
      minQuantity: 0,
      quantity: 0,
    };

    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={mockFormula}
        globalMacros={mockGlobalMacros}
        globalMicros={[micro]}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByText('Micronutrientes'));
    fireEvent.click(screen.getByText('Boro 5%'));
    fireEvent.change(screen.getByLabelText('Informar por'), { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText(/^Garantia final desejada/), {
      target: { value: '0.25' },
    });
    fireEvent.click(screen.getByText('Confirmar Seleção'));

    expect(handleConfirm.mock.calls[0][0].micros[0]).toMatchObject({
      minQty: 50,
      maxQty: 50,
      microInputMode: 'percent',
      selectedMicroGuarantee: 'B',
      desiredGuaranteePercent: 0.25,
    });
  });

  it('persists a custom order and can restore the price-list order', () => {
    const handleConfirm = vi.fn();
    render(
      <CalculatorSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        formula={{
          ...mockFormula,
          macros: [
            { ...mockGlobalMacros[0], selected: true, materialOrder: 1 },
            { ...mockGlobalMacros[1], selected: true, materialOrder: 0 },
          ],
        }}
        globalMacros={mockGlobalMacros}
        globalMicros={[]}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByText('Confirmar Seleção'));
    expect(handleConfirm.mock.calls[0][0].macros.map((item: any) => item.id)).toEqual(['2', '1']);
  });
});
