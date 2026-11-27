import { describe, expect, it } from 'vitest';
import { permissoesPedido } from '../pedidosVendaModel';

describe('permissões de Pedidos de Venda', () => {
  it('admin e master podem tudo', () => {
    expect(permissoesPedido({ role: 'admin', permissions: {} })).toEqual({
      ver: true,
      criar: true,
      editar: true,
      cancelar: true,
      excluir: true,
    });
  });

  it('demais seguem cada permissão (ausente = não pode)', () => {
    expect(
      permissoesPedido({
        role: 'user',
        permissions: { pedidosVenda: true, pedidosVenda_create: true, pedidosVenda_edit: false },
      })
    ).toEqual({ ver: true, criar: true, editar: false, cancelar: false, excluir: false });
  });
});
