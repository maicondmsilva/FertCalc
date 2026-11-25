import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GuaranteeSumStrip from '../GuaranteeSumStrip';
import type { GuaranteeRow } from '../../../utils/guaranteeBreakdown';

const row = (label: string, obtained: number, target = 0): GuaranteeRow => ({
  key: label.toUpperCase(),
  label,
  kind: 'micro',
  target,
  obtained,
  contributions: [{ materialId: 'x', name: 'Produto X', percent: obtained }],
});

describe('GuaranteeSumStrip', () => {
  it('mostra as garantias em sequência, sem nomes de produtos', () => {
    const { container } = render(
      <GuaranteeSumStrip rows={[row('N', 4), row('P', 21), row('K', 30), row('Zn', 0.1)]} />
    );
    expect(container.textContent).toContain('N - 4,00P - 21,00K - 30,00Zn - 0,10');
    expect(container.textContent).not.toContain('Produto X');
  });

  it('destaca o que ficou abaixo da meta', () => {
    const { getByTitle } = render(<GuaranteeSumStrip rows={[row('B', 0.2, 0.3)]} />);
    expect(getByTitle('Meta 0,30').className).toContain('text-amber-700');
  });

  it('não renderiza sem garantias', () => {
    const { container } = render(<GuaranteeSumStrip rows={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
