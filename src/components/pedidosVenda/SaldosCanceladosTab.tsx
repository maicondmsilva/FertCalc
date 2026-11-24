import React, { useCallback, useEffect, useState } from 'react';
import { Ban, RefreshCw, Search } from 'lucide-react';
import {
  getSaldosCancelados,
  type CancelamentoRelatorioRow,
} from '../../services/pedidosVendaService';
import { useToast } from '../Toast';

interface SaldosCanceladosTabProps {
  onOpenPedido: (pedidoId: string) => void;
}

/** Aba "Saldos cancelados": cancelamentos definitivos com filtros e paginação. */
export function SaldosCanceladosTab({ onOpenPedido }: SaldosCanceladosTabProps) {
  const { showError } = useToast();
  const [cancelamentos, setCancelamentos] = useState<CancelamentoRelatorioRow[]>([]);
  const [loadingCancelamentos, setLoadingCancelamentos] = useState(false);
  const [cancelamentosError, setCancelamentosError] = useState<string | null>(null);
  const [cancelamentosPage, setCancelamentosPage] = useState(1);
  const [cancelamentosTotal, setCancelamentosTotal] = useState(0);
  const [cancelamentosQuantidade, setCancelamentosQuantidade] = useState(0);
  const [cancSearch, setCancSearch] = useState('');
  const [cancDataInicio, setCancDataInicio] = useState('');
  const [cancDataFim, setCancDataFim] = useState('');
  const openPedidoById = (id: string) => onOpenPedido(id);

  const loadCancelamentos = useCallback(async () => {
    setLoadingCancelamentos(true);
    setCancelamentosError(null);
    try {
      const result = await getSaldosCancelados(
        {
          busca: cancSearch || undefined,
          dataInicio: cancDataInicio || undefined,
          dataFim: cancDataFim || undefined,
        },
        cancelamentosPage,
        20
      );
      setCancelamentos(result.data);
      setCancelamentosTotal(result.total);
      setCancelamentosQuantidade(result.totalQuantidade);
    } catch {
      setCancelamentosError('Não foi possível carregar os saldos cancelados. Tente novamente.');
      showError('Erro ao carregar cancelamentos.');
    } finally {
      setLoadingCancelamentos(false);
    }
  }, [cancDataFim, cancDataInicio, cancSearch, cancelamentosPage, showError]);

  useEffect(() => {
    const timer = setTimeout(() => void loadCancelamentos(), 300);
    return () => clearTimeout(timer);
  }, [loadCancelamentos]);

  useEffect(() => {
    setCancelamentosPage(1);
  }, [cancSearch, cancDataInicio, cancDataFim]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por pedido, cliente, I.E., produto ou usuário..."
              value={cancSearch}
              onChange={(e) => setCancSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <input
              type="date"
              value={cancDataInicio}
              onChange={(e) => setCancDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="De"
              title="Data Início"
            />
          </div>
          <div>
            <input
              type="date"
              value={cancDataFim}
              onChange={(e) => setCancDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Até"
              title="Data Fim"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            Cancelamentos encontrados
          </p>
          <p className="mt-1 text-2xl font-black text-stone-800">{cancelamentosTotal}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-red-500">
            Quantidade cancelada
          </p>
          <p className="mt-1 text-2xl font-black text-red-700">
            {cancelamentosQuantidade.toLocaleString('pt-BR', {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            ton
          </p>
        </div>
      </div>

      {/* Table */}
      {loadingCancelamentos ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : cancelamentosError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
          <p>{cancelamentosError}</p>
          <button
            type="button"
            onClick={() => void loadCancelamentos()}
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-bold hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      ) : cancelamentos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200 shadow-sm text-stone-400">
          <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum cancelamento definitivo de saldo encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Pedido</th>
                  <th className="px-5 py-3">Cliente / Fazenda</th>
                  <th className="px-5 py-3 text-right">Qtd. Cancelada</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3">Data / Hora</th>
                  <th className="px-5 py-3">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {cancelamentos.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold">
                      {c.pedidoOrigemDisponivel ? (
                        <button
                          type="button"
                          onClick={() => openPedidoById(c.pedido_origem_id)}
                          className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                        >
                          {c.pedidoOrigemNome || '—'}
                        </button>
                      ) : (
                        <span className="text-stone-400">{c.pedidoOrigemNome || '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-stone-800 font-medium block">
                        {c.pedidoOrigemCliente || '—'}
                      </span>
                      {c.pedidoOrigemIe && (
                        <span className="text-stone-500 text-xs block">
                          I.E. {c.pedidoOrigemIe}
                        </span>
                      )}
                      {c.pedidoOrigemFazenda && (
                        <span className="text-stone-400 text-xs block">
                          {c.pedidoOrigemFazenda}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-red-600">
                      {c.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ton
                    </td>
                    <td className="px-5 py-4 text-stone-600 max-w-xs truncate" title={c.motivo}>
                      {c.motivo || '—'}
                    </td>
                    <td className="px-5 py-4 text-stone-500 text-xs">
                      {c.criado_em ? new Date(c.criado_em).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-4 text-stone-700 font-medium">
                      {c.usuario_nome || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cancelamentosTotal > 20 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 px-5 py-3 sm:flex-row">
              <span className="text-xs text-stone-500">
                Página {cancelamentosPage} de {Math.ceil(cancelamentosTotal / 20)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCancelamentosPage((page) => Math.max(1, page - 1))}
                  disabled={cancelamentosPage === 1}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCancelamentosPage((page) => page + 1)}
                  disabled={cancelamentosPage >= Math.ceil(cancelamentosTotal / 20)}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
