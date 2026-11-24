import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, FileSpreadsheet, FileText, GitBranch, RefreshCw, Search } from 'lucide-react';
import {
  getCancelamentosRelatorio,
  getSaldosCancelados,
  type CancelamentoRelatorioRow,
} from '../../services/pedidosVendaService';
import { getAppSettings } from '../../services/db';
import {
  GROUP_LABEL,
  MODE_TITLE,
  buildCancelamentosSheetRows,
  createCancelamentosPdf,
  filterCancelamentos,
  formatQtd,
  groupCancelamentos,
  reportColumns,
  reportRowValues,
  summarizeCancelamentos,
  type CancelamentoGroupBy,
  type CancelamentoReportMode,
} from '../../utils/cancelamentosReport';
import { useToast } from '../Toast';
import Pagination from '../ui/Pagination';

interface CancelamentosReportViewProps {
  mode: CancelamentoReportMode;
  onOpenPedido: (pedidoId: string) => void;
}

const MAX_ROWS = 5000;
const input =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

/** Relatório de Canc/Substitui ou de saldos cancelados, com agrupamento e exportação. */
export function CancelamentosReportView({ mode, onOpenPedido }: CancelamentosReportViewProps) {
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState<CancelamentoRelatorioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [emitenteOrigem, setEmitenteOrigem] = useState('');
  const [emitenteDestino, setEmitenteDestino] = useState('');
  const [groupBy, setGroupBy] = useState<CancelamentoGroupBy>('cliente');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === 'canc_substitui'
          ? await getCancelamentosRelatorio(
              {
                tipo: 'canc_substitui',
                dataInicio: dataInicio || undefined,
                dataFim: dataFim || undefined,
                emitenteOrigem: emitenteOrigem ? Number(emitenteOrigem) : undefined,
                emitenteDestino: emitenteDestino ? Number(emitenteDestino) : undefined,
              },
              1,
              MAX_ROWS
            )
          : await getSaldosCancelados(
              { dataInicio: dataInicio || undefined, dataFim: dataFim || undefined },
              1,
              MAX_ROWS
            );
      setRows(result.data);
    } catch {
      setError('Não foi possível carregar o relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [mode, dataInicio, dataFim, emitenteOrigem, emitenteDestino]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(
    () => setPage(1),
    [busca, groupBy, dataInicio, dataFim, emitenteOrigem, emitenteDestino]
  );

  const filtered = useMemo(() => filterCancelamentos(rows, busca), [rows, busca]);
  const groups = useMemo(() => groupCancelamentos(filtered, groupBy), [filtered, groupBy]);
  const summary = useMemo(() => summarizeCancelamentos(filtered), [filtered]);
  const columns = reportColumns(mode);

  // Sem agrupamento a paginação é por registro; agrupado, por grupo.
  const pagedUnits = groupBy === 'nenhum' ? filtered : groups;
  const totalPages = Math.max(1, Math.ceil(pagedUnits.length / pageSize));
  const start = (page - 1) * pageSize;
  const visibleGroups =
    groupBy === 'nenhum'
      ? [{ key: 'todos', label: '', rows: filtered.slice(start, start + pageSize), quantidade: 0 }]
      : groups.slice(start, start + pageSize);

  const filtersText = () => {
    const parts = [
      busca.trim() ? `Busca: ${busca.trim()}` : '',
      dataInicio ? `De ${dataInicio.split('-').reverse().join('/')}` : '',
      dataFim ? `Até ${dataFim.split('-').reverse().join('/')}` : '',
      emitenteOrigem ? `Emitente origem ${emitenteOrigem}` : '',
      emitenteDestino ? `Emitente destino ${emitenteDestino}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Nenhum filtro aplicado';
  };

  const fileBase = mode === 'canc_substitui' ? 'canc-substitui' : 'saldos-cancelados';

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const settings = await getAppSettings().catch(() => null);
      createCancelamentosPdf({ mode, groupBy, groups, filtersText: filtersText(), settings }).save(
        `relatorio-${fileBase}.pdf`
      );
      showSuccess('PDF gerado.');
    } catch {
      showError('Não foi possível gerar o PDF.');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(buildCancelamentosSheetRows(groups, mode, groupBy));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        book,
        sheet,
        mode === 'canc_substitui' ? 'Canc-Substitui' : 'Saldos cancelados'
      );
      XLSX.writeFile(book, `relatorio-${fileBase}.xlsx`);
    } catch {
      showError('Não foi possível gerar a planilha.');
    } finally {
      setExporting(null);
    }
  };

  const Icon = mode === 'canc_substitui' ? GitBranch : Ban;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-stone-800">
          <Icon className="h-5 w-5 text-stone-400" /> {MODE_TITLE[mode]}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Atualizar relatório"
            className="grid h-10 w-10 place-items-center rounded-xl border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={filtered.length === 0 || exporting !== null}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> {exporting === 'excel' ? 'Gerando…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={filtered.length === 0 || exporting !== null}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {exporting === 'pdf' ? 'Gerando…' : 'PDF'}
          </button>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
            mode === 'canc_substitui'
              ? 'lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]'
              : 'lg:grid-cols-[2fr_1fr_1fr]'
          }`}
        >
          <label className="relative block">
            <span className="sr-only">Buscar</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pedido, cliente, I.E., produto, usuário ou motivo"
              className={`${input} pl-9`}
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
            <span className="sr-only">Data inicial</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              title="Data inicial"
              className={input}
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
            <span className="sr-only">Data final</span>
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              title="Data final"
              className={input}
            />
          </label>
          {mode === 'canc_substitui' && (
            <>
              <input
                type="number"
                min={1}
                value={emitenteOrigem}
                onChange={(event) => setEmitenteOrigem(event.target.value)}
                placeholder="Emitente origem"
                aria-label="Emitente de origem"
                className={input}
              />
              <input
                type="number"
                min={1}
                value={emitenteDestino}
                onChange={(event) => setEmitenteDestino(event.target.value)}
                placeholder="Emitente destino"
                aria-label="Emitente de destino"
                className={input}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Agrupar</span>
          <div
            className="inline-flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1"
            role="radiogroup"
            aria-label="Agrupar relatório"
          >
            {(Object.keys(GROUP_LABEL) as CancelamentoGroupBy[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={groupBy === option}
                onClick={() => setGroupBy(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  groupBy === option
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {GROUP_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Registros', value: String(summary.registros) },
          {
            label: mode === 'canc_substitui' ? 'Quantidade substituída' : 'Quantidade cancelada',
            value: formatQtd(summary.quantidade),
            accent: true,
          },
          { label: 'Clientes', value: String(summary.clientes) },
          { label: 'Pedidos', value: String(summary.pedidos) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{card.label}</p>
            <p
              className={`mt-1 text-2xl font-black ${card.accent ? (mode === 'definitivo' ? 'text-red-700' : 'text-orange-700') : 'text-stone-900'}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-bold hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      ) : loading && rows.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white py-14 text-center text-sm text-stone-400">
          Carregando…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white py-14 text-center text-stone-400">
          <Icon className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-2 text-sm">Nenhum registro encontrado com estes filtros.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <section
              key={group.key}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            >
              {groupBy !== 'nenhum' && (
                <header className="flex flex-wrap items-center justify-between gap-2 bg-stone-900 px-4 py-2.5 text-white">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{group.label}</p>
                    {'subtitle' in group && group.subtitle && (
                      <p className="truncate text-xs text-stone-300">{group.subtitle}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold">
                    {group.rows.length} registro(s) · {formatQtd(group.quantidade)}
                  </p>
                </header>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-3 py-2.5">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {group.rows.map((row) => {
                      const values = reportRowValues(row, mode);
                      const quantityIndex = mode === 'canc_substitui' ? 7 : 5;
                      return (
                        <tr key={row.id} className="hover:bg-stone-50">
                          {values.map((value, index) => (
                            <td
                              key={columns[index]}
                              className={`px-3 py-2.5 ${
                                index === quantityIndex
                                  ? `whitespace-nowrap text-right font-mono font-bold ${mode === 'definitivo' ? 'text-red-600' : 'text-orange-600'}`
                                  : index === 0
                                    ? 'whitespace-nowrap text-xs text-stone-500'
                                    : columns[index] === 'Motivo'
                                      ? 'max-w-[220px] truncate text-stone-600'
                                      : 'text-stone-700'
                              }`}
                              title={columns[index] === 'Motivo' ? value : undefined}
                            >
                              {index === 1 && row.pedidoOrigemDisponivel ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenPedido(row.pedido_origem_id)}
                                  className="font-mono font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                                >
                                  {value}
                                </button>
                              ) : index === 2 &&
                                mode === 'canc_substitui' &&
                                row.pedido_destino_id &&
                                row.pedidoDestinoDisponivel ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenPedido(row.pedido_destino_id!)}
                                  className="font-mono font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                                >
                                  {value}
                                </button>
                              ) : (
                                value
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={pagedUnits.length}
            firstItemNumber={pagedUnits.length === 0 ? 0 : start + 1}
            lastItemNumber={Math.min(pagedUnits.length, start + pageSize)}
            pageSize={pageSize}
            pageSizeOptions={[12, 25, 50]}
            itemLabel={groupBy === 'nenhum' ? 'registros' : 'grupos'}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
          {rows.length >= MAX_ROWS && (
            <p className="text-center text-xs text-amber-700">
              Mostrando os {MAX_ROWS} registros mais recentes. Use o período para refinar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
