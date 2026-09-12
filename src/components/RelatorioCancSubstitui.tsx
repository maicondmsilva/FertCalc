import React, { useState, useEffect, useCallback } from 'react';
import {
  CancelamentoRelatorioRow,
  getCancelamentosRelatorio,
} from '../services/pedidosVendaService';
import {
  FileText,
  Search,
  RefreshCw,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
} from 'lucide-react';
import { useToast } from './Toast';

interface RelatorioCancSubstituiProps {
  currentUser: { id: string; name: string };
  onOpenPedido?: (pedidoId: string) => void;
}

type TipoFiltro = '' | 'canc_substitui' | 'definitivo';

const PAGE_SIZE = 20;

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtQtd(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ton';
}

export default function RelatorioCancSubstitui({ onOpenPedido }: RelatorioCancSubstituiProps) {
  const { showError } = useToast();
  const [cancelamentos, setCancelamentos] = useState<CancelamentoRelatorioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [page, setPage] = useState(1);
  const [totalOperacoes, setTotalOperacoes] = useState(0);
  const [totalQtdDesmembrada, setTotalQtdDesmembrada] = useState(0);
  const [totalDefinitivos, setTotalDefinitivos] = useState(0);

  // Pending filter state (not yet applied)
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('');
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [emitenteOrigem, setEmitenteOrigem] = useState('');
  const [emitenteDestino, setEmitenteDestino] = useState('');

  // Applied filter state (used for actual filtering and display in PDF)
  const [appliedFilters, setAppliedFilters] = useState({
    dataInicio: '',
    dataFim: '',
    numeroPedido: '',
    clienteNome: '',
    tipoFiltro: '' as TipoFiltro,
    usuarioFiltro: '',
    emitenteOrigem: '',
    emitenteDestino: '',
  });

  const load = useCallback(
    async (filters: typeof appliedFilters, requestedPage = 1) => {
      setLoading(true);
      try {
        const result = await getCancelamentosRelatorio(
          {
            tipo: filters.tipoFiltro || undefined,
            dataInicio: filters.dataInicio || undefined,
            dataFim: filters.dataFim || undefined,
            numeroPedido: filters.numeroPedido || undefined,
            clienteNome: filters.clienteNome || undefined,
            usuarioNome: filters.usuarioFiltro || undefined,
            emitenteOrigem: filters.emitenteOrigem ? Number(filters.emitenteOrigem) : undefined,
            emitenteDestino: filters.emitenteDestino ? Number(filters.emitenteDestino) : undefined,
          },
          requestedPage,
          PAGE_SIZE
        );
        setCancelamentos(result.data);
        setTotalOperacoes(result.total);
        setTotalQtdDesmembrada(result.totalQuantidade);
        setTotalDefinitivos(result.totalDefinitivos);
        setPage(requestedPage);
      } catch {
        showError('Erro ao carregar relatório de Canc/Substitui.');
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  useEffect(() => {
    load(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltrar = () => {
    const newFilters = {
      dataInicio,
      dataFim,
      numeroPedido,
      clienteNome,
      tipoFiltro,
      usuarioFiltro,
      emitenteOrigem,
      emitenteDestino,
    };
    setAppliedFilters(newFilters);
    load(newFilters, 1);
  };

  const handleLimparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setNumeroPedido('');
    setClienteNome('');
    setTipoFiltro('');
    setUsuarioFiltro('');
    setEmitenteOrigem('');
    setEmitenteDestino('');
    const cleared = {
      dataInicio: '',
      dataFim: '',
      numeroPedido: '',
      clienteNome: '',
      tipoFiltro: '' as TipoFiltro,
      usuarioFiltro: '',
      emitenteOrigem: '',
      emitenteDestino: '',
    };
    setAppliedFilters(cleared);
    load(cleared, 1);
  };

  const totalPages = Math.max(1, Math.ceil(totalOperacoes / PAGE_SIZE));
  const paginated = cancelamentos;

  const loadExportRows = async () =>
    (
      await getCancelamentosRelatorio(
        {
          tipo: appliedFilters.tipoFiltro || undefined,
          dataInicio: appliedFilters.dataInicio || undefined,
          dataFim: appliedFilters.dataFim || undefined,
          numeroPedido: appliedFilters.numeroPedido || undefined,
          clienteNome: appliedFilters.clienteNome || undefined,
          usuarioNome: appliedFilters.usuarioFiltro || undefined,
          emitenteOrigem: appliedFilters.emitenteOrigem
            ? Number(appliedFilters.emitenteOrigem)
            : undefined,
          emitenteDestino: appliedFilters.emitenteDestino
            ? Number(appliedFilters.emitenteDestino)
            : undefined,
        },
        1,
        5000
      )
    ).data;

  const buildPdfFiltersText = () => {
    const parts: string[] = [];
    if (appliedFilters.dataInicio) parts.push(`De: ${appliedFilters.dataInicio}`);
    if (appliedFilters.dataFim) parts.push(`Até: ${appliedFilters.dataFim}`);
    if (appliedFilters.numeroPedido) parts.push(`Nº Pedido: ${appliedFilters.numeroPedido}`);
    if (appliedFilters.clienteNome) parts.push(`Cliente: ${appliedFilters.clienteNome}`);
    if (appliedFilters.tipoFiltro)
      parts.push(
        `Tipo: ${appliedFilters.tipoFiltro === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo'}`
      );
    if (appliedFilters.usuarioFiltro) parts.push(`Usuário: ${appliedFilters.usuarioFiltro}`);
    if (appliedFilters.emitenteOrigem) parts.push(`Emit. Origem: ${appliedFilters.emitenteOrigem}`);
    if (appliedFilters.emitenteDestino)
      parts.push(`Emit. Destino: ${appliedFilters.emitenteDestino}`);
    return parts.length > 0 ? parts.join(' | ') : 'Nenhum filtro aplicado';
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const rowsToExport = await loadExportRows();
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF({ orientation: 'landscape' });

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('FertCalc — Relatório de Canc/Substitui', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 21);
      doc.text(`Filtros: ${buildPdfFiltersText()}`, 14, 27);

      autoTable(doc, {
        startY: 33,
        head: [
          [
            'Nº Pedido / Emit. Orig.',
            'Pedido Destino / Emit.',
            'Cliente Origem',
            'Cliente Destino',
            'Produto',
            'Qtd Original',
            'Qtd Desm.',
            'Saldo Restante',
            'Tipo',
            'Data',
            'Usuário',
            'Motivo',
          ],
        ],
        body: rowsToExport.map((c) => [
          c.pedidoOrigemNome ?? '—',
          c.pedidoDestinoNome ?? '—',
          `${c.pedidoOrigemCliente ?? '—'}${c.pedidoOrigemIe ? `\nI.E. ${c.pedidoOrigemIe}` : ''}`,
          `${c.pedidoDestinoCliente ?? '—'}${c.pedidoDestinoIe ? `\nI.E. ${c.pedidoDestinoIe}` : ''}`,
          c.pedidoOrigemProduto ?? '—',
          c.pedidoOrigemQtd != null ? fmtQtd(c.pedidoOrigemQtd) : '—',
          fmtQtd(c.quantidade),
          c.pedidoSaldoRestante != null ? fmtQtd(c.pedidoSaldoRestante) : '—',
          c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo',
          fmtDate(c.criado_em),
          c.usuario_nome ?? '—',
          c.motivo ?? '—',
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105], fontStyle: 'bold' },
        foot: [
          [
            `Total: ${totalOperacoes} operações`,
            '',
            '',
            '',
            '',
            '',
            fmtQtd(totalQtdDesmembrada),
            '',
            `${totalDefinitivos} definitivos`,
            '',
            '',
            '',
          ],
        ],
        footStyles: {
          fillColor: [245, 245, 244],
          textColor: [68, 64, 60],
          fontStyle: 'bold',
          fontSize: 7,
        },
      });

      doc.save('relatorio-canc-substitui.pdf');
    } catch {
      showError('Não foi possível gerar o relatório em PDF.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportXLSX = async () => {
    setExporting('excel');
    try {
      const rowsToExport = await loadExportRows();
      const XLSX = await import('xlsx');
      const rows = rowsToExport.map((c) => ({
        'Nº Pedido / Emit. Orig.': c.pedidoOrigemNome ?? '—',
        'Pedido Destino / Emit.': c.pedidoDestinoNome ?? '—',
        'Cliente Origem': c.pedidoOrigemCliente ?? '—',
        'I.E. Origem': c.pedidoOrigemIe ?? '—',
        'Cliente Destino': c.pedidoDestinoCliente ?? '—',
        'I.E. Destino': c.pedidoDestinoIe ?? '—',
        Produto: c.pedidoOrigemProduto ?? '—',
        'Qtd Original (ton)': c.pedidoOrigemQtd != null ? c.pedidoOrigemQtd : '',
        'Qtd Desmembrada (ton)': c.quantidade,
        'Saldo Restante (ton)': c.pedidoSaldoRestante != null ? c.pedidoSaldoRestante : '',
        Tipo: c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo',
        Data: fmtDate(c.criado_em),
        Usuário: c.usuario_nome ?? '—',
        Motivo: c.motivo ?? '—',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Column widths
      ws['!cols'] = [
        { wch: 22 },
        { wch: 14 },
        { wch: 24 },
        { wch: 16 },
        { wch: 24 },
        { wch: 16 },
        { wch: 28 },
        { wch: 18 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 40 },
      ];

      // Bold header row
      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = { font: { bold: true } };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Canc-Substitui');
      XLSX.writeFile(wb, 'relatorio-canc-substitui.xlsx');
    } catch {
      showError('Não foi possível gerar o relatório em Excel.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-700 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          Relatório de Canc/Substitui
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleExportPDF()}
            disabled={loading || exporting !== null || cancelamentos.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5" />
            {exporting === 'pdf' ? 'Preparando…' : 'PDF'}
          </button>
          <button
            onClick={() => void handleExportXLSX()}
            disabled={loading || exporting !== null || cancelamentos.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting === 'excel' ? 'Preparando…' : 'Excel'}
          </button>
          <button
            onClick={() => load(appliedFilters)}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Nº Pedido
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
                placeholder="600500/1"
                className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
                placeholder="Nome do cliente"
                className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Todos</option>
              <option value="canc_substitui">Canc/Substitui</option>
              <option value="definitivo">Definitivo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Usuário</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={usuarioFiltro}
                onChange={(e) => setUsuarioFiltro(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
                placeholder="Nome do usuário"
                className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Emitente Origem
            </label>
            <input
              type="number"
              value={emitenteOrigem}
              onChange={(e) => setEmitenteOrigem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
              placeholder="ex: 1"
              min={1}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Emitente Destino
            </label>
            <input
              type="number"
              value={emitenteDestino}
              onChange={(e) => setEmitenteDestino(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
              placeholder="ex: 2"
              min={1}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleFiltrar}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
          </button>
          <button
            onClick={handleLimparFiltros}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : cancelamentos.length === 0 ? (
        <div className="text-center py-10 text-stone-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Nº Pedido / Emit. Orig.</th>
                <th className="px-4 py-3 whitespace-nowrap">Pedido Destino / Emit.</th>
                <th className="px-4 py-3">Cliente Origem</th>
                <th className="px-4 py-3">Cliente Destino</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 whitespace-nowrap">Qtd Original</th>
                <th className="px-4 py-3 whitespace-nowrap">Qtd Desmembrada</th>
                <th className="px-4 py-3 whitespace-nowrap">Saldo Restante</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 whitespace-nowrap">Data</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paginated.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                    {onOpenPedido && c.pedidoOrigemDisponivel ? (
                      <button
                        type="button"
                        onClick={() => onOpenPedido(c.pedido_origem_id)}
                        className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                      >
                        {c.pedidoOrigemNome ?? '—'}
                      </button>
                    ) : (
                      (c.pedidoOrigemNome ?? '—')
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {c.pedido_destino_id && onOpenPedido && c.pedidoDestinoDisponivel ? (
                      <button
                        type="button"
                        onClick={() => onOpenPedido(c.pedido_destino_id!)}
                        className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                      >
                        {c.pedidoDestinoNome ?? '—'}
                      </button>
                    ) : (
                      <span className="text-stone-500">{c.pedidoDestinoNome ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-[150px] truncate">
                    <span className="block truncate">{c.pedidoOrigemCliente ?? '—'}</span>
                    {c.pedidoOrigemIe && (
                      <span className="block text-[10px] text-stone-400">
                        I.E. {c.pedidoOrigemIe}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-[150px] truncate">
                    <span className="block truncate">{c.pedidoDestinoCliente ?? '—'}</span>
                    {c.pedidoDestinoIe && (
                      <span className="block text-[10px] text-stone-400">
                        I.E. {c.pedidoDestinoIe}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-[150px] truncate">
                    {c.pedidoOrigemProduto ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-600 text-xs whitespace-nowrap">
                    {c.pedidoOrigemQtd != null ? fmtQtd(c.pedidoOrigemQtd) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-700 text-xs font-bold whitespace-nowrap">
                    {fmtQtd(c.quantidade)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {c.pedidoSaldoRestante != null ? (
                      <span
                        className={`font-bold ${c.pedidoSaldoRestante > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {fmtQtd(c.pedidoSaldoRestante)}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                        c.tipo === 'canc_substitui'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                    {fmtDate(c.criado_em)}
                  </td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{c.usuario_nome ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs max-w-[200px] truncate">
                    {c.motivo ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer: totalizadores + paginação */}
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Totalizadores */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <span>
                <span className="font-bold text-stone-700">{totalOperacoes}</span>{' '}
                {totalOperacoes !== 1 ? 'operações' : 'operação'}
              </span>
              <span>
                Qtd total desmembrada:{' '}
                <span className="font-bold text-stone-700">{fmtQtd(totalQtdDesmembrada)}</span>
              </span>
              <span>
                Definitivos: <span className="font-bold text-red-700">{totalDefinitivos}</span>
              </span>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <button
                  onClick={() => void load(appliedFilters, Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Pág. <span className="font-bold text-stone-700">{page}</span> de{' '}
                  <span className="font-bold text-stone-700">{totalPages}</span>
                </span>
                <button
                  onClick={() => void load(appliedFilters, Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
