import React, { useState, useEffect, useCallback } from 'react';
import { User, PedidoVenda } from '../types';
import { ClipboardList, RefreshCw, Search, Eye, X, FileText, Tag } from 'lucide-react';
import { getPedidosVenda, updatePedidoVenda } from '../services/pedidosVendaService';
import { getPricingRecords } from '../services/db';
import { useToast } from './Toast';

const STATUS_LABEL: Record<PedidoVenda['status'], string> = {
  pendente: 'Pendente',
  em_carregamento: 'Em Carregamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<PedidoVenda['status'], string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  em_carregamento: 'bg-purple-100 text-purple-800 border-purple-200',
  concluido: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

function fmtBRL(v?: number) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

interface EnrichedPedido extends PedidoVenda {
  clientName?: string;
  clientDeliveryAddress?: string;
  produto?: string;
  tipoFrete?: string;
  vendedor?: string;
  precificacaoCod?: string;
}

interface PedidosVendaProps {
  currentUser: User;
}

export default function PedidosVenda({ currentUser }: PedidosVendaProps) {
  const { showSuccess, showError } = useToast();
  const [pedidos, setPedidos] = useState<EnrichedPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingPedido, setViewingPedido] = useState<EnrichedPedido | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pedidosData, pricingsData] = await Promise.all([
        getPedidosVenda(),
        getPricingRecords(),
      ]);

      const pricingsMap = new Map(pricingsData.map((pr) => [pr.id, pr]));

      const enriched: EnrichedPedido[] = pedidosData.map((p) => {
        const pricing = pricingsMap.get(p.precificacao_id);
        const client = pricing?.factors?.client;
        const addr = client?.deliveryAddress ?? client?.address;
        const deliveryStr = addr
          ? [addr.street, addr.number, addr.neighborhood, addr.city, addr.state]
              .filter(Boolean)
              .join(', ')
          : undefined;

        const formulaName =
          pricing?.calculations?.[0]?.formula || pricing?.factors?.targetFormula || undefined;

        return {
          ...p,
          clientName: client?.name,
          clientDeliveryAddress: deliveryStr,
          produto: formulaName,
          tipoFrete:
            pricing?.factors?.freight != null ? (pricing.factors as any).tipoFrete : undefined,
          vendedor: pricing?.userName,
          precificacaoCod: pricing?.formattedCod || (pricing?.cod ? `#${pricing.cod}` : undefined),
        };
      });

      // Filter by seller for non-admin users
      const filtered =
        currentUser.role === 'master' || currentUser.role === 'admin'
          ? enriched
          : enriched.filter((p) => {
              const pricing = pricingsMap.get(p.precificacao_id);
              return pricing?.userId === currentUser.id;
            });

      setPedidos(filtered);
    } catch {
      showError('Erro ao carregar pedidos de venda.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, status: PedidoVenda['status']) => {
    try {
      await updatePedidoVenda(id, { status });
      showSuccess('Status atualizado!');
      await load();
      if (viewingPedido?.id === id) {
        setViewingPedido((prev) => (prev ? { ...prev, status } : null));
      }
    } catch {
      showError('Erro ao atualizar status.');
    }
  };

  const filtered = pedidos.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barra_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.precificacaoCod?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-emerald-600" />
            Pedidos de Venda
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Precificações vinculadas a pedidos de venda importados
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nº pedido, cliente ou precificação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as PedidoVenda['status'][]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm">Pedidos de Venda ({filtered.length})</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum pedido de venda encontrado</p>
            <p className="text-xs mt-1 text-stone-400">
              Importe um PDF de pedido dentro de uma precificação para que ela apareça aqui
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Nº Pedido / Barra</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Qtd. Real</th>
                  <th className="px-4 py-3">Embalagem</th>
                  <th className="px-4 py-3">Frete</th>
                  <th className="px-4 py-3">Valor Unit.</th>
                  <th className="px-4 py-3">Valor Total</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Precificação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-stone-700 text-xs">
                      {p.numero_pedido || '—'}
                      {p.barra_pedido && (
                        <span className="ml-1 text-stone-400">/ {p.barra_pedido}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{p.clientName || '—'}</td>
                    <td className="px-4 py-3 text-stone-600 text-xs max-w-[140px] truncate">
                      {p.produto || '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-mono text-xs">
                      {p.quantidade_real != null
                        ? `${p.quantidade_real.toLocaleString('pt-BR')} ton`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{p.embalagem || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.tipo_frete ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${p.tipo_frete === 'CIF' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                        >
                          {p.tipo_frete}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-700 text-xs">
                      {fmtBRL(p.valor_unitario_negociado)}
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-bold text-xs">
                      {fmtBRL(p.valor_total_negociado)}
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{fmtDate(p.data_pedido)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.precificacaoCod && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-mono font-bold">
                          <Tag className="w-3 h-3" />
                          {p.precificacaoCod}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingPedido(p)}
                        className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewingPedido && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-emerald-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Pedido de Venda
              </h2>
              <button
                onClick={() => setViewingPedido(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Nº Pedido</p>
                  <p className="font-mono font-bold text-stone-800 text-lg">
                    {viewingPedido.numero_pedido || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Barra</p>
                  <p className="font-mono font-bold text-stone-800 text-lg">
                    {viewingPedido.barra_pedido || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Cliente</p>
                  <p className="text-stone-800 font-medium">{viewingPedido.clientName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Vencimento</p>
                  <p className="text-stone-800">{fmtDate(viewingPedido.data_pedido)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Produto</p>
                  <p className="text-stone-800">{viewingPedido.produto || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Vendedor</p>
                  <p className="text-stone-800">{viewingPedido.vendedor || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Qtd. Real (ton)</p>
                  <p className="text-stone-800 font-bold">
                    {viewingPedido.quantidade_real != null
                      ? viewingPedido.quantidade_real.toLocaleString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Embalagem</p>
                  <p className="text-stone-800">{viewingPedido.embalagem || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Tipo de Frete</p>
                  <p className="text-stone-800">
                    {viewingPedido.tipo_frete ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${viewingPedido.tipo_frete === 'CIF' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {viewingPedido.tipo_frete}
                      </span>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Valor Unitário</p>
                  <p className="text-stone-800 font-bold">
                    {fmtBRL(viewingPedido.valor_unitario_negociado)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">Valor Total</p>
                  <p className="text-stone-800 font-black text-xl text-emerald-700">
                    {fmtBRL(viewingPedido.valor_total_negociado)}
                  </p>
                </div>
                {viewingPedido.tipo_frete === 'CIF' && viewingPedido.valor_frete != null && (
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Valor do Frete (R$/ton)
                    </p>
                    <p className="text-stone-800 font-bold">{fmtBRL(viewingPedido.valor_frete)}</p>
                  </div>
                )}
                {viewingPedido.clientDeliveryAddress && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Endereço de Entrega
                    </p>
                    <p className="text-stone-800">{viewingPedido.clientDeliveryAddress}</p>
                  </div>
                )}
              </div>

              {/* Referência Precificação */}
              {viewingPedido.precificacaoCod && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Referência da Precificação
                  </p>
                  <p className="font-mono font-bold text-emerald-800 text-lg">
                    {viewingPedido.precificacaoCod}
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase mb-2">Status do Pedido</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABEL) as PedidoVenda['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(viewingPedido.id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        viewingPedido.status === s
                          ? STATUS_COLOR[s]
                          : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF link */}
              {viewingPedido.pdf_url && (
                <div>
                  <a
                    href={viewingPedido.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm hover:bg-stone-200 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Ver PDF do Pedido
                  </a>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end">
              <button
                onClick={() => setViewingPedido(null)}
                className="px-6 py-2 bg-stone-800 text-white rounded-lg font-bold hover:bg-stone-900 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
