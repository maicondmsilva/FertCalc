import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';

vi.mock('../../Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock('../../../hooks/useModalBackNavigation', () => ({ useModalBackNavigation: () => {} }));

import BetaProfitabilityModal from '../BetaProfitabilityModal';

const calc = {
  id: 'f1',
  formula: '04-14-08',
  factors: {
    factor: 1,
    taxRate: 0,
    commission: 0,
    freight: 0,
    monthlyInterestRate: 0,
    paymentCondition: 'vencimento',
    dueDate: '2026-11-25',
    exemptCurrentMonth: true,
  },
  summary: { baseCost: 2000, finalPrice: 2400 },
} as never;

describe('BetaProfitabilityModal', () => {
  it('calcula ao vivo com o preço da fórmula e recalcula ao mudar o preço', () => {
    render(
      <BetaProfitabilityModal
        calc={calc}
        calcIndex={0}
        currentUser={{ id: 'u1', name: 'Ana' }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Rentável')).toBeTruthy();
    expect(screen.getByText(/\+\s*R\$\s*400,00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Valor unitário/), { target: { value: '1900' } });
    expect(screen.getByText('Prejuízo')).toBeTruthy();
  });

  it('sem precificação vinculada não deixa gravar', () => {
    render(
      <BetaProfitabilityModal
        calc={calc}
        calcIndex={0}
        currentUser={{ id: 'u1', name: 'Ana' }}
        onClose={() => {}}
      />
    );
    const save = screen.getByRole('button', { name: /Gravar na precificação/ });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Salve a precificação ou busque/)).toBeTruthy();
  });

  it('com precificação desta tela, grava habilitado', () => {
    render(
      <BetaProfitabilityModal
        calc={calc}
        calcIndex={0}
        savedPricingId="p1"
        currentUser={{ id: 'u1', name: 'Ana' }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Precificação desta tela')).toBeTruthy();
    const save = screen.getByRole('button', { name: /Gravar na precificação/ });
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });
});
