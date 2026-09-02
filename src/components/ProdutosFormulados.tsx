import React, { useState, useEffect } from 'react';
import {
  getProdutosFormulados,
  updateProdutoFormulado,
  ProdutoFormulado,
} from '../services/produtosFormuladosService';
import { getHistoricoPrecos, HistoricoPrecoFormulado } from '../services/historicoPrecoService';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { getPriceLists } from '../services/db';
import { LocalCarregamento } from '../types/carregamento';
import { PriceList } from '../types';
import { filterFormulatedPriceHistory } from '../utils/formulatedPriceHistory';
import { useToast } from './Toast';
import {
  Package,
  Star,
  Search,
  ToggleLeft,
  ToggleRight,
  Filter,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ProdutosFormulados() {
  const { showSuccess, showError } = useToast();
  const [produtos, setProdutos] = useState<ProdutoFormulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLinha, setFilterLinha] = useState<'all' | 'sim' | 'nao'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoPrecoFormulado[]>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [historyLocalId, setHistoryLocalId] = useState('');
  const [historyPriceListId, setHistoryPriceListId] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, activeLocations, lists] = await Promise.all([
        getProdutosFormulados(),
        getLocaisAtivos(),
        getPriceLists(),
      ]);
      setProdutos(data);
      setLocais(activeLocations);
      setPriceLists(lists);
    } catch {
      showError('Erro ao carregar produtos formulados');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLinhaDiferenciada = async (produto: ProdutoFormulado) => {
    if (updatingId) return;
    setUpdatingId(produto.id);
    try {
      await updateProdutoFormulado(produto.id, {
        linha_diferenciada: !produto.linha_diferenciada,
      });
      showSuccess(
        `Linha diferenciada ${!produto.linha_diferenciada ? 'ativada' : 'desativada'} com sucesso!`
      );
      await loadData();
    } catch {
      showError('Erro ao atualizar produto');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleAtivo = async (produto: ProdutoFormulado) => {
    if (updatingId) return;
    setUpdatingId(produto.id);
    try {
      await updateProdutoFormulado(produto.id, { ativo: !produto.ativo });
      showSuccess(`Produto ${!produto.ativo ? 'ativado' : 'inativado'} com sucesso!`);
      await loadData();
    } catch {
      showError('Erro ao atualizar produto');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExpandHistorico = async (produto: ProdutoFormulado) => {
    if (expandedId === produto.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(produto.id);
    if (!historicos[produto.id]) {
      try {
        const data = await getHistoricoPrecos(produto.id);
        setHistoricos((prev) => ({ ...prev, [produto.id]: data }));
      } catch {
        setHistoricos((prev) => ({ ...prev, [produto.id]: [] }));
        showError('Erro ao carregar o histórico de preços deste produto.');
      }
    }
  };

  const filtered = produtos.filter((p) => {
    const matchSearch =
      search === '' ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.formula_npk || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.idFormatado || '').toLowerCase().includes(search.toLowerCase());
    const matchLinha =
      filterLinha === 'all' ||
      (filterLinha === 'sim' && p.linha_diferenciada) ||
      (filterLinha === 'nao' && !p.linha_diferenciada);
    return matchSearch && matchLinha;
  });

  const getFilteredHistory = (produtoId: string) =>
    filterFormulatedPriceHistory(historicos[produtoId] || [], {
      localId: historyLocalId || undefined,
      priceListId: historyPriceListId || undefined,
      dateFrom: historyDateFrom || undefined,
      dateTo: historyDateTo || undefined,
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Produtos Formulados
          </h2>
          <p className="text-stone-500">
            Gerencie os produtos formulados gerados a partir das batidas salvas.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nome, NPK ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-sm text-stone-700 placeholder-stone-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={filterLinha}
            onChange={(e) => setFilterLinha(e.target.value as 'all' | 'sim' | 'nao')}
            className="text-sm text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todas as linhas</option>
            <option value="sim">Linha Diferenciada</option>
            <option value="nao">Linha Padrão</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <p className="text-sm font-bold text-stone-700">Filtros do histórico de preços</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={historyLocalId}
            onChange={(e) => {
              setHistoryLocalId(e.target.value);
              setHistoryPriceListId('');
            }}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos os locais</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
          <select
            value={historyPriceListId}
            onChange={(e) => setHistoryPriceListId(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as listas</option>
            {priceLists
              .filter((list) => !historyLocalId || list.local_carregamento_id === historyLocalId)
              .map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-stone-500">
            De
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              className="min-w-0 flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-500">
            Até
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              className="min-w-0 flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2"
            />
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-bold text-stone-800 mb-2">Nenhum produto formulado</h3>
          <p className="text-stone-500 max-w-md mx-auto">
            Os produtos formulados são criados automaticamente ao salvar uma batida na Calculadora.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                    NPK
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Linha Diferenciada
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Ativo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Criado em
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Origem
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Histórico
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((produto) => (
                  <React.Fragment key={produto.id}>
                    <tr className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-700">
                        {produto.idFormatado || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800">{produto.nome}</td>
                      <td className="px-4 py-3 font-mono text-stone-600">
                        {produto.formula_npk || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {produto.linha_diferenciada ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3" />
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-500 text-xs font-medium px-2 py-0.5 rounded-full">
                              Não
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleLinhaDiferenciada(produto)}
                            disabled={updatingId === produto.id}
                            title="Alternar Linha Diferenciada"
                            className="text-stone-400 hover:text-amber-500 transition-colors disabled:cursor-wait disabled:opacity-40"
                          >
                            {produto.linha_diferenciada ? (
                              <ToggleRight className="w-5 h-5 text-amber-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {produto.ativo ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                              Inativo
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleAtivo(produto)}
                            disabled={updatingId === produto.id}
                            title="Alternar Ativo/Inativo"
                            className="text-stone-400 hover:text-emerald-600 transition-colors disabled:cursor-wait disabled:opacity-40"
                          >
                            {produto.ativo ? (
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {produto.criado_em
                          ? new Date(produto.criado_em).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${produto.saved_formula_id ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-500'}`}
                        >
                          {produto.saved_formula_id ? 'Batida sincronizada' : 'Cadastro legado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleExpandHistorico(produto)}
                          title="Ver histórico de preços"
                          className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        >
                          {expandedId === produto.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <TrendingUp className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedId === produto.id && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-4 bg-emerald-50 border-b border-stone-200"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <p className="text-sm font-bold text-stone-700">
                              Histórico de Preços — {produto.nome}
                            </p>
                          </div>
                          {!historicos[produto.id] ? (
                            <p className="text-xs text-stone-400">Carregando...</p>
                          ) : getFilteredHistory(produto.id).length === 0 ? (
                            <p className="text-xs text-stone-400">
                              Nenhum histórico de preço encontrado para os filtros selecionados.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart
                                  data={getFilteredHistory(produto.id).map((h) => ({
                                    data: new Date(h.registrado_em).toLocaleDateString('pt-BR'),
                                    preco: h.preco_final,
                                    local: h.local_carregamento_nome || 'Local não registrado',
                                    lista: h.price_list_name || 'Lista não registrada',
                                  }))}
                                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#78716c' }} />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: '#78716c' }}
                                    tickFormatter={(v) =>
                                      `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                                    }
                                  />
                                  <Tooltip
                                    formatter={(value: number, name: string, item) => [
                                      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${item.payload.local} · ${item.payload.lista}`,
                                      name === 'preco' ? 'Preço R$/t' : name,
                                    ]}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="preco"
                                    stroke="#059669"
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#059669' }}
                                    activeDot={{ r: 6 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                              <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                                <table className="w-full min-w-[760px] text-xs">
                                  <thead className="bg-stone-50 text-stone-500">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Data</th>
                                      <th className="px-3 py-2 text-left">Local</th>
                                      <th className="px-3 py-2 text-left">Lista</th>
                                      <th className="px-3 py-2 text-right">Preço R$/t</th>
                                      <th className="px-3 py-2 text-right">Toneladas</th>
                                      <th className="px-3 py-2 text-right">Total</th>
                                      <th className="px-3 py-2 text-left">Origem</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {getFilteredHistory(produto.id)
                                      .slice()
                                      .reverse()
                                      .map((history) => (
                                        <tr key={history.id}>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            {new Date(history.registrado_em).toLocaleString(
                                              'pt-BR'
                                            )}
                                          </td>
                                          <td className="px-3 py-2">
                                            {history.local_carregamento_nome || 'Não registrado'}
                                          </td>
                                          <td className="px-3 py-2">
                                            {history.price_list_name || 'Não registrada'}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold">
                                            {history.preco_final.toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                            })}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {history.quantidade_tons?.toLocaleString('pt-BR') ||
                                              '—'}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {history.valor_total?.toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                            }) || '—'}
                                          </td>
                                          <td className="px-3 py-2">
                                            {history.origem === 'relatorio_precos'
                                              ? 'Relatório de preços'
                                              : 'Precificação'}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
