import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { PedidoVenda } from '../../types';
import {
  STATUS_LABEL,
  STATUS_STYLE,
  diasSemMovimento,
  formatDate,
  formatTon,
  isPedidoParado,
  pedidoLabel,
  pedidoProgress,
} from './pedidosVendaModel';

interface PedidosCarteiraTableProps {
  pedidos: PedidoVenda[];
  selectedId?: string | null;
  diasParado: number;
  onSelect: (pedido: PedidoVenda) => void;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Tabela da carteira (desktop) e cartões (celular). Clique abre o detalhe. */
export function PedidosCarteiraTable({
  pedidos,
  selectedId,
  diasParado,
  onSelect,
}: PedidosCarteiraTableProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3 text-right">Vendido</th>
              <th className="w-44 px-4 py-3">Carregado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Status</th>
              <th className="w-8" aria-label="Abrir" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {pedidos.map((pedido) => {
              const progress = pedidoProgress(pedido);
              const parado = isPedidoParado(pedido, diasParado);
              const selected = pedido.id === selectedId;
              return (
                <tr
                  key={pedido.id}
                  onClick={() => onSelect(pedido)}
                  className={`cursor-pointer transition-colors ${
                    selected ? 'bg-emerald-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(pedido);
                      }}
                      className="font-mono text-[14px] font-black text-stone-900 hover:text-emerald-700"
                    >
                      {pedidoLabel(pedido)}
                    </button>
                    <p className="text-xs text-stone-500">
                      {formatDate(pedido.data_pedido || pedido.criado_em)}
                      {pedido.safra ? ` · Safra ${pedido.safra}` : ''}
                    </p>
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <p className="truncate text-[14px] font-semibold text-stone-800">
                      {pedido.cliente_nome || 'Cliente não informado'}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {pedido.vendedor_nome ? `Vendedor: ${pedido.vendedor_nome}` : ''}
                      {pedido.cliente_ie ? ` · I.E. ${pedido.cliente_ie}` : ''}
                    </p>
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="truncate text-sm text-stone-700" title={pedido.produto_nome}>
                      {pedido.produto_nome || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-stone-800">
                    {formatTon(progress.total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>{formatTon(progress.carregado)}</span>
                      <span>{Math.round(progress.percent)}%</span>
                    </div>
                    <ProgressBar percent={progress.percent} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm font-black ${
                        progress.saldo > 0 ? 'text-emerald-700' : 'text-stone-400'
                      }`}
                    >
                      {formatTon(progress.saldo)}
                    </span>
                    {parado && (
                      <span
                        className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-bold text-amber-700"
                        title="Saldo sem nova solicitação de carga"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {diasSemMovimento(pedido)} dias parado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[pedido.status]}`}
                    >
                      {STATUS_LABEL[pedido.status]}
                    </span>
                  </td>
                  <td className="pr-3 text-stone-300">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular */}
      <div className="divide-y divide-stone-100 md:hidden">
        {pedidos.map((pedido) => {
          const progress = pedidoProgress(pedido);
          const parado = isPedidoParado(pedido, diasParado);
          return (
            <button
              key={pedido.id}
              type="button"
              onClick={() => onSelect(pedido)}
              className={`block w-full px-4 py-3 text-left ${
                pedido.id === selectedId ? 'bg-emerald-50' : 'active:bg-stone-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[15px] font-black text-stone-900">
                    {pedidoLabel(pedido)}
                  </p>
                  <p className="truncate text-sm font-semibold text-stone-700">
                    {pedido.cliente_nome || 'Cliente não informado'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[pedido.status]}`}
                >
                  {STATUS_LABEL[pedido.status]}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                <span>
                  {formatTon(progress.carregado)} de {formatTon(progress.total)}
                </span>
                <span className="font-bold text-emerald-700">
                  Saldo {formatTon(progress.saldo)}
                </span>
              </div>
              <div className="mt-1">
                <ProgressBar percent={progress.percent} />
              </div>
              {parado && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> {diasSemMovimento(pedido)} dias parado
                </p>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
