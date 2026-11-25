import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../services/db', () => ({
  getBrands: vi.fn().mockResolvedValue([{ id: 'b1', code: 'MAR-01', name: 'Yara' }]),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
}));

import BrandManager from '../BrandManager';

describe('cadastro de marcas conforme a permissão do banco', () => {
  it('quem não é admin vê a lista em modo leitura, sem formulário nem ações', async () => {
    render(<BrandManager canManage={false} />);
    expect(await screen.findByText('Yara')).toBeTruthy();
    expect(screen.getByText(/Somente leitura/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Yara, Mosaic/)).toBeNull();
    expect(screen.queryByTitle('Excluir')).toBeNull();
    expect(screen.queryByTitle('Editar')).toBeNull();
  });

  it('admin vê o formulário e as ações', async () => {
    render(<BrandManager canManage />);
    expect(await screen.findByText('Yara')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Yara, Mosaic/)).toBeTruthy();
    expect(screen.getByTitle('Excluir')).toBeTruthy();
  });
});
