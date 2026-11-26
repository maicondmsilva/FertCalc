import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
vi.mock('../../../services/regionService', () => ({
  listRegions: vi.fn(),
  listUserRegions: vi.fn(),
}));

import PricingRegionField, { pricingRegionProblem } from '../PricingRegionField';
import TransferRegionModal from '../TransferRegionModal';
import { defaultRegionId, type MyRegions } from '../../../hooks/useMyRegions';

const a = { id: 'a', name: 'Triângulo', ativo: true };
const b = { id: 'b', name: 'Sul de Goiás', ativo: true };
const regions = (over: Partial<MyRegions>): MyRegions => ({
  options: [a, b],
  all: [a, b],
  principalId: 'b',
  orgHasRegions: true,
  loading: false,
  ...over,
});

describe('região da precificação', () => {
  it('escolhe a principal ou a única', () => {
    expect(defaultRegionId([a, b], 'b')).toBe('b');
    expect(defaultRegionId([a, b], '')).toBe('');
    expect(defaultRegionId([a], '')).toBe('a');
  });

  it('só exige região quando a empresa tem regiões', () => {
    expect(pricingRegionProblem(regions({ orgHasRegions: false, options: [] }), '')).toBeNull();
    expect(pricingRegionProblem(regions({ options: [] }), '')).toMatch(/não tem região/);
    expect(pricingRegionProblem(regions({}), '')).toMatch(/Escolha a região/);
    expect(pricingRegionProblem(regions({}), 'x')).toMatch(/Escolha a região/);
    expect(pricingRegionProblem(regions({}), 'a')).toBeNull();
  });

  it('campo: várias regiões com ★, uma fixa, nenhuma em vermelho, oculto sem regiões', () => {
    const { rerender, container } = render(
      <PricingRegionField id="r" regions={regions({})} value="b" onChange={() => undefined} />
    );
    expect(screen.getByRole('option', { name: '★ Sul de Goiás (principal)' })).toBeTruthy();
    rerender(
      <PricingRegionField id="r" regions={regions({ options: [a] })} onChange={() => undefined} />
    );
    expect(screen.getByText('sua região')).toBeTruthy();
    rerender(
      <PricingRegionField id="r" regions={regions({ options: [] })} onChange={() => undefined} />
    );
    expect(screen.getByText('Nenhuma região')).toBeTruthy();
    rerender(
      <PricingRegionField
        id="r"
        regions={regions({ orgHasRegions: false, options: [] })}
        onChange={() => undefined}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('transferência exige motivo e não oferece a região atual', () => {
    const onConfirm = vi.fn();
    render(
      <TransferRegionModal
        pricing={{ id: 'p', regionId: 'a', factors: { client: { name: 'Fazenda' } } } as never}
        regions={[a, b]}
        saving={false}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />
    );
    expect(screen.queryByRole('option', { name: 'Triângulo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
    expect(screen.getByRole('alert').textContent).toMatch(/motivo/);
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'cliente mudou de equipe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
    expect(onConfirm).toHaveBeenCalledWith('b', 'cliente mudou de equipe');
  });
});
