import React, { useState } from 'react';
import { User, PedidoVenda, Client } from '../../types';
import { Truck, Package, AlertTriangle, RefreshCw, LayoutList, LayoutGrid } from 'lucide-react';
import { Carregamento, StatusCarregamento } from '../../types/carregamento';
import KanbanLogistico from './KanbanLogistico';
import { TabelaCarregamentos } from './VisaoGeral';
import { StatusBadge, fmtCarregamentoNum, fmtDate } from './shared';

export function LiberacaoCarregamento({
  carregamentos,
  loading,
  onAction,
  canLiberar,
  clients = [],
  pedidos = [],
}: {
  carregamentos: Carregamento[];
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
  canLiberar?: boolean;
  clients?: Client[];
  pedidos?: PedidoVenda[];
}) {
  const prontos = carregamentos.filter(
    (c) =>
      ['aguardando_liberacao', 'liberado_parcial', 'em_carregamento'].includes(c.status) &&
      c.quantidade_liberada < c.quantidade_total - (c.quantidade_cancelada || 0)
  );
  const liberados = carregamentos.filter((c) => c.status === 'liberado_total');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm">
            Prontos para Liberação ({prontos.length})
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Pedidos com cotação aprovada aguardando liberação
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : (
          <TabelaCarregamentos
            carregamentos={prontos}
            onAction={onAction}
            showActions={['liberar', 'execucoes']}
            canLiberar={canLiberar}
            clients={clients}
            pedidos={pedidos}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm">Liberados ({liberados.length})</h3>
        </div>
        <TabelaCarregamentos carregamentos={liberados} clients={clients} pedidos={pedidos} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Painel de Logística
// ─────────────────────────────────────────────────────────────────────────────
export function PainelLogistica({
  carregamentos,
  loading,
  onAction,
  canAceitar,
  currentUser,
  onUpdateStatus,
}: {
  carregamentos: Carregamento[];
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
  canAceitar?: boolean;
  currentUser?: User;
  onUpdateStatus?: (carregamentoId: string, newStatus: StatusCarregamento) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');

  const canUseKanban = !!(
    currentUser &&
    (currentUser.role === 'master' ||
      currentUser.role === 'admin' ||
      currentUser.permissions?.carregamento_logistica)
  );
  const cif = carregamentos.filter(
    (c) => c.tipo_frete === 'CIF' && c.status !== 'cancelado' && c.status !== 'carregado'
  );
  const fob = carregamentos.filter(
    (c) => c.tipo_frete === 'FOB' && c.status !== 'cancelado' && c.status !== 'carregado'
  );

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const URGENCY_THRESHOLD_DAYS = 7;

  const isUrgent = (c: Carregamento) =>
    c.data_prevista_carregamento === today || c.data_prevista_carregamento === tomorrow;

  // pedido_data_vencimento is a PostgreSQL DATE column returned as 'YYYY-MM-DD'.
  // Appending 'T00:00:00' ensures parsing in local timezone (not UTC midnight).
  const isVencimentoUrgente = (c: Carregamento) => {
    if (!c.pedido_data_vencimento) return false;
    const venc = new Date(c.pedido_data_vencimento + 'T00:00:00');
    const diff = (venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= URGENCY_THRESHOLD_DAYS;
  };

  const isVencimentoAtrasado = (c: Carregamento) => {
    if (!c.pedido_data_vencimento) return false;
    return new Date(c.pedido_data_vencimento + 'T00:00:00') < new Date();
  };

  return (
    <div className="space-y-6">
      {/* View Toggle Header */}
      {canUseKanban && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-stone-500 font-medium">Visualização:</span>
          <div className="flex items-center bg-stone-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                viewMode === 'lista'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && canUseKanban && onUpdateStatus && (
        <KanbanLogistico
          carregamentos={carregamentos.filter((c) => c.status !== 'cancelado')}
          onUpdateStatus={onUpdateStatus}
        />
      )}

      {/* Lista View */}
      {(viewMode === 'lista' || !canUseKanban) && (
        <>
          {/* CIF Section */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="p-4 border-b border-stone-100 bg-blue-50/50">
              <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Pedidos CIF — Informar Transportador ({cif.length})
              </h3>
              <p className="text-xs text-blue-600 mt-0.5">
                A logística deve informar o transportador para pedidos CIF
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
              </div>
            ) : cif.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <p className="text-sm">Nenhum pedido CIF pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {cif.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 flex items-center justify-between gap-3 ${
                      isVencimentoAtrasado(c)
                        ? 'bg-red-50 border-l-4 border-red-400'
                        : isVencimentoUrgente(c) || isUrgent(c)
                          ? 'bg-orange-50 border-l-4 border-orange-400'
                          : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {(isUrgent(c) || isVencimentoUrgente(c) || isVencimentoAtrasado(c)) && (
                        <AlertTriangle
                          className={`w-4 h-4 flex-shrink-0 ${isVencimentoAtrasado(c) ? 'text-red-500' : 'text-orange-500'}`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Linha 1: número do carregamento + número do pedido de venda */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-emerald-600 text-sm">
                            {fmtCarregamentoNum(c)}
                          </p>
                          {c.pedido_venda_numero && (
                            <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">
                              PV: {c.pedido_venda_numero}
                            </span>
                          )}
                        </div>

                        {/* Linha 2: cliente */}
                        {c.pedido_cliente_nome && (
                          <p className="text-xs font-medium text-stone-700 mt-0.5 truncate">
                            👤 {c.pedido_cliente_nome}
                          </p>
                        )}

                        {/* Linha 3: produto */}
                        {c.pedido_produto_nome && (
                          <p className="text-xs text-stone-500 truncate">
                            📦 {c.pedido_produto_nome}
                          </p>
                        )}

                        {/* Linha 4: quantidade, data prevista, vencimento */}
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <p className="text-xs text-stone-500">
                            <span className="font-medium">{c.quantidade_total} ton</span> —
                            Previsto: {fmtDate(c.data_prevista_carregamento)}
                          </p>
                          {c.pedido_data_vencimento && (
                            <p className="text-xs text-amber-600 font-medium">
                              ⏳ Venc: {fmtDate(c.pedido_data_vencimento)}
                            </p>
                          )}
                        </div>

                        {/* Linha 5: saldo do pedido */}
                        {c.pedido_saldo_disponivel != null && c.pedido_quantidade_real != null && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-stone-400">Saldo do pedido:</span>
                            <span
                              className={`text-xs font-bold ${c.pedido_saldo_disponivel > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                            >
                              {c.pedido_saldo_disponivel.toLocaleString('pt-BR')} /{' '}
                              {c.pedido_quantidade_real.toLocaleString('pt-BR')} ton
                            </span>
                          </div>
                        )}

                        {/* Linha 6: transportadora */}
                        {c.transportadora && (
                          <p className="text-xs text-blue-600 font-medium mt-0.5">
                            🚛 {c.transportadora.nome}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <button
                        onClick={() => onAction(c, 'transportador')}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {c.transportadora ? 'Atualizar' : 'Informar'}
                      </button>
                      {canAceitar !== false &&
                        ['liberado_total', 'liberado_parcial', 'em_carregamento'].includes(
                          c.status
                        ) && (
                          <button
                            onClick={() => onAction(c, 'execucoes')}
                            className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                          >
                            Execuções
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOB Section */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="p-4 border-b border-stone-100 bg-amber-50/50">
              <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Pedidos FOB — Liberar na Data Prevista ({fob.length})
              </h3>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
              </div>
            ) : fob.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <p className="text-sm">Nenhum pedido FOB pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {fob.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 flex items-center justify-between gap-3 ${
                      isVencimentoAtrasado(c)
                        ? 'bg-red-50 border-l-4 border-red-400'
                        : isVencimentoUrgente(c) || isUrgent(c)
                          ? 'bg-orange-50 border-l-4 border-orange-400'
                          : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {(isUrgent(c) || isVencimentoUrgente(c) || isVencimentoAtrasado(c)) && (
                        <AlertTriangle
                          className={`w-4 h-4 flex-shrink-0 ${isVencimentoAtrasado(c) ? 'text-red-500' : 'text-orange-500'}`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Linha 1: número do carregamento + número do pedido de venda */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-emerald-600 text-sm">
                            {fmtCarregamentoNum(c)}
                          </p>
                          {c.pedido_venda_numero && (
                            <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">
                              PV: {c.pedido_venda_numero}
                            </span>
                          )}
                        </div>

                        {/* Linha 2: cliente */}
                        {c.pedido_cliente_nome && (
                          <p className="text-xs font-medium text-stone-700 mt-0.5 truncate">
                            👤 {c.pedido_cliente_nome}
                          </p>
                        )}

                        {/* Linha 3: produto */}
                        {c.pedido_produto_nome && (
                          <p className="text-xs text-stone-500 truncate">
                            📦 {c.pedido_produto_nome}
                          </p>
                        )}

                        {/* Linha 4: quantidade, data prevista, vencimento */}
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <p className="text-xs text-stone-500">
                            <span className="font-medium">{c.quantidade_total} ton</span> —
                            Previsto:{' '}
                            <span className={isUrgent(c) ? 'font-bold text-orange-600' : ''}>
                              {fmtDate(c.data_prevista_carregamento)}
                            </span>
                          </p>
                          {c.pedido_data_vencimento && (
                            <p className="text-xs text-amber-600 font-medium">
                              ⏳ Venc: {fmtDate(c.pedido_data_vencimento)}
                            </p>
                          )}
                        </div>

                        {/* Linha 5: saldo do pedido */}
                        {c.pedido_saldo_disponivel != null && c.pedido_quantidade_real != null && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-stone-400">Saldo do pedido:</span>
                            <span
                              className={`text-xs font-bold ${c.pedido_saldo_disponivel > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                            >
                              {c.pedido_saldo_disponivel.toLocaleString('pt-BR')} /{' '}
                              {c.pedido_quantidade_real.toLocaleString('pt-BR')} ton
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      {canAceitar !== false &&
                        ['liberado_total', 'liberado_parcial', 'em_carregamento'].includes(
                          c.status
                        ) && (
                          <button
                            onClick={() => onAction(c, 'execucoes')}
                            className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                          >
                            Execuções
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Calendário
// ─────────────────────────────────────────────────────────────────────────────
