import React, { useState, useEffect, useCallback } from 'react';
import { CancelamentoPedido, PedidoVenda } from '../types';
import { getCancelamentos, getPedidosVenda } from '../services/pedidosVendaService';
import { FileText, Search, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { useToast } from './Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface RelatorioCancSubstituiProps {
  currentUser: { id: string; name: string };
}

type TipoFiltro = '' | 'canc_substitui' | 'definitivo';

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtQtd(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' ton';
}

interface EnrichedCancelamento extends CancelamentoPedido {
  pedidoOrigemNome?: string;
  pedidoOrigemCliente?: string;
  pedidoOrigemProduto?: string;
  pedidoOrigemQtd?: number;
  pedidoDestinoNome?: string;
}

export default function RelatorioCancSubstitui({ currentUser }: RelatorioCancSubstituiProps) {
  const { showError } = useToast();
  const [cancelamentos, setCancelamentos] = useState<EnrichedCancelamento[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, pedidos] = await Promise.all([
        getCancelamentos({
          tipo: tipoFiltro || undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }),
        getPedidosVenda(),
      ]);

      const pedidosMap = new Map<string, PedidoVenda>(pedidos.map((p) => [p.id, p]));

      const enriched: EnrichedCancelamento[] = logs.map((log) => {
        const origem = pedidosMap.get(log.pedido_origem_id);
        const destino = log.pedido_destino_id ? pedidosMap.get(log.pedido_destino_id) : undefined;

        const origemNome =
          origem?.barra_pedido ||
          (origem?.numero_pedido
            ? `${origem.numero_pedido}/${origem.emitente ?? 1}`
            : log.pedido_origem_id.slice(0, 8));

        const destinoNome = destino
          ? destino.barra_pedido ||
            (destino.numero_pedido
              ? `${destino.numero_pedido}/${destino.emitente ?? 1}`
              : log.pedido_destino_id?.slice(0, 8))
          : '—';

        return {
          ...log,
          pedidoOrigemNome: origemNome,
          pedidoOrigemCliente: origem?.cliente_nome,
          pedidoOrigemProduto: origem?.produto_nome,
          pedidoOrigemQtd: origem?.quantidade_original ?? origem?.quantidade_real,
          pedidoDestinoNome: destinoNome,
        };
      });

      setCancelamentos(enriched);
    } catch {
      showError('Erro ao carregar relatório de Canc/Substitui.');
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro, dataInicio, dataFim, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = cancelamentos.filter((c) => {
    const matchNumero =
      !numeroPedido ||
      (c.pedidoOrigemNome ?? '').toLowerCase().includes(numeroPedido.toLowerCase()) ||
      (c.pedidoDestinoNome ?? '').toLowerCase().includes(numeroPedido.toLowerCase());
    const matchCliente =
      !clienteNome ||
      (c.pedidoOrigemCliente ?? '').toLowerCase().includes(clienteNome.toLowerCase());
    return matchNumero && matchCliente;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Relatório de Canc/Substitui', 14, 14);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 20);

    autoTable(doc, {
      startY: 25,
      head: [
        [
          'Nº Pedido / Emitente',
          'Cliente',
          'Produto',
          'Qtd Original',
          'Qtd Canc/Subst',
          'Novo Emitente',
          'Data',
          'Usuário',
          'Motivo',
          'Tipo',
        ],
      ],
      body: filtered.map((c) => [
        c.pedidoOrigemNome ?? '—',
        c.pedidoOrigemCliente ?? '—',
        c.pedidoOrigemProduto ?? '—',
        c.pedidoOrigemQtd != null ? fmtQtd(c.pedidoOrigemQtd) : '—',
        fmtQtd(c.quantidade),
        c.pedidoDestinoNome ?? '—',
        fmtDate(c.criado_em),
        c.usuario_nome ?? '—',
        c.motivo ?? '—',
        c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105] },
    });

    doc.save('relatorio-canc-substitui.pdf');
  };

  const handleExportXLSX = () => {
    const rows = filtered.map((c) => ({
      'Nº Pedido / Emitente': c.pedidoOrigemNome ?? '—',
      Cliente: c.pedidoOrigemCliente ?? '—',
      Produto: c.pedidoOrigemProduto ?? '—',
      'Qtd Original': c.pedidoOrigemQtd != null ? c.pedidoOrigemQtd : '',
      'Qtd Canc/Subst': c.quantidade,
      'Novo Emitente': c.pedidoDestinoNome ?? '—',
      Data: fmtDate(c.criado_em),
      Usuário: c.usuario_nome ?? '—',
      Motivo: c.motivo ?? '—',
      Tipo: c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Canc-Substitui');
    XLSX.writeFile(wb, 'relatorio-canc-substitui.xlsx');
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
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={load}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-stone-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Nº Pedido / Emit.</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Qtd Original</th>
                <th className="px-4 py-3">Qtd Desmembrada</th>
                <th className="px-4 py-3">Novo Emitente</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-stone-800">
                    {c.pedidoOrigemNome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-[150px] truncate">
                    {c.pedidoOrigemCliente ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-[150px] truncate">
                    {c.pedidoOrigemProduto ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-600 text-xs">
                    {c.pedidoOrigemQtd != null ? fmtQtd(c.pedidoOrigemQtd) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-700 text-xs font-bold">
                    {fmtQtd(c.quantidade)}
                  </td>
                  <td className="px-4 py-3 font-mono text-stone-600 text-xs">
                    {c.pedidoDestinoNome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{fmtDate(c.criado_em)}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{c.usuario_nome ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs max-w-[200px] truncate">
                    {c.motivo ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.tipo === 'canc_substitui'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {c.tipo === 'canc_substitui' ? 'Canc/Substitui' : 'Definitivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-stone-100 text-xs text-stone-400">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
