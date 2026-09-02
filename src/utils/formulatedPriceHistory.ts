import { HistoricoPrecoFormulado } from '../services/historicoPrecoService';

export interface FormulatedPriceHistoryFilters {
  localId?: string;
  priceListId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterFormulatedPriceHistory(
  entries: HistoricoPrecoFormulado[],
  filters: FormulatedPriceHistoryFilters
): HistoricoPrecoFormulado[] {
  const start = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : undefined;
  const end = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : undefined;

  return entries.filter((entry) => {
    const timestamp = new Date(entry.registrado_em).getTime();
    return (
      (!filters.localId || entry.local_carregamento_id === filters.localId) &&
      (!filters.priceListId || entry.price_list_id === filters.priceListId) &&
      (start === undefined || timestamp >= start) &&
      (end === undefined || timestamp <= end)
    );
  });
}
