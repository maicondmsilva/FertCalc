import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const deleteNutriente = vi.fn();
vi.mock('../../services/nutrientesService', () => ({
  createNutriente: vi.fn(),
  updateNutriente: vi.fn(),
  deleteNutriente: (id: string) => deleteNutriente(id),
}));

import NutrientManager from './NutrientManager';
import type { Nutriente } from '../../services/nutrientesService';
import { ToastProvider } from '../Toast';

const nutrientes = [
  { id: 'zn', sigla: 'Zn', nome: 'Zinco', tipo: 'micro', aliases: [], ordem: 20, ativo: true },
  { id: 'fe', sigla: 'Fe', nome: 'Ferro', tipo: 'micro', aliases: [], ordem: 50, ativo: true },
] as Nutriente[];

const renderManager = (onChanged = vi.fn(), canManage = true) =>
  render(
    <ToastProvider>
      <NutrientManager nutrientes={nutrientes} canManage={canManage} onChanged={onChanged} />
    </ToastProvider>
  );

describe('excluir nutriente', () => {
  it('confirma, exclui e recarrega a lista', async () => {
    deleteNutriente.mockResolvedValueOnce(undefined);
    const onChanged = vi.fn();
    renderManager(onChanged);
    fireEvent.click(screen.getAllByTitle('Excluir')[1]);
    expect(await screen.findByText('Excluir Fe – Ferro?')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(deleteNutriente).toHaveBeenCalledWith('fe'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('mostra o motivo quando o nutriente está em uso', async () => {
    deleteNutriente.mockRejectedValueOnce({
      message: 'O nutriente Zn está nas garantias de 11 produto(s).',
    });
    const onChanged = vi.fn();
    renderManager(onChanged);
    fireEvent.click(screen.getAllByTitle('Excluir')[0]);
    await screen.findByText('Excluir Zn – Zinco?');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText(/garantias de 11 produto/)).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('quem não é admin não vê excluir', () => {
    renderManager(vi.fn(), false);
    expect(screen.queryByTitle('Excluir')).toBeNull();
  });
});
