import React, { useState, useEffect } from 'react';
import { Download, FileText, Filter, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { Carregamento, StatusCarregamento, Filial, Transportadora } from '../types/carregamento';
import { getCarregamentosRelatorio, getFiliais, getTransportadoras } from '../services/carregamentoService';
import { getPedidosVenda } from '../services/pedidosVendaService';
import { getExpenses } from '../services/expenseService';
import { PedidoVenda } from '../types';
import { CreditCardExpense } from '../types/expense.types';
import { exportToCSV } from '../utils/exportCsv';

interface RelatoriosProps {
  currentUser: User;
}

type TabId = 'carregamentos' | 'pedidos' | 'cartao';

const STATUS_LABELS: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'Aguardando Cotação',
  cotacao_solicitada: 'Cotação Solicitada',
  cotacao_recebida: 'Cotação Recebida',
  aguardando_liberacao: 'Aguardando Liberação',
  liberado_parcial: 'Liberado Parcial',
  liberado_total: 'Liberado Total',
  em_carregamento: 'Em Carregamento',
  carregado: 'Carregado',
  cancelado: 'Cancelado',
};

const ALL_STATUSES = Object.entries(STATUS_LABELS) as [StatusCarregamento, string][];

function getFirstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function Relatorios({ currentUser }: RelatoriosProps) {
  const isAdminOrMaster = currentUser.role === 'admin' || currentUser.role === 'master';
  const [activeTab, setActiveTab] = useState<TabId>('carregamentos');

  // ── Carregamentos ──────────────────────────────────────────────
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [loadingCarr, setLoadingCarr] = useState(false);
  const [filtroCarr, setFiltroCarr] = useState({
    data_inicio: getFirstDayOfMonth(),
    data_fim: getTodayDate(),
    status: '' as StatusCarregamento | '',
    filial_id: '',
    transportadora_id: '',
  });

  // ── Pedidos de Venda ───────────────────────────────────────────
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [loadingPed, setLoadingPed] = useState(false);
  const [filtroPed, setFiltroPed] = useState({ data_inicio: getFirstDayOfMonth(), data_fim: getTodayDate() });

  // ── Gastos de Cartão ───────────────────────────────────────────
  const [gastos, setGastos] = useState<CreditCardExpense[]>([]);
  const [loadingGas, setLoadingGas] = useState(false);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // ── Load filiais and transportadoras ──────────────────────────
  useEffect(() => {
    getFiliais().then(setFiliais).catch(() => {});
    getTransportadoras().then(setTransportadoras).catch(() => {});
  }, []);

  // ── Fetch carregamentos ────────────────────────────────────────
  async function fetchCarregamentos() {
    setLoadingCarr(true);
    try {
      const data = await getCarregamentosRelatorio({
        data_inicio: filtroCarr.data_inicio,
        data_fim: filtroCarr.data_fim,
        status: filtroCarr.status || undefined,
        filial_id: filtroCarr.filial_id || undefined,
        transportadora_id: filtroCarr.transportadora_id || undefined,
      });
      setCarregamentos(data);
    } catch {
      setCarregamentos([]);
    } finally {
      setLoadingCarr(false);
    }
  }

  // ── Fetch pedidos ──────────────────────────────────────────────
  async function fetchPedidos() {
    setLoadingPed(true);
    try {
      const data = await getPedidosVenda();
      setPedidos(
        data.filter((p) => {
          const d = p.criado_em?.slice(0, 10) ?? '';
          return d >= filtroPed.data_inicio && d <= filtroPed.data_fim;
        })
      );
    } catch {
      setPedidos([]);
    } finally {
      setLoadingPed(false);
    }
  }

  // ── Fetch gastos ───────────────────────────────────────────────
  async function fetchGastos() {
    if (!isAdminOrMaster) return;
    setLoadingGas(true);
    try {
      const data = await getExpenses({ month: currentMonth, year: currentYear });
      setGastos(data);
    } catch {
      setGastos([]);
    } finally {
      setLoadingGas(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'carregamentos') fetchCarregamentos();
    if (activeTab === 'pedidos') fetchPedidos();
    if (activeTab === 'cartao') fetchGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Exportar CSV ───────────────────────────────────────────────
  function exportCarregamentosCSV() {
    const rows = carregamentos.map((c) => ({
      Numero: c.numero_carregamento,
      Data: c.criado_em?.slice(0, 10) ?? '',
      Filial: c.filial?.nome ?? '',
      Status: STATUS_LABELS[c.status] ?? c.status,
      Transportadora: c.transportadora?.nome ?? '',
      TipoFrete: c.tipo_frete,
      QuantidadeTotal: c.quantidade_total,
      ValorFrete: c.valor_frete ?? '',
    }));
    exportToCSV(rows, 'relatorio_carregamentos');
  }

  function exportPedidosCSV() {
    const rows = pedidos.map((p) => ({
      NumeroPedido: p.numero_pedido ?? '',
      Data: p.data_pedido ?? p.criado_em?.slice(0, 10) ?? '',
      Cliente: p.cliente_nome ?? '',
      Produto: p.produto_nome ?? '',
      Quantidade: p.quantidade_real ?? '',
      ValorTotal: p.valor_total_negociado ?? '',
      Status: p.status,
    }));
    exportToCSV(rows, 'relatorio_pedidos_venda');
  }

  function exportGastosCSV() {
    const rows = gastos.map((g) => ({
      Data: g.date,
      Cartao: g.cardName ?? '',
      Usuario: g.userName,
      Descricao: g.description,
      Valor: g.amount,
      Status: g.status,
    }));
    exportToCSV(rows, 'relatorio_gastos_cartao');
  }

  function printPage() {
    window.print();
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'carregamentos', label: '🚛 Carregamentos' },
    { id: 'pedidos', label: '📋 Pedidos de Venda' },
    ...(isAdminOrMaster ? [{ id: 'cartao' as TabId, label: '💳 Gastos de Cartão' }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-800">📊 Relatórios</h1>
          <p className="text-stone-400 text-sm mt-0.5">Exportação e análise de dados operacionais</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printPage}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Carregamentos ── */}
      {activeTab === 'carregamentos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-stone-400" />
              <span className="text-sm font-bold text-stone-600">Filtros</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">De</label>
                <input
                  type="date"
                  value={filtroCarr.data_inicio}
                  onChange={(e) => setFiltroCarr((f) => ({ ...f, data_inicio: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Até</label>
                <input
                  type="date"
                  value={filtroCarr.data_fim}
                  onChange={(e) => setFiltroCarr((f) => ({ ...f, data_fim: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Status</label>
                <select
                  value={filtroCarr.status}
                  onChange={(e) =>
                    setFiltroCarr((f) => ({ ...f, status: e.target.value as StatusCarregamento | '' }))
                  }
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Todos</option>
                  {ALL_STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {isAdminOrMaster && (
                <div>
                  <label className="text-xs text-stone-500 font-medium block mb-1">Filial</label>
                  <select
                    value={filtroCarr.filial_id}
                    onChange={(e) => setFiltroCarr((f) => ({ ...f, filial_id: e.target.value }))}
                    className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Todas</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Transportadora</label>
                <select
                  value={filtroCarr.transportadora_id}
                  onChange={(e) => setFiltroCarr((f) => ({ ...f, transportadora_id: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Todas</option>
                  {transportadoras.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={fetchCarregamentos}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Filtrar
              </button>
              <button
                onClick={exportCarregamentosCSV}
                disabled={carregamentos.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {loadingCarr ? (
              <div className="p-8 text-center text-stone-400 text-sm animate-pulse">
                Carregando dados...
              </div>
            ) : carregamentos.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">
                Nenhum carregamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      {['#', 'Número', 'Data', 'Filial', 'Status', 'Transportadora', 'Tipo', 'Tonelagem', 'Frete'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {carregamentos.map((c, i) => (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 text-stone-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-stone-800">{c.numero_carregamento}</td>
                        <td className="px-4 py-3 text-stone-600">{c.criado_em?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{c.filial?.nome ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{c.transportadora?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{c.tipo_frete}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {c.quantidade_total.toLocaleString('pt-BR')} ton
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {c.valor_frete != null
                            ? c.valor_frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-stone-400 text-right">{carregamentos.length} registro(s)</p>
        </div>
      )}

      {/* ── Tab: Pedidos de Venda ── */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-stone-400" />
              <span className="text-sm font-bold text-stone-600">Filtros</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">De</label>
                <input
                  type="date"
                  value={filtroPed.data_inicio}
                  onChange={(e) => setFiltroPed((f) => ({ ...f, data_inicio: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 font-medium block mb-1">Até</label>
                <input
                  type="date"
                  value={filtroPed.data_fim}
                  onChange={(e) => setFiltroPed((f) => ({ ...f, data_fim: e.target.value }))}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={fetchPedidos}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Filtrar
              </button>
              <button
                onClick={exportPedidosCSV}
                disabled={pedidos.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {loadingPed ? (
              <div className="p-8 text-center text-stone-400 text-sm animate-pulse">
                Carregando dados...
              </div>
            ) : pedidos.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">
                Nenhum pedido encontrado para o período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      {['#', 'Número', 'Data', 'Cliente', 'Produto', 'Quantidade', 'Valor Total', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {pedidos.map((p, i) => (
                      <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 text-stone-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-stone-800">{p.numero_pedido ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{p.data_pedido ?? p.criado_em?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{p.cliente_nome ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{p.produto_nome ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {p.quantidade_real != null ? `${p.quantidade_real.toLocaleString('pt-BR')} ton` : '—'}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {p.valor_total_negociado != null
                            ? p.valor_total_negociado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-stone-400 text-right">{pedidos.length} registro(s)</p>
        </div>
      )}

      {/* ── Tab: Gastos de Cartão ── */}
      {activeTab === 'cartao' && isAdminOrMaster && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-stone-400" />
                <span className="text-sm font-bold text-stone-600">
                  Mês atual ({currentMonth}/{currentYear})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchGastos}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
                <button
                  onClick={exportGastosCSV}
                  disabled={gastos.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {loadingGas ? (
              <div className="p-8 text-center text-stone-400 text-sm animate-pulse">
                Carregando dados...
              </div>
            ) : gastos.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">
                Nenhum gasto registrado para o mês atual.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      {['Data', 'Cartão', 'Usuário', 'Descrição', 'Valor', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {gastos.map((g) => (
                      <tr key={g.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 text-stone-600">{g.date}</td>
                        <td className="px-4 py-3 text-stone-600">{g.cardName ?? '—'}</td>
                        <td className="px-4 py-3 text-stone-600">{g.userName}</td>
                        <td className="px-4 py-3 text-stone-800">{g.description}</td>
                        <td className="px-4 py-3 font-medium text-stone-800">
                          {g.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              g.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : g.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {g.status === 'approved'
                              ? 'Aprovado'
                              : g.status === 'rejected'
                                ? 'Rejeitado'
                                : g.status === 'checked'
                                  ? 'Conferido'
                                  : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {gastos.length > 0 && (
            <div className="bg-stone-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-stone-500">{gastos.length} registro(s)</span>
              <span className="text-sm font-bold text-stone-800">
                Total:{' '}
                {gastos
                  .reduce((s, g) => s + g.amount, 0)
                  .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
