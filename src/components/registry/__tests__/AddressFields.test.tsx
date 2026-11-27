import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import type { Address } from '../../../types';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('../../../services/cepService', () => ({ buscarCep: lookup }));

import AddressFields from '../AddressFields';
import { CepServiceUnavailableError } from '../../../utils/formatters';
import { emptyAddress } from '../registryModel';

function Harness() {
  const [address, setAddress] = useState<Address>(emptyAddress());
  return <AddressFields idPrefix="t" value={address} onChange={setAddress} />;
}

describe('AddressFields', () => {
  it('busca o CEP sozinho ao completar 8 dígitos e preenche o endereço', async () => {
    lookup.mockResolvedValue({
      street: 'Rua Goiás',
      neighborhood: 'Centro',
      city: 'Rio Verde',
      state: 'GO',
    });
    render(<Harness />);
    const cep = screen.getByLabelText('CEP');
    fireEvent.change(cep, { target: { value: '7590' } });
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.change(cep, { target: { value: '75900000' } });
    await waitFor(() => expect(screen.getByDisplayValue('Rio Verde')).toBeTruthy());
    expect(lookup).toHaveBeenCalledWith('75900-000');
    expect(screen.getByDisplayValue('Rua Goiás')).toBeTruthy();
    expect(screen.getByDisplayValue('Centro')).toBeTruthy();
    expect((screen.getByLabelText('UF') as HTMLSelectElement).value).toBe('GO');
    expect((cep as HTMLInputElement).value).toBe('75900-000');
  });

  it('CEP não encontrado avisa para preencher à mão', async () => {
    lookup.mockResolvedValue(null);
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '00000000' } });
    expect(await screen.findByText(/CEP não encontrado/)).toBeTruthy();
  });

  it('avisa quando o serviço de CEP não responde', async () => {
    lookup.mockRejectedValue(new CepServiceUnavailableError());
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '75900000' } });
    await waitFor(() => expect(screen.getByText(/serviço de CEP não respondeu/i)).toBeTruthy());
  });
});
