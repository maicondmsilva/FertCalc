import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Package,
  Pencil,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getProdutosFormulados,
  setProdutoFormuladoArchived,
  updateProdutoFormulado,
  type ProdutoFormulado,
} from '../services/produtosFormuladosService';
import {
  getHistoricoPrecos,
  getHistoricoPrecosForProducts,
  type HistoricoPrecoFormulado,
} from '../services/historicoPrecoService';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { getAppSettings, getPriceLists } from '../services/db';
import type { LocalCarregamento } from '../types/carregamento';
import type { PriceList, User } from '../types';
import { filterFormulatedPriceHistory } from '../utils/formulatedPriceHistory';
import {
  buildPriceReportRows,
  filterByOrigin,
  summarizePriceHistory,
  type HistoryOrigin,
} from '../utils/formulatedPriceStats';
import { exportPriceReportExcel, exportProductHistoryExcel } from '../utils/formulatedPriceReport';
import { usePagination } from '../hooks/usePagination';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import Pagination from './ui/Pagination';
import { useToast } from './Toast';

interface ProdutosFormuladosProps {
  currentUser?: User;
}

type View = 'ativos' | 'arquivados';

const formatMoney = (value: number | undefined, currency: 'BRL' | 'USD') =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inputClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export default function ProdutosFormulados({ currentUser }: ProdutosFormuladosProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [produtos, setProdutos] = useState<ProdutoFormulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('ativos');
  const [search, setSearch] = useState('');
  const [filterLinha, setFilterLinha] = useState<'all' | 'sim' | 'nao'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoPrecoFormulado[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [historyLocalId, setHistoryLocalId] = useState('');
  const [historyPriceListId, setHistoryPriceListId] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyCurrency, setHistoryCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [historyOrigin, setHistoryOrigin] = useState<HistoryOrigin>('todas');
  const [editing, setEditing] = useState<ProdutoFormulado | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', linha_diferenciada: false, ativo: true });
  const [exporting, setExporting] = useState(false);

  const permissions = (currentUser?.permissions || {}) as Record<string, unknown>;
  const canEdit =
    !currentUser ||
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    permissions.produtosFormulados_edit !== false;

  useEffect(() => {
    void loadData();
    // Carregamento inicial da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, activeLocations, lists, settings] = await Promise.all([
        getProdutosFormulados(),
        getLocaisAtivos(),
        getPriceLists(),
        getAppSettings().catch(() => null),
      ]);
      setProdutos(data);
      setLocais(activeLocations);
      setPriceLists(lists);
      setCompanyName(settings?.companyName || '');
    } catch {
      showError('Erro ao carregar produtos formulados');
    } finally {
      setLoading(false);
    }
  };

  const archivedCount = produtos.filter((produto) => produto.arquivado_em).length;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return produtos.filter((produto) => {
      const inView = view === 'arquivados' ? Boolean(produto.arquivado_em) : !produto.arquivado_em;
      const matchSearch =
        !term ||
        produto.nome.toLowerCase().includes(term) ||
        (produto.formula_npk || '').toLowerCase().includes(term) ||
        (produto.idFormatado || '').toLowerCase().includes(term);
      const matchLinha =
        filterLinha === 'all' ||
        (filterLinha === 'sim' && produto.linha_diferenciada) ||
        (filterLinha === 'nao' && !produto.linha_diferenciada);
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'ativo' && produto.ativo) ||
        (filterStatus === 'inativo' && !produto.ativo);
      return inView && matchSearch && matchLinha && matchStatus;
    });
  }, [produtos, view, search, filterLinha, filterStatus]);
  const pagination = usePagination(filtered, 20);

  const applyHistoryFilters = (entries: HistoricoPrecoFormulado[]) =>
    filterByOrigin(
      filterFormulatedPriceHistory(entries, {
        localId: historyLocalId || undefined,
        priceListId: historyPriceListId || undefined,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      }).filter((entry) => (entry.moeda || 'BRL') === historyCurrency),
      historyOrigin
    );

  const filtersDescription = [
    historyCurrency === 'USD' ? 'Preços em dólar' : 'Preços em reais',
    historyLocalId ? `Local: ${locais.find((local) => local.id === historyLocalId)?.nome}` : '',
    historyPriceListId
      ? `Lista: ${priceLists.find((list) => list.id === historyPriceListId)?.name}`
      : '',
    historyDateFrom
      ? `De ${new Date(`${historyDateFrom}T12:00:00`).toLocaleDateString('pt-BR')}`
      : '',
    historyDateTo ? `até ${new Date(`${historyDateTo}T12:00:00`).toLocaleDateString('pt-BR')}` : '',
    historyOrigin === 'precificacao'
      ? 'Origem: precificações'
      : historyOrigin === 'relatorio_precos'
        ? 'Origem: relatórios de preços'
        : '',
  ]
    .filter(Boolean)
    .join(' · ');

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

  const openEdit = (produto: ProdutoFormulado) => {
    setEditing(produto);
    setEditForm({
      nome: produto.nome,
      linha_diferenciada: produto.linha_diferenciada,
      ativo: produto.ativo,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const nome = editForm.nome.trim();
    if (!nome) {
      showError('Informe o nome do produto.');
      return;
    }
    setBusyId(editing.id);
    try {
      await updateProdutoFormulado(editing.id, {
        nome,
        linha_diferenciada: editForm.linha_diferenciada,
        ativo: editForm.ativo,
      });
      showSuccess('Produto atualizado.');
      setEditing(null);
      await loadData();
    } catch {
      showError('Não foi possível salvar o produto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (produto: ProdutoFormulado) => {
    const ok = await confirm({
      title: 'Arquivar produto formulado?',
      message: `"${produto.nome}" sai da lista e da calculadora${produto.saved_formula_id ? ', junto com a batida de origem' : ''}. O histórico de preços fica guardado e você pode restaurar em "Arquivados".`,
      variant: 'warning',
      confirmLabel: 'Arquivar',
    });
    if (!ok) return;
    setBusyId(produto.id);
    try {
      await setProdutoFormuladoArchived(produto.id, true);
      showSuccess('Produto arquivado.');
      if (expandedId === produto.id) setExpandedId(null);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erro ao arquivar o produto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (produto: ProdutoFormulado) => {
    setBusyId(produto.id);
    try {
      await setProdutoFormuladoArchived(produto.id, false);
      showSuccess(
        `"${produto.nome}" restaurado${produto.saved_formula_id ? ', com a batida de origem' : ''}.`
      );
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erro ao restaurar o produto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportReport = async () => {
    if (filtered.length === 0) {
      showError('Nenhum produto na lista para exportar.');
      return;
    }
    setExporting(true);
    try {
      const history = await getHistoricoPrecosForProducts(filtered.map((produto) => produto.id));
      const filteredHistory = Object.fromEntries(
        Object.entries(history).map(([id, entries]) => [id, applyHistoryFilters(entries)])
      );
      await exportPriceReportExcel(buildPriceReportRows(filtered, filteredHistory), {
        currency: historyCurrency,
        filters: filtersDescription,
        companyName,
      });
      showSuccess('Relatório de preços exportado.');
    } catch {
      showError('Não foi possível gerar o relatório de preços.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-stone-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <Package className="h-5 w-5" />
            </span>
            Produtos Formulados
          </h2>
          <p className="mt-1 text-[15px] text-stone-500">
            Produtos gerados a partir das batidas salvas, com histórico de preços e relatórios.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleExportReport()}
          disabled={exporting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting ? 'Gerando relatório…' : 'Relatório de preços (Excel)'}
        </button>
      </div>

      {/* Filtros dos produtos */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
              <Search className="h-4 w-4" /> Pesquisar
            </span>
            <input
              type="search"
              placeholder="Nome, NPK ou código…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Linha
            </span>
            <select
              value={filterLinha}
              onChange={(event) => setFilterLinha(event.target.value as 'all' | 'sim' | 'nao')}
              className={inputClass}
            >
              <option value="all">Todas as linhas</option>
              <option value="sim">Linha diferenciada</option>
              <option value="nao">Linha padrão</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
              Situação
            </span>
            <select
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(event.target.value as 'all' | 'ativo' | 'inativo')
              }
              className={inputClass}
            >
              <option value="all">Ativos e inativos</option>
              <option value="ativo">Somente ativos</option>
              <option value="inativo">Somente inativos</option>
            </select>
          </label>
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <div
            role="tablist"
            aria-label="Produtos arquivados"
            className="inline-flex rounded-xl bg-stone-100 p-1"
          >
            {(
              [
                ['ativos', `Em uso (${produtos.length - archivedCount})`],
                ['arquivados', `Arquivados (${archivedCount})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  view === value
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filtros do histórico */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-black text-stone-800">Histórico de preços e relatório</h3>
          <span className="text-xs text-stone-500">valem para o histórico e para o Excel</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <select
            value={historyCurrency}
            onChange={(event) => setHistoryCurrency(event.target.value as 'BRL' | 'USD')}
            className={inputClass}
            aria-label="Moeda"
          >
            <option value="BRL">Preços em reais</option>
            <option value="USD">Preços em dólar</option>
          </select>
          <select
            value={historyOrigin}
            onChange={(event) => setHistoryOrigin(event.target.value as HistoryOrigin)}
            className={inputClass}
            aria-label="Origem do preço"
          >
            <option value="todas">Todas as origens</option>
            <option value="precificacao">Precificações</option>
            <option value="relatorio_precos">Relatórios de preços</option>
          </select>
          <select
            value={historyLocalId}
            onChange={(event) => {
              setHistoryLocalId(event.target.value);
              setHistoryPriceListId('');
            }}
            className={inputClass}
            aria-label="Local de carregamento"
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
            onChange={(event) => setHistoryPriceListId(event.target.value)}
            className={inputClass}
            aria-label="Lista de preço"
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
          <label className="flex items-center gap-2 text-sm text-stone-500">
            De
            <input
              type="date"
              value={historyDateFrom}
              onChange={(event) => setHistoryDateFrom(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-500">
            Até
            <input
              type="date"
              value={historyDateTo}
              onChange={(event) => setHistoryDateTo(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-stone-100">
            {view === 'arquivados' ? (
              <Archive className="h-7 w-7 text-stone-400" />
            ) : (
              <Package className="h-7 w-7 text-stone-400" />
            )}
          </div>
          <h3 className="mb-1 text-lg font-bold text-stone-800">
            {view === 'arquivados' ? 'Nenhum produto arquivado' : 'Nenhum produto formulado'}
          </h3>
          <p className="mx-auto max-w-md text-[15px] text-stone-500">
            {view === 'arquivados'
              ? 'Produtos arquivados aparecem aqui e podem ser restaurados.'
              : 'Os produtos formulados são criados ao salvar uma batida na Calculadora.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[15px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-bold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Linha</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Criado em</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pagination.pageItems.map((produto) => {
                    const isExpanded = expandedId === produto.id;
                    const history = applyHistoryFilters(historicos[produto.id] || []);
                    const summary = summarizePriceHistory(history);
                    return (
                      <React.Fragment key={produto.id}>
                        <tr className={isExpanded ? 'bg-emerald-50/40' : 'hover:bg-stone-50'}>
                          <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-700">
                            {produto.idFormatado || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-semibold text-stone-900">
                              {produto.nome}
                            </span>
                            <span className="font-mono text-sm text-stone-500">
                              {produto.formula_npk || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {produto.linha_diferenciada ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                                <Star className="h-3 w-3" /> Diferenciada
                              </span>
                            ) : (
                              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                                Padrão
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {produto.arquivado_em ? (
                              <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-bold text-stone-700">
                                Arquivado em{' '}
                                {new Date(produto.arquivado_em).toLocaleDateString('pt-BR')}
                              </span>
                            ) : produto.ativo ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                                Ativo
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                produto.saved_formula_id
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-stone-100 text-stone-500'
                              }`}
                            >
                              {produto.saved_formula_id ? 'Batida' : 'Cadastro antigo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-500">
                            {produto.criado_em
                              ? new Date(produto.criado_em).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void handleExpandHistorico(produto)}
                                aria-expanded={isExpanded}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold transition-colors ${
                                  isExpanded
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <TrendingUp className="h-4 w-4" />
                                )}
                                Histórico
                              </button>
                              {canEdit && !produto.arquivado_em && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(produto)}
                                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                                    title="Editar produto"
                                    aria-label={`Editar ${produto.nome}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleArchive(produto)}
                                    disabled={busyId === produto.id}
                                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40"
                                    title="Arquivar produto"
                                    aria-label={`Arquivar ${produto.nome}`}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {canEdit && produto.arquivado_em && (
                                <button
                                  type="button"
                                  onClick={() => void handleRestore(produto)}
                                  disabled={busyId === produto.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <ArchiveRestore className="h-4 w-4" /> Restaurar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={7}
                              className="border-b border-stone-200 bg-emerald-50/40 px-4 py-4"
                            >
                              {!historicos[produto.id] ? (
                                <p className="text-sm text-stone-500">Carregando histórico…</p>
                              ) : history.length === 0 ? (
                                <p className="text-sm text-stone-500">
                                  Nenhum preço registrado para os filtros selecionados.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                                    {[
                                      [
                                        'Último preço',
                                        formatMoney(summary.last?.preco_final, historyCurrency),
                                      ],
                                      ['Mínimo', formatMoney(summary.min, historyCurrency)],
                                      ['Máximo', formatMoney(summary.max, historyCurrency)],
                                      ['Média', formatMoney(summary.average, historyCurrency)],
                                      ['Registros', String(summary.count)],
                                    ].map(([label, value]) => (
                                      <div
                                        key={label}
                                        className="rounded-xl border border-stone-200 bg-white p-3"
                                      >
                                        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                                          {label}
                                        </p>
                                        <p className="mt-0.5 text-lg font-black tabular-nums text-stone-900">
                                          {value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    {summary.variationPercent !== undefined ? (
                                      <p
                                        className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                                          summary.variationPercent >= 0
                                            ? 'text-emerald-700'
                                            : 'text-red-700'
                                        }`}
                                      >
                                        {summary.variationPercent >= 0 ? (
                                          <TrendingUp className="h-4 w-4" />
                                        ) : (
                                          <TrendingDown className="h-4 w-4" />
                                        )}
                                        {summary.variationPercent >= 0 ? '+' : ''}
                                        {summary.variationPercent.toLocaleString('pt-BR', {
                                          maximumFractionDigits: 2,
                                        })}
                                        % em relação ao registro anterior
                                      </p>
                                    ) : (
                                      <span />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void exportProductHistoryExcel(produto.nome, history).catch(
                                          () => showError('Não foi possível exportar o histórico.')
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
                                    >
                                      <Download className="h-4 w-4" /> Exportar histórico (Excel)
                                    </button>
                                  </div>
                                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                                    <ResponsiveContainer width="100%" height={220}>
                                      <LineChart
                                        data={history.map((entry) => ({
                                          data: new Date(entry.registrado_em).toLocaleDateString(
                                            'pt-BR'
                                          ),
                                          preco: entry.preco_final,
                                          local:
                                            entry.local_carregamento_nome || 'Local não registrado',
                                          lista: entry.price_list_name || 'Lista não registrada',
                                        }))}
                                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                        <XAxis
                                          dataKey="data"
                                          tick={{ fontSize: 11, fill: '#78716c' }}
                                        />
                                        <YAxis
                                          width={90}
                                          tick={{ fontSize: 11, fill: '#78716c' }}
                                          tickFormatter={(value) =>
                                            `${historyCurrency === 'USD' ? 'US$' : 'R$'} ${Number(value).toLocaleString('pt-BR')}`
                                          }
                                        />
                                        <Tooltip
                                          formatter={(value: number, _name: string, item) => [
                                            `${formatMoney(value, historyCurrency)} · ${item.payload.local} · ${item.payload.lista}`,
                                            `Preço ${historyCurrency}/t`,
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
                                  </div>
                                  <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                                    <table className="w-full min-w-[760px] text-sm">
                                      <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                                        <tr>
                                          <th className="px-3 py-2 text-left">Data</th>
                                          <th className="px-3 py-2 text-left">Origem</th>
                                          <th className="px-3 py-2 text-left">Local</th>
                                          <th className="px-3 py-2 text-left">Lista</th>
                                          <th className="px-3 py-2 text-right">Preço/t</th>
                                          <th className="px-3 py-2 text-right">Toneladas</th>
                                          <th className="px-3 py-2 text-right">Total</th>
                                          <th className="px-3 py-2 text-left">Por</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-stone-100">
                                        {history
                                          .slice()
                                          .reverse()
                                          .map((entry) => (
                                            <tr key={entry.id}>
                                              <td className="whitespace-nowrap px-3 py-2">
                                                {new Date(entry.registrado_em).toLocaleString(
                                                  'pt-BR'
                                                )}
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.origem === 'relatorio_precos'
                                                  ? 'Relatório de preços'
                                                  : 'Precificação'}
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.local_carregamento_nome || 'Não registrado'}
                                              </td>
                                              <td className="px-3 py-2">
                                                {entry.price_list_name || 'Não registrada'}
                                              </td>
                                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                                {formatMoney(
                                                  entry.preco_final,
                                                  entry.moeda || 'BRL'
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-right tabular-nums">
                                                {entry.quantidade_tons
                                                  ? entry.quantidade_tons.toLocaleString('pt-BR')
                                                  : '—'}
                                              </td>
                                              <td className="px-3 py-2 text-right tabular-nums">
                                                {entry.valor_total
                                                  ? formatMoney(
                                                      entry.valor_total,
                                                      entry.moeda || 'BRL'
                                                    )
                                                  : '—'}
                                              </td>
                                              <td className="px-3 py-2 text-stone-600">
                                                {entry.registrado_por || '—'}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            firstItemNumber={pagination.firstItemNumber}
            lastItemNumber={pagination.lastItemNumber}
            pageSize={pagination.pageSize}
            pageSizeOptions={[20, 50, 100]}
            itemLabel="produtos"
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-produto-titulo"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-stone-100 p-5">
              <div>
                <h3 id="editar-produto-titulo" className="text-lg font-black text-stone-900">
                  Editar produto formulado
                </h3>
                <p className="font-mono text-sm text-emerald-700">
                  {editing.idFormatado} · {editing.formula_npk || 'sem NPK'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">
                  Nome
                </span>
                <input
                  type="text"
                  value={editForm.nome}
                  onChange={(event) =>
                    setEditForm((form) => ({ ...form, nome: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3">
                <input
                  type="checkbox"
                  checked={editForm.linha_diferenciada}
                  onChange={(event) =>
                    setEditForm((form) => ({ ...form, linha_diferenciada: event.target.checked }))
                  }
                  className="mt-0.5 h-5 w-5 rounded border-stone-300 text-amber-500"
                />
                <span>
                  <span className="block font-semibold text-stone-800">Linha diferenciada</span>
                  <span className="text-sm text-stone-500">
                    A composição da batida fica protegida e não pode ser alterada na calculadora.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3">
                <input
                  type="checkbox"
                  checked={editForm.ativo}
                  onChange={(event) =>
                    setEditForm((form) => ({ ...form, ativo: event.target.checked }))
                  }
                  className="mt-0.5 h-5 w-5 rounded border-stone-300 text-emerald-600"
                />
                <span>
                  <span className="block font-semibold text-stone-800">Ativo</span>
                  <span className="text-sm text-stone-500">
                    Inativo continua na lista, mas não aparece para carregar na calculadora.
                  </span>
                </span>
              </label>
              <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                A fórmula e a composição vêm da batida. Para alterá-las, atualize a batida em
                Batidas Salvas. Ao atualizar a batida, o nome do produto volta a acompanhar o nome
                da batida.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 p-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busyId === editing.id}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
