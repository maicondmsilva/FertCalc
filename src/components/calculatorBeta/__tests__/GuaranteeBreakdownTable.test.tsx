import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen, within } from '@testing-library/dom';
import GuaranteeBreakdownTable from '../GuaranteeBreakdownTable';
import type { GuaranteeRow } from '../../../utils/guaranteeBreakdown';

const rows: GuaranteeRow[] = [
  {
    key: 'K',
    label: 'K',
    kind: 'primario',
    target: 15,
    obtained: 15,
    contributions: [{ materialId: 'kcl', name: 'KCL', percent: 15 }],
  },
  {
    key: 'B',
    label: 'B',
    kind: 'micro',
    target: 1,
    obtained: 0.75,
    contributions: [
      { materialId: 'ulx', name: 'Ulexita', percent: 0.5 },
      { materialId: 'kcl', name: 'KCL', percent: 0.25 },
    ],
  },
  {
    key: 'ZN',
    label: 'Zn',
    kind: 'micro',
    target: 0,
    obtained: 0.5,
    contributions: [{ materialId: 'kcl', name: 'KCL', percent: 0.5 }],
  },
  { key: 'CU', label: 'Cu', kind: 'micro', target: 0.1, obtained: 0, contributions: [] },
];

describe('GuaranteeBreakdownTable', () => {
  it('mostra status, origem e micros sem meta', () => {
    render(<GuaranteeBreakdownTable rows={rows} />);
    expect(screen.getByText('Somatória das garantias na batida')).toBeTruthy();
    expect(screen.getByText(/1 sem meta/)).toBeTruthy();
    const table = screen.getByRole('table');
    const rowOf = (label: string) =>
      within(table)
        .getAllByRole('row')
        .find((tr) => tr.textContent?.startsWith(label))!;
    expect(within(rowOf('K')).getByText('Atingida')).toBeTruthy();
    expect(within(rowOf('B')).getByText('Abaixo')).toBeTruthy();
    expect(rowOf('B').textContent).toMatch(/Ulexita\s*0,50.*KCL\s*0,25/);
    expect(within(rowOf('Zn')).getByText('Sem meta')).toBeTruthy();
    expect(within(rowOf('Cu')).getByText(/Nenhum produto da batida/)).toBeTruthy();
  });

  it('não renderiza sem linhas', () => {
    const { container } = render(<GuaranteeBreakdownTable rows={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
