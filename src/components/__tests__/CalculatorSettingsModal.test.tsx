import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalculatorSettingsModal } from '../CalculatorSettingsModal';

describe('CalculatorSettingsModal', () => {
  const mockGlobalMacros: any[] = [
    { id: '1', name: 'Ureia', n: 45, p: 0, k: 0, selected: false },
    { id: '2', name: 'MAP', n: 11, p: 52, k: 0, selected: true }
  ];

  const mockFormula: any = {
    id: 'f1',
    formula: '04-14-08',
    macros: [],
    micros: []
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
    expect(screen.getByText('Configurações de Produtos')).toBeDefined();
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
});
