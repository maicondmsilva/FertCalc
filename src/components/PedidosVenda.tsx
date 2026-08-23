import React, { useState, useEffect, useCallback } from 'react';
import { User, PedidoVenda, Branch, PedidoVendaItem, Client, PricingRecord, CancelamentoPedido } from '../types';
import {
  ClipboardList,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Ban,
  FileText,
  X,
} from 'lucide-react';
import {
  getPedidosVenda,
  getPedidoVendaItens,
  getCancelamentos,
  getPedidoSaldoAlertaPreferencia,
  savePedidoSaldoAlertaPreferencia,
  PedidoSaldoAlertaPreferencia,
} from '../services/pedidosVendaService';
import {
  createCarregamento,
  gerarNumeroCarregamento,
  getFiliais,
  getQuantidadeCarregadaPorItem,
} from '../services/carregamentoService';
import { getBranches, getClients, getPricingRecords } from '../services/db';
import { useToast } from './Toast';
import type { CarregamentoFormData } from './Carregamento';
import { Filial } from '../types/carregamento';
import { getStatusInicial } from '../utils/getStatusInicial';
import HistoricoCarregamentosPedido from './HistoricoCarregamentosPedido';
import { canReceiveSaldoPedidoAlert } from '../services/alertConfigService';

const NovoPedidoVendaModal = React.lazy(() => import('./NovoPedidoVendaModal'));
const CancSubstituiModal = React.lazy(() => import('./CancSubstituiModal'));
const CancelamentoDefinitivoModal = React.lazy(() => import('./CancelamentoDefinitivoModal'));
const RelatorioCancSubstitui = React.lazy(() => import('./RelatorioCancSubstitui'));
const ModalNovoCarregamento = React.lazy(() =>
  import('./Carregamento').then((module) => ({ default: module.ModalNovoCarregamento }))
);

function LoadingFeature({ label, overlay = false }: { label: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      className={
        overlay
          ? 'fixed inset-0 z-[100] flex items-center justify-center bg-black/30 text-sm font-bold text-white'
          : 'flex min-h-48 items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-500'
      }
    >
      {label}
    </div>
  );
}

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

type ActiveTab = 'pedidos' | 'relatorio' | 'saldos_cancelados';

export default function PedidosVenda({ currentUser }: PedidosVendaProps) {
  const { showSuccess, showError } = useToast();
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filialFilter, setFilialFilter] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [pedidoParaCarregamento, setPedidoParaCarregamento] = useState<PedidoVenda | null>(null);
  const [modalCarregamentoAberto, setModalCarregamentoAberto] = useState(false);
  const [itensPorPedido, setItensPorPedido] = useState<Record<string, PedidoVendaItem[]>>({});
  const [carregadoPorItem, setCarregadoPorItem] = useState<Record<string, number>>({});
  const [alertaSaldo, setAlertaSaldo] = useState<PedidoSaldoAlertaPreferencia>({
    dias_limite: 30,
    desativado: false,
  });
  const [podeReceberAlertaSaldo, setPodeReceberAlertaSaldo] = useState(false);
  const [pedidoCancSubstitui, setPedidoCancSubstitui] = useState<PedidoVenda | null>(null);
  const [pedidoCancelamentoDefinitivo, setPedidoCancelamentoDefinitivo] =
    useState<PedidoVenda | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pedidos');

  const [clients, setClients] = useState<Client[]>([]);
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>([]);
  const [cancelamentos, setCancelamentos] = useState<CancelamentoPedido[]>([]);
  const [loadingCancelamentos, setLoadingCancelamentos] = useState(false);
  const [cancSearch, setCancSearch] = useState('');
  const [cancDataInicio, setCancDataInicio] = useState('');
  const [cancDataFim, setCancDataFim] = useState('');

  const load = useCallback(async () => {
    setPedidos([]);
    setLoading(true);
    try {
      const [pedidosData, branchesData, clientsData, pricingData] = await Promise.all([
        getPedidosVenda(),
        getBranches(),
        getClients(),
        getPricingRecords(),
      ]);
      setPedidos(pedidosData);
      setBranches(branchesData);
      setClients(clientsData);
      setPricingRecords(pricingData);
      const firstPedido = pedidosData[pedidosData.length - 1];
      if (firstPedido) {
        setSelectedPedidoId(firstPedido.id);
        setExpandedIds(new Set([firstPedido.id]));
        const [itens, progresso, preferencia, podeReceber] = await Promise.all([
          getPedidoVendaItens(firstPedido.id),
          getQuantidadeCarregadaPorItem(firstPedido.id),
          getPedidoSaldoAlertaPreferencia(firstPedido.id, currentUser.id),
          canReceiveSaldoPedidoAlert(currentUser.id, currentUser.role),
        ]);
        setItensPorPedido({ [firstPedido.id]: itens });
        setCarregadoPorItem(progresso);
        setAlertaSaldo(preferencia);
        setPodeReceberAlertaSaldo(podeReceber);
      } else {
        setSelectedPedidoId(null);
        setExpandedIds(new Set());
        setItensPorPedido({});
        setCarregadoPorItem({});
      }
    } catch {
      showError('Erro ao carregar pedidos de venda.');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, showError]);

  const loadCancelamentos = useCallback(async () => {
    setLoadingCancelamentos(true);
    try {
      const data = await getCancelamentos({ tipo: 'definitivo' });
      setCancelamentos(data);
    } catch {
      showError('Erro ao carregar cancelamentos.');
    } finally {
      setLoadingCancelamentos(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'saldos_cancelados') {
      loadCancelamentos();
    }
  }, [activeTab, loadCancelamentos]);

  useEffect(() => {
    getFiliais()
      .then(setFiliais)
      .catch(() => {});
  }, []);

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
        if (!itensPorPedido[id]) {
          getPedidoVendaItens(id)
            .then((itens) => {
              setItensPorPedido((prev) => ({ ...prev, [id]: itens }));
            })
            .catch(() => {});
        }
      }
      return next;
    });
  };

  const handleSolicitarCarregamento = async (form: CarregamentoFormData) => {
    try {
      const numero = await gerarNumeroCarregamento();
      await createCarregamento(
        {
          numero_carregamento: numero,
          tipo_frete: form.tipo_frete,
          quantidade_total: parseFloat(form.quantidade_total),
          quantidade_liberada: 0,
          quantidade_carregada: 0,
          filial_id: form.filial_id || undefined,
          local_carregamento_id: form.local_carregamento_id || undefined,
          pedido_precificacao_id: form.precificacao_id || undefined,
          pedido_venda_id: form.pedido_venda_id || undefined,
          pedido_venda_numero: form.pedido_venda_numero || undefined,
          data_prevista_carregamento: form.data_prevista_carregamento || undefined,
          observacoes: form.observacoes || undefined,
          valor_frete: form.valor_frete ? parseFloat(form.valor_frete) : undefined,
          status: getStatusInicial(form.tipo_frete),
          criado_por: currentUser.id,
        },
        form.itens
      );
      showSuccess('Carregamento criado com sucesso!');
      setModalCarregamentoAberto(false);
      setPedidoParaCarregamento(null);
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao criar carregamento. Verifique os dados e tente novamente.';
      showError(msg);
      throw err;
    }
  };

  const filtered = pedidos.filter((p) => {
    const client = clients.find((c) => c.id === p.cliente_id);
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchSearch =
      !normalizedSearch ||
      p.numero_pedido?.toLowerCase().includes(normalizedSearch) ||
      p.barra_pedido?.toLowerCase().includes(normalizedSearch) ||
      p.cliente_nome?.toLowerCase().includes(normalizedSearch) ||
      client?.name.toLowerCase().includes(normalizedSearch) ||
      client?.stateRegistration?.toLowerCase().includes(normalizedSearch);
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchFilial = !filialFilter || p.filial_id === filialFilter;
    return matchSearch && matchStatus && matchFilial;
  });
  const selectedPedido = pedidos.find((pedido) => pedido.id === selectedPedidoId) ?? null;
  const pedidosCronologicos = [...pedidos].reverse();
  const selectedPedidoPosition = pedidosCronologicos.findIndex(
    (pedido) => pedido.id === selectedPedidoId
  );

  const selectPedido = async (pedido: PedidoVenda) => {
    setSelectedPedidoId(pedido.id);
    setExpandedIds(new Set([pedido.id]));
    setSearchOpen(false);
    if (!itensPorPedido[pedido.id]) {
      const [itens, progresso, preferencia] = await Promise.all([
        getPedidoVendaItens(pedido.id),
        getQuantidadeCarregadaPorItem(pedido.id),
        getPedidoSaldoAlertaPreferencia(pedido.id, currentUser.id),
      ]);
      setItensPorPedido((current) => ({ ...current, [pedido.id]: itens }));
      setCarregadoPorItem((current) => ({ ...current, ...progresso }));
      setAlertaSaldo(preferencia);
    } else {
      setAlertaSaldo(await getPedidoSaldoAlertaPreferencia(pedido.id, currentUser.id));
    }
  };

  const openPedidoById = async (pedidoId: string) => {
    const pedido = pedidos.find((item) => item.id === pedidoId);
    if (!pedido) {
      showError('Este pedido não está disponível para o seu nível de acesso.');
      return;
    }
    setActiveTab('pedidos');
    await selectPedido(pedido);
  };

  const navigatePedido = async (direction: -1 | 1) => {
    const nextPosition = selectedPedidoPosition + direction;
    const pedido = pedidosCronologicos[nextPosition];
    if (pedido) await selectPedido(pedido);
  };

  const saveAlertaSaldo = async (preferencia: PedidoSaldoAlertaPreferencia) => {
    if (!selectedPedido) return;
    try {
      await savePedidoSaldoAlertaPreferencia(selectedPedido.id, currentUser.id, preferencia);
      setAlertaSaldo(preferencia);
      showSuccess('Preferência do alerta salva.');
    } catch {
      showError('Não foi possível salvar a preferência do alerta.');
    }
  };

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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('pedidos')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
            activeTab === 'pedidos'
              ? 'bg-white border border-b-white border-stone-200 text-emerald-700 -mb-px'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <ClipboardList className="w-4 h-4 inline mr-1.5 mb-0.5" />
          Pedidos
        </button>
        <button
          onClick={() => setActiveTab('relatorio')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
            activeTab === 'relatorio'
              ? 'bg-white border border-b-white border-stone-200 text-emerald-700 -mb-px'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1.5 mb-0.5" />
          Canc/Substitui
        </button>
        <button
          onClick={() => setActiveTab('saldos_cancelados')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
            activeTab === 'saldos_cancelados'
              ? 'bg-white border border-b-white border-stone-200 text-emerald-700 -mb-px'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <Ban className="w-4 h-4 inline mr-1.5 mb-0.5" />
          Saldos Cancelados
        </button>
      </div>

      {activeTab === 'relatorio' ? (
        <React.Suspense fallback={<LoadingFeature label="Carregando relatório..." />}>
          <RelatorioCancSubstitui currentUser={currentUser} onOpenPedido={openPedidoById} />
        </React.Suspense>
      ) : activeTab === 'saldos_cancelados' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, nº pedido ou usuário..."
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

          {/* Table */}
          {loadingCancelamentos ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
            </div>
          ) : (() => {
            const filteredCancelamentos = cancelamentos.filter((c) => {
              const pOrigem = pedidos.find((x) => x.id === c.pedido_origem_id);
              const clientObj = clients.find((x) => x.id === pOrigem?.cliente_id);
              const clientName = clientObj?.name || pOrigem?.cliente_nome || '';
              const orderNum = pOrigem?.numero_pedido || '';
              const orderBar = pOrigem?.barra_pedido || '';
              const userNome = c.usuario_nome || '';

              const matchSearch =
                !cancSearch ||
                clientName.toLowerCase().includes(cancSearch.toLowerCase()) ||
                orderNum.toLowerCase().includes(cancSearch.toLowerCase()) ||
                orderBar.toLowerCase().includes(cancSearch.toLowerCase()) ||
                userNome.toLowerCase().includes(cancSearch.toLowerCase());

              const createdDate = c.criado_em ? c.criado_em.split('T')[0] : '';
              const matchInicio = !cancDataInicio || createdDate >= cancDataInicio;
              const matchFim = !cancDataFim || createdDate <= cancDataFim;

              return matchSearch && matchInicio && matchFim;
            });

            if (filteredCancelamentos.length === 0) {
              return (
                <div className="text-center py-12 bg-white rounded-xl border border-stone-200 shadow-sm text-stone-400">
                  <Ban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum cancelamento definitivo de saldo encontrado</p>
                </div>
              );
            }

            return (
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
                      {filteredCancelamentos.map((c) => {
                        const pOrigem = pedidos.find((x) => x.id === c.pedido_origem_id);
                        const clientObj = clients.find((x) => x.id === pOrigem?.cliente_id);
                        const clientName = clientObj?.name || pOrigem?.cliente_nome || '—';
                        const farmName = clientObj?.fazenda || '—';

                        return (
                          <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                            <td className="px-5 py-4 font-mono font-bold">
                              {pOrigem ? (
                                <button
                                  type="button"
                                  onClick={() => void openPedidoById(pOrigem.id)}
                                  className="text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
                                >
                                  {pOrigem.barra_pedido ||
                                    (pOrigem.numero_pedido
                                      ? `${pOrigem.numero_pedido}/${pOrigem.emitente ?? 1}`
                                      : '—')}
                                </button>
                              ) : (
                                <span className="text-stone-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-stone-800 font-medium block">{clientName}</span>
                              {farmName !== '—' && (
                                <span className="text-stone-400 text-xs block">{farmName}</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right font-mono font-bold text-red-600">
                              {c.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ton
                            </td>
                            <td className="px-5 py-4 text-stone-600 max-w-xs truncate" title={c.motivo}>
                              {c.motivo || '—'}
                            </td>
                            <td className="px-5 py-4 text-stone-500 text-xs">
                              {c.criado_em
                                ? new Date(c.criado_em).toLocaleString('pt-BR')
                                : '—'}
                            </td>
                            <td className="px-5 py-4 text-stone-700 font-medium">
                              {c.usuario_nome || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {searchOpen ? 'Fechar pesquisa' : 'Pesquisar pedido'}
            </button>
          </div>

          {/* Filters */}
          {searchOpen && <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Pedido, nome do cliente ou I.E."
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
            <div className="mt-4 max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
              {filtered.map((pedido) => {
                const client = clients.find((item) => item.id === pedido.cliente_id);
                return (
                  <button
                    key={pedido.id}
                    type="button"
                    onClick={() => void selectPedido(pedido)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-emerald-50"
                  >
                    <span>
                      <strong className="block font-mono text-sm text-stone-800">
                        {pedido.numero_pedido
                          ? `${pedido.numero_pedido}/${pedido.emitente ?? 1}`
                          : pedido.barra_pedido || 'Sem número'}
                      </strong>
                      <span className="text-sm text-stone-500">
                        {client?.name || pedido.cliente_nome || 'Cliente não identificado'}
                      </span>
                    </span>
                    <span className="text-xs text-stone-400">
                      I.E. {client?.stateRegistration || 'não informada'}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-stone-400">
                  Nenhum pedido encontrado.
                </p>
              )}
            </div>
          </div>}

          {selectedPedido && (
            <nav
              className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3"
              aria-label="Navegação entre pedidos"
            >
              <button
                type="button"
                onClick={() => void navigatePedido(-1)}
                disabled={selectedPedidoPosition <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <span className="text-xs text-stone-500">
                Pedido {selectedPedidoPosition + 1} de {pedidosCronologicos.length}
              </span>
              <button
                type="button"
                onClick={() => void navigatePedido(1)}
                disabled={selectedPedidoPosition < 0 || selectedPedidoPosition >= pedidosCronologicos.length - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}

          {/* Cards */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
            </div>
          ) : !selectedPedido ? (
            <div className="text-center py-12 text-stone-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum pedido de venda encontrado</p>
              <p className="text-xs mt-1 text-stone-400">
                Crie um novo pedido usando o botão acima ou a partir de uma precificação
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const idadeDias = selectedPedido.criado_em
                  ? Math.floor((Date.now() - new Date(selectedPedido.criado_em).getTime()) / 86400000)
                  : 0;
                const itens = itensPorPedido[selectedPedido.id] ?? [];
                const saldoReal = itens.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      0,
                      Number(item.quantidade_ton || 0) -
                        (item.id ? (carregadoPorItem[item.id] ?? 0) : 0)
                    ),
                  0
                );
                if (
                  !podeReceberAlertaSaldo ||
                  alertaSaldo.desativado ||
                  saldoReal <= 0 ||
                  idadeDias < alertaSaldo.dias_limite
                )
                  return null;
                return (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p>
                        <strong>Atenção:</strong> este pedido ainda possui {saldoReal.toFixed(3)} t
                        para carregar há {idadeDias} dias.
                      </p>
                      <button
                        type="button"
                        onClick={() => void saveAlertaSaldo({ ...alertaSaldo, desativado: true })}
                        className="font-bold underline"
                      >
                        Desativar neste pedido
                      </button>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      Alertar após
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={alertaSaldo.dias_limite}
                        onChange={(event) =>
                          setAlertaSaldo((current) => ({
                            ...current,
                            dias_limite: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                        onBlur={() => void saveAlertaSaldo(alertaSaldo)}
                        className="w-20 rounded border border-amber-300 bg-white px-2 py-1"
                      />
                      dias
                    </label>
                  </div>
                );
              })()}
              {[selectedPedido].map((p) => {
                const isExpanded = expandedIds.has(p.id);
                const saldo = p.saldo_disponivel ?? null;
                const itensPedido = itensPorPedido[p.id] ?? [];
                const hasSaldoNosItens =
                  itensPedido.length === 0 ||
                  itensPedido.some(
                    (item) => Number(item.saldo_disponivel ?? item.quantidade_ton ?? 0) > 0
                  );

                const clientObj = clients.find((c) => c.id === p.cliente_id);
                const clientName = clientObj?.name || p.cliente_nome || '—';
                const farmName = clientObj?.fazenda || '—';

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
                              {p.barra_pedido ||
                                (p.numero_pedido
                                  ? `${p.numero_pedido}${p.emitente != null ? `/${p.emitente}` : ''}`
                                  : '—')}
                            </span>
                            <span className="text-stone-500 text-sm truncate">
                              | {clientName} {farmName !== '—' ? `(${farmName})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            <span className="text-xs text-stone-400">{fmtDate(p.data_pedido)}</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[p.status]}`}
                            >
                              {STATUS_LABEL[p.status]}
                            </span>
                            {p.status === 'concluido' && (
                              <span className="text-xs font-semibold text-stone-600">
                                Produto:{' '}
                                {p.produto_nome ||
                                  itensPedido.map((item) => item.produto_nome).join(', ') ||
                                  'não informado'}
                              </span>
                            )}
                            {(p.quantidade_cancelada_definitiva ?? 0) > 0 &&
                              p.status !== 'cancelado' && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                  Cancelamento parcial
                                </span>
                              )}
                            {p.embalagem && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600">
                                📦 {p.embalagem}
                              </span>
                            )}
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
                                      onClick={() => {
                                        setPedidoParaCarregamento(p);
                                        setModalCarregamentoAberto(true);
                                      }}
                                      disabled={!hasSaldoNosItens}
                                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:bg-stone-300 disabled:cursor-not-allowed"
                                    >
                                      🚛 Solicitar Carregamento
                                    </button>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Itens do pedido (multi-produto) */}
                        {itensPorPedido[p.id] && itensPorPedido[p.id].length > 0 && (
                          <div className="mt-3 border-t border-stone-100 pt-3">
                            <p className="text-xs font-bold text-stone-400 uppercase mb-2">
                              Produtos do Pedido
                            </p>
                            <div className="space-y-1">
                              {itensPorPedido[p.id].map((item, i) => {
                                const total = Number(item.quantidade_ton || 0);
                                const carregado = Math.min(
                                  total,
                                  Math.max(0, item.id ? (carregadoPorItem[item.id] ?? 0) : 0)
                                );
                                const saldoItem = Math.max(0, total - carregado);
                                const progresso =
                                  total > 0 ? Math.min(100, (carregado / total) * 100) : 0;
                                return (
                                <div
                                  key={item.id ?? i}
                                  className="space-y-2 rounded-lg border border-stone-100 p-3 text-sm"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-stone-700">{item.produto_nome}</span>
                                    <span className="text-xs text-stone-500">
                                      {carregado.toFixed(3)} t carregadas · {saldoItem.toFixed(3)} t restantes
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                                    <div
                                      className="h-full rounded-full bg-emerald-500 transition-all"
                                      style={{ width: `${progresso}%` }}
                                      role="progressbar"
                                      aria-label={`Progresso de ${item.produto_nome}`}
                                      aria-valuenow={Math.round(progresso)}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                    />
                                  </div>
                                  <p className="text-right text-[10px] font-bold text-stone-400">
                                    {progresso.toFixed(1)}% carregado
                                  </p>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Dados do Cliente */}
                        {clientObj && (
                          <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                              Dados do Cliente
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="font-semibold text-stone-500 block mb-0.5">Razão Social / Nome</span>
                                <span className="text-stone-800 font-medium text-sm">{clientObj.name}</span>
                              </div>
                              {clientObj.document && (
                                <div>
                                  <span className="font-semibold text-stone-500 block mb-0.5">CNPJ / CPF</span>
                                  <span className="text-stone-800 font-medium">{clientObj.document}</span>
                                </div>
                              )}
                              {clientObj.stateRegistration && (
                                <div>
                                  <span className="font-semibold text-stone-500 block mb-0.5">Inscrição Estadual (IE)</span>
                                  <span className="text-stone-800 font-medium">{clientObj.stateRegistration}</span>
                                </div>
                              )}
                              {clientObj.phone && (
                                <div>
                                  <span className="font-semibold text-stone-500 block mb-0.5">Telefone</span>
                                  <span className="text-stone-800 font-medium">{clientObj.phone}</span>
                                </div>
                              )}
                              {clientObj.email && (
                                <div>
                                  <span className="font-semibold text-stone-500 block mb-0.5">E-mail</span>
                                  <span className="text-stone-800 font-medium truncate block">{clientObj.email}</span>
                                </div>
                              )}
                              {clientObj.fazenda && (
                                <div>
                                  <span className="font-semibold text-stone-500 block mb-0.5">Fazenda</span>
                                  <span className="text-stone-800 font-medium">{clientObj.fazenda}</span>
                                </div>
                              )}
                              {(clientObj.deliveryAddress || clientObj.address) && (
                                <div className="md:col-span-3 border-t border-stone-200/60 pt-2">
                                  <span className="font-semibold text-stone-500 block mb-1">Endereço de Entrega</span>
                                  <span className="text-stone-700">
                                    {(() => {
                                      const addr = clientObj.deliveryAddress || clientObj.address;
                                      if (!addr) return '—';
                                      return `${addr.street}${addr.number ? `, ${addr.number}` : ''}${addr.neighborhood ? ` - ${addr.neighborhood}` : ''}${addr.city ? ` - ${addr.city}` : ''}${addr.state ? `/${addr.state}` : ''}${addr.cep ? ` (CEP: ${addr.cep})` : ''}`;
                                    })()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Extra info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-stone-100">
                          {p.precificacao_id && (
                            <div>
                              <p className="font-bold text-stone-400 uppercase mb-0.5">Precificação</p>
                              <p className="text-stone-700 font-mono font-bold">
                                {pricingRecords.find((x) => x.id === p.precificacao_id)?.cod || p.precificacao_id.slice(0, 8)}
                              </p>
                            </div>
                          )}
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
                              <p className="font-bold text-stone-400 uppercase mb-0.5">
                                Preço Unit.
                              </p>
                              <p className="text-stone-700">
                                R${' '}
                                {p.preco_unitario.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          )}
                          {p.pedido_pai_id && (
                            <div>
                              <p className="font-bold text-stone-400 uppercase mb-0.5">
                                Pedido Pai
                              </p>
                              <p className="text-stone-600 font-mono text-xs">
                                {pedidos.find((x) => x.id === p.pedido_pai_id)?.barra_pedido ??
                                  p.pedido_pai_id.slice(0, 8)}
                              </p>
                            </div>
                          )}
                          {p.observacoes && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="font-bold text-stone-400 uppercase mb-0.5">
                                Observações
                              </p>
                              <p className="text-stone-700">{p.observacoes}</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-stone-100">
                          <h4 className="text-xs uppercase font-bold text-stone-500 mb-2">
                            Histórico de Carregamentos
                          </h4>
                          <HistoricoCarregamentosPedido pedidoVendaId={p.id} />
                        </div>

                        {/* Action buttons — Canc/Substitui + Cancelar Definitivo */}
                        {p.status !== 'cancelado' && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                            <button
                              onClick={() => setPedidoCancSubstitui(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-800 border border-orange-300 text-xs font-bold rounded-lg hover:bg-orange-200 transition-colors"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              Canc/Substitui
                            </button>
                            <button
                              onClick={() => setPedidoCancelamentoDefinitivo(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 border border-red-300 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Cancelar Definitivo
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <React.Suspense fallback={<LoadingFeature label="Carregando formulário..." overlay />}>
        {showNovoPedido && (
          <NovoPedidoVendaModal
            pricing={null}
            currentUser={currentUser}
            onClose={() => setShowNovoPedido(false)}
            onSuccess={load}
          />
        )}

        {pedidoCancSubstitui && (
          <CancSubstituiModal
            pedido={pedidoCancSubstitui}
            currentUser={currentUser}
            onClose={() => setPedidoCancSubstitui(null)}
            onSuccess={load}
          />
        )}

        {pedidoCancelamentoDefinitivo && (
          <CancelamentoDefinitivoModal
            pedido={pedidoCancelamentoDefinitivo}
            currentUser={currentUser}
            onClose={() => setPedidoCancelamentoDefinitivo(null)}
            onSuccess={load}
          />
        )}

        {modalCarregamentoAberto && (
          <ModalNovoCarregamento
            filiais={filiais}
            pedidoVinculado={pedidoParaCarregamento ?? undefined}
            onSave={handleSolicitarCarregamento}
            onClose={() => {
              setModalCarregamentoAberto(false);
              setPedidoParaCarregamento(null);
            }}
          />
        )}
      </React.Suspense>
    </div>
  );
}
