import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  FileText,
  Calendar,
  Tag,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
  Package,
  Truck,
  DollarSign,
} from 'lucide-react';
import { User as AppUser, PricingRecord } from '../types';
import type { PedidoVenda, PedidoVendaEnriquecido, StatusPedidoVenda } from '../types/pedidoVenda';
import { getPedidosVenda, updatePedidoStatus } from '../services/pedidosVendaService';
import { getPricingRecords } from '../services/db';
import { useToast } from './Toast';
import { PEDIDO_VENDA_STATUS } from '../constants/appConstants';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

const fmt = (v: number | undefined) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const fmtDate = (v: string | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR');
};

const fmtQty = (v: number | undefined) =>
  v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—';

const statusConfig: Record<StatusPedidoVenda, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-800' },
  em_carregamento: { label: 'Em Carregamento', color: 'bg-blue-100 text-blue-800' },
  concluido: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────

interface PedidosVendaProps {
  currentUser: AppUser;
}

export default function PedidosVenda({ currentUser }: PedidosVendaProps) {
  const { showSuccess, showError } = useToast();
  const [pedidos, setPedidos] = useState<PedidoVendaEnriquecido[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoVendaEnriquecido | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Load & enrich data ──────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const [rawPedidos, pricings] = await Promise.all([getPedidosVenda(), getPricingRecords()]);

      const pricingMap = new Map<string, PricingRecord>();
      pricings.forEach((p: PricingRecord) => pricingMap.set(p.id, p));

      const enriched: PedidoVendaEnriquecido[] = rawPedidos.map((pv: PedidoVenda) => {
        const pricing = pricingMap.get(pv.precificacao_id);
        return {
          ...pv,
          cliente_nome: pricing?.factors?.client?.name,
          vendedor_nome: pricing?.userName,
          vendedor_id: pricing?.userId,
          formulacao:
            pricing?.calculations?.map((c) => c.formula).join(', ') ||
            pricing?.factors?.targetFormula,
          precificacao_cod:
            pricing?.formattedCod ||
            (pricing?.cod ? String(pricing.cod).padStart(4, '0') : undefined),
        };
      });

      // Scope to current user unless admin/master
      const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';
      const scoped = isAdmin ? enriched : enriched.filter((p) => p.vendedor_id === currentUser.id);

      setPedidos(scoped);
    } catch {
      showError('Erro ao carregar pedidos de venda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // ── Filtering ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = pedidos;

    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.numero_pedido?.toLowerCase().includes(term) ||
          p.barra_pedido?.toLowerCase().includes(term) ||
          p.cliente_nome?.toLowerCase().includes(term) ||
          p.precificacao_cod?.toLowerCase().includes(term)
      );
    }

    if (startDate) {
      result = result.filter((p) => (p.data_pedido || p.criado_em) >= startDate);
    }
    if (endDate) {
      const endPlusOne = new Date(endDate);
      endPlusOne.setDate(endPlusOne.getDate() + 1);
      const endStr = endPlusOne.toISOString().slice(0, 10);
      result = result.filter((p) => (p.data_pedido || p.criado_em) < endStr);
    }

    return result;
  }, [pedidos, statusFilter, searchTerm, startDate, endDate]);

  // ── KPIs ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = pedidos.length;
    const pendente = pedidos.filter((p) => p.status === 'pendente').length;
    const emCarregamento = pedidos.filter((p) => p.status === 'em_carregamento').length;
    const concluido = pedidos.filter((p) => p.status === 'concluido').length;
    const valorTotal = pedidos
      .filter((p) => p.status !== 'cancelado')
      .reduce((sum, p) => sum + (p.valor_total_negociado ?? 0), 0);
    return { total, pendente, emCarregamento, concluido, valorTotal };
  }, [pedidos]);

  // ── Status change handler ───────────────────────────────────

  const handleChangeStatus = async (id: string, newStatus: StatusPedidoVenda) => {
    try {
      await updatePedidoStatus(id, newStatus);
      showSuccess('Status atualizado com sucesso!');
      await loadData();
      if (selectedPedido?.id === id) {
        setSelectedPedido((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      showError('Erro ao atualizar status.');
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total de Pedidos', value: stats.total, icon: FileText, color: 'stone' },
          { label: 'Pendentes', value: stats.pendente, icon: Tag, color: 'amber' },
          { label: 'Em Carregamento', value: stats.emCarregamento, icon: Truck, color: 'blue' },
          { label: 'Concluídos', value: stats.concluido, icon: Package, color: 'emerald' },
          { label: 'Valor Total', value: fmt(stats.valorTotal), icon: DollarSign, color: 'stone' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
              <span className="text-xs font-bold text-stone-500 uppercase">{kpi.label}</span>
            </div>
            <p className="text-xl font-black text-stone-800">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-stone-400 text-xs">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar nº pedido, cliente, precificação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos os Status</option>
            {PEDIDO_VENDA_STATUS.map((s) => (
              <option key={s} value={s}>
                {statusConfig[s].label}
              </option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="p-2 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
            title="Recarregar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            Nenhum pedido de venda encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Nº Pedido
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Produto
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Qtd Real
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Valor Unit.
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Valor Total
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Data
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Ref.
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-stone-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((p) => {
                  const cfg = statusConfig[p.status];
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-stone-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPedido(p)}
                    >
                      <td className="px-4 py-3 font-bold text-stone-800">
                        {p.numero_pedido || '—'}
                        {p.barra_pedido && (
                          <span className="text-xs text-stone-400 ml-1">/{p.barra_pedido}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{p.cliente_nome || '—'}</td>
                      <td className="px-4 py-3 text-stone-600 text-xs">{p.formulacao || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        {fmtQty(p.quantidade_real)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        {fmt(p.valor_unitario_negociado)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-stone-800">
                        {fmt(p.valor_total_negociado)}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-500">
                        {fmtDate(p.data_pedido || p.criado_em)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.precificacao_cod ? (
                          <span className="inline-block bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded">
                            #{p.precificacao_cod}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPedido(p);
                          }}
                          className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Detalhes"
                        >
                          <Eye className="w-4 h-4 text-stone-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPedido && (
        <PedidoDetalheModal
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
          onChangeStatus={handleChangeStatus}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Detail Modal
// ─────────────────────────────────────────────────────────────

function PedidoDetalheModal({
  pedido,
  onClose,
  onChangeStatus,
  currentUser,
}: {
  pedido: PedidoVendaEnriquecido;
  onClose: () => void;
  onChangeStatus: (id: string, status: StatusPedidoVenda) => Promise<void>;
  currentUser: AppUser;
}) {
  const cfg = statusConfig[pedido.status];
  const isAdmin = currentUser.role === 'master' || currentUser.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Pedido de Venda
            {pedido.numero_pedido && (
              <span className="text-emerald-600">
                #{pedido.numero_pedido}
                {pedido.barra_pedido && `/${pedido.barra_pedido}`}
              </span>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status badge + change buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${cfg.color}`}
            >
              {cfg.label}
            </span>
            {isAdmin && (
              <div className="flex gap-2 ml-auto">
                {PEDIDO_VENDA_STATUS.filter((s) => s !== pedido.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => onChangeStatus(pedido.id, s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${statusConfig[s].color} border-current hover:opacity-80`}
                  >
                    {statusConfig[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Cliente" value={pedido.cliente_nome} />
            <InfoRow label="Vendedor" value={pedido.vendedor_nome} />
            <InfoRow label="Formulação / Produto" value={pedido.formulacao} />
            <InfoRow
              label="Precificação"
              value={pedido.precificacao_cod ? `#${pedido.precificacao_cod}` : undefined}
            />
            <InfoRow
              label="Data do Pedido"
              value={fmtDate(pedido.data_pedido || pedido.criado_em)}
            />
            <InfoRow label="Embalagem" value={pedido.embalagem} />
            <InfoRow label="Tipo de Frete" value={pedido.tipo_frete} />
            <InfoRow label="Valor do Frete" value={fmt(pedido.valor_frete)} />
          </div>

          {/* Financial */}
          <div className="bg-stone-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-stone-500 uppercase font-bold">Qtd Real</p>
              <p className="text-lg font-black text-stone-800">{fmtQty(pedido.quantidade_real)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase font-bold">Valor Unit.</p>
              <p className="text-lg font-black text-stone-800">
                {fmt(pedido.valor_unitario_negociado)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase font-bold">Valor Total</p>
              <p className="text-lg font-black text-emerald-700">
                {fmt(pedido.valor_total_negociado)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 uppercase font-bold">{label}</p>
      <p className="text-stone-800 font-medium">{value || '—'}</p>
    </div>
  );
}
