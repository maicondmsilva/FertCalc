import React, { useState, useEffect, useCallback } from 'react';
import { User, PedidoVenda, Branch } from '../types';
import { ClipboardList, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getPedidosVenda, updatePedidoVenda } from '../services/pedidosVendaService';
import { getBranches } from '../services/db';
import { useToast } from './Toast';
import NovoPedidoVendaModal from './NovoPedidoVendaModal';

const STATUS_LABEL: Record<PedidoVenda['status'], string> = {
  pendente: 'Ativo',
  em_carregamento: 'Em Carregamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<PedidoVenda['status'], string> = {
  pendente: 'bg-emerald-100 text-emerald-800',
  em_carregamento: 'bg-purple-100 text-purple-800',
  concluido: 'bg-blue-100 text-blue-800',
  cancelado: 'bg-red-100 text-red-800',
};

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

interface PedidosVendaProps {
  currentUser: User;
}

export default function PedidosVenda({ currentUser }: PedidosVendaProps) {
  const { showSuccess, showError } = useToast();
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filialFilter, setFilialFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pedidosData, branchesData] = await Promise.all([getPedidosVenda(), getBranches()]);
      setPedidos(pedidosData);
      setBranches(branchesData);
    } catch {
      showError('Erro ao carregar pedidos de venda.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStatusChange = async (id: string, status: PedidoVenda['status']) => {
    try {
      await updatePedidoVenda(id, { status });
      showSuccess('Status atualizado!');
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch {
      showError('Erro ao atualizar status.');
    }
  };

  const filtered = pedidos.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchFilial = !filialFilter || p.filial_id === filialFilter;
    return matchSearch && matchStatus && matchFilial;
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
          <p className="text-stone-500 text-sm mt-1">Gerencie seus pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNovoPedido(true)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />+ Novo Pedido
          </button>
          <button
            onClick={load}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por nº pedido ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
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
          <select
            value={filialFilter}
            onChange={(e) => setFilialFilter(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="">Todas as filiais</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pedido de venda encontrado</p>
          <p className="text-xs mt-1 text-stone-400">
            Crie um novo pedido usando o botão acima ou a partir de uma precificação
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-500 font-medium">
            {filtered.length} pedido{filtered.length !== 1 ? 's' : ''} encontrado
            {filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.map((p) => {
            const isExpanded = expandedIds.has(p.id);
            const saldo = p.saldo_disponivel ?? null;

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-stone-50 transition-colors"
                  onClick={() => toggleExpand(p.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">📋</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-stone-800 text-sm">
                          {p.numero_pedido || '—'}
                        </span>
                        {p.cliente_nome && (
                          <span className="text-stone-500 text-sm truncate">
                            | {p.cliente_nome}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-1">
                        <span className="text-xs text-stone-400">{fmtDate(p.data_pedido)}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[p.status]}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                        {saldo != null && (
                          <span className="text-xs text-stone-500">
                            Saldo:{' '}
                            <span
                              className={`font-bold ${saldo > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                            >
                              {saldo.toLocaleString('pt-BR')} ton
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="ml-3 p-1 text-stone-400 hover:text-stone-600 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-stone-100 px-5 py-4 space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                          <tr>
                            <th className="pb-2 pr-4">Produto</th>
                            <th className="pb-2 pr-4">Qtd. Pedida</th>
                            <th className="pb-2 pr-4">Qtd. Carregada</th>
                            <th className="pb-2 pr-4">Saldo</th>
                            <th className="pb-2">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 pr-4 font-medium text-stone-800">
                              {p.produto_nome || '—'}
                            </td>
                            <td className="py-2 pr-4 text-stone-700 font-mono">
                              {p.quantidade_real != null
                                ? `${p.quantidade_real.toLocaleString('pt-BR')} ton`
                                : '—'}
                            </td>
                            <td className="py-2 pr-4 text-stone-700 font-mono">
                              {p.quantidade_carregada != null
                                ? `${p.quantidade_carregada.toLocaleString('pt-BR')} ton`
                                : '—'}
                            </td>
                            <td className="py-2 pr-4">
                              {saldo != null ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${saldo > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                                >
                                  {saldo.toLocaleString('pt-BR')} ton
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2">
                              {saldo != null && saldo > 0 && p.status !== 'cancelado' && (
                                <button
                                  onClick={() =>
                                    // TODO: Fase 8 — Carregamento via Pedido de Venda
                                    showSuccess('Funcionalidade em desenvolvimento')
                                  }
                                  className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                >
                                  🚛 Solicitar Carregamento
                                </button>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Extra info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-stone-100">
                      {p.condicao_pagamento && (
                        <div>
                          <p className="font-bold text-stone-400 uppercase mb-0.5">Pagamento</p>
                          <p className="text-stone-700">{p.condicao_pagamento}</p>
                        </div>
                      )}
                      {p.tipo_frete && (
                        <div>
                          <p className="font-bold text-stone-400 uppercase mb-0.5">Frete</p>
                          <p className="text-stone-700">{p.tipo_frete}</p>
                        </div>
                      )}
                      {p.preco_unitario != null && (
                        <div>
                          <p className="font-bold text-stone-400 uppercase mb-0.5">Preço Unit.</p>
                          <p className="text-stone-700">
                            R${' '}
                            {p.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {p.observacoes && (
                        <div className="col-span-2 md:col-span-4">
                          <p className="font-bold text-stone-400 uppercase mb-0.5">Observações</p>
                          <p className="text-stone-700">{p.observacoes}</p>
                        </div>
                      )}
                    </div>

                    {/* Status change */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                      {(Object.keys(STATUS_LABEL) as PedidoVenda['status'][]).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(p.id, s)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                            p.status === s
                              ? `${STATUS_COLOR[s]} border-current`
                              : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNovoPedido && (
        <NovoPedidoVendaModal
          pricing={null}
          currentUser={currentUser}
          onClose={() => setShowNovoPedido(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
