import { StatusCarregamento, TipoFrete } from '../types/carregamento';

export function getStatusInicial(_tipoFrete: TipoFrete): StatusCarregamento {
  return 'aguardando_liberacao';
}
