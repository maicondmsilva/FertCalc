import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import BetaClientPicker from '../BetaClientPicker';

const clients = [
  {
    id: 'c1',
    code: '7',
    name: 'Fazenda Boa Vista',
    document: '529.982.247-25',
    fazenda: 'Faz. Boa Vista',
  },
  { id: 'c2', code: '8', name: 'Agro Santa Rita', document: '11.222.333/0001-81' },
] as never;

function Harness() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id?: string; name?: string; code?: string }>({});
  return (
    <BetaClientPicker
      clients={clients}
      selected={selected}
      search={search}
      onSearchChange={setSearch}
      onSelect={(client) => setSelected(client as never)}
    />
  );
}

describe('BetaClientPicker', () => {
  it('busca por documento sem pontuação, escolhe e permite trocar', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Buscar cliente/);
    fireEvent.change(input, { target: { value: '11222333' } });
    fireEvent.click(screen.getByText('Agro Santa Rita'));
    expect(screen.getByText('Agro Santa Rita')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar cliente/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar cliente' }));
    expect(screen.getByPlaceholderText(/Buscar cliente/)).toBeTruthy();
  });

  it('avisa quando não encontra', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar cliente/), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum cliente encontrado.')).toBeTruthy();
  });
});
