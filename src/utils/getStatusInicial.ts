import { StatusCarregamento, TipoFrete } from '../types/carregamento';

export function getStatusInicial(tipoFrete: TipoFrete): StatusCarregamento {
  return tipoFrete === 'FOB' ? 'aguardando_liberacao' : 'aguardando_cotacao';
}
