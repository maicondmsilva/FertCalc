import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, ClipboardList, FileText, Plus, RefreshCw, Search } from 'lucide-react';
import type { Branch, Client, PedidoVenda, PedidoVendaItem, PricingRecord, User } from '../types';
import {
  getCarteiraPedidos,
  getPedidoSaldoAlertaPreferencia,
  getPedidoVendaById,
  getPedidoVendaItens,
  getResumoCarteira,
  savePedidoSaldoAlertaPreferencia,
  type PedidoSaldoAlertaPreferencia,
  type ResumoCarteira,
} from '../services/pedidosVendaService';
import { createCarregamento, getFiliais } from '../services/carregamentoService';
import { getBranches, getClients, getPricingRecords } from '../services/db';
import { canReceiveSaldoPedidoAlert } from '../services/alertConfigService';
import { subscribeToOrderLoadingChanges } from '../services/orderLoadingSubscription';
import { getStatusInicial } from '../utils/getStatusInicial';
import type { CarregamentoFormData } from './Carregamento';
import type { Filial } from '../types/carregamento';
import { useToast } from './Toast';
import Pagination from './ui/Pagination';
import { PedidosCarteiraTable } from './pedidosVenda/PedidosCarteiraTable';
import { PedidoDetailPanel } from './pedidosVenda/PedidoDetailPanel';
import { CancelamentosReportView } from './pedidosVenda/CancelamentosReportView';
import { STATUS_LABEL, formatTon, pedidoLabel } from './pedidosVenda/pedidosVendaModel';

const NovoPedidoVendaModal = React.lazy(() => import('./NovoPedidoVendaModal'));
const EditarPedidoVendaModal = React.lazy(() => import('./EditarPedidoVendaModal'));
const CancSubstituiModal = React.lazy(() => import('./CancSubstituiModal'));
const CancelamentoDefinitivoModal = React.lazy(() => import('./CancelamentoDefinitivoModal'));
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
          : 'flex min-h-48 items-center justify-center rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-500'
      }
    >
      {label}
    </div>
  );
}

interface PedidosVendaProps {
  currentUser: User;
}

type ActiveTab = 'pedidos' | 'relatorio' | 'saldos_cancelados';
const DIAS_PARADO = 30;
const DEFAULT_ALERTA: PedidoSaldoAlertaPreferencia = { dias_limite: 30, desativado: false };

export default function PedidosVenda({ currentUser }: PedidosVendaProps) {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('pedidos');

  // Carteira
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoCarteira | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filialFilter, setFilialFilter] = useState('');
  const [safraFilter, setSafraFilter] = useState('');

  // Cadastros de apoio
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>([]);

  // Detalhe
  const [selected, setSelected] = useState<PedidoVenda | null>(null);
  const [itens, setItens] = useState<PedidoVendaItem[]>([]);
  const [alerta, setAlerta] = useState<PedidoSaldoAlertaPreferencia>(DEFAULT_ALERTA);
  const [podeReceberAlerta, setPodeReceberAlerta] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  // Modais
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [pedidoEdicao, setPedidoEdicao] = useState<PedidoVenda | null>(null);
  const [pedidoCancSubstitui, setPedidoCancSubstitui] = useState<PedidoVenda | null>(null);
  const [pedidoCancelamento, setPedidoCancelamento] = useState<PedidoVenda | null>(null);
  const [pedidoCarregamento, setPedidoCarregamento] = useState<PedidoVenda | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const loadCarteira = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, summary] = await Promise.all([
        getCarteiraPedidos(
          {
            busca: buscaAplicada,
            status: statusFilter,
            filialId: filialFilter,
            safra: safraFilter,
          },
          page,
          pageSize
        ),
        getResumoCarteira({ filialId: filialFilter, safra: safraFilter }, DIAS_PARADO),
      ]);
      setPedidos(result.data);
      setTotal(result.total);
      setResumo(summary);
      const current = result.data.find((pedido) => pedido.id === selectedIdRef.current);
      if (current) setSelected(current);
    } catch (error) {
      console.error('Erro ao carregar pedidos de venda:', error);
      setLoadError('Não foi possível carregar os pedidos de venda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [buscaAplicada, statusFilter, filialFilter, safraFilter, page, pageSize]);

  useEffect(() => {
    void loadCarteira();
  }, [loadCarteira]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToOrderLoadingChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void loadCarteira(), 350);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [loadCarteira]);

  useEffect(() => {
    Promise.allSettled([getBranches(), getFiliais(), getClients(), getPricingRecords()]).then(
      ([branchesResult, filiaisResult, clientsResult, pricingResult]) => {
        if (branchesResult.status === 'fulfilled') setBranches(branchesResult.value);
        if (filiaisResult.status === 'fulfilled') setFiliais(filiaisResult.value);
        if (clientsResult.status === 'fulfilled') setClients(clientsResult.value);
        if (pricingResult.status === 'fulfilled') setPricingRecords(pricingResult.value);
      }
    );
    canReceiveSaldoPedidoAlert(currentUser.id, currentUser.role)
      .then(setPodeReceberAlerta)
      .catch(() => setPodeReceberAlerta(false));
  }, [currentUser.id, currentUser.role]);

  const openPedido = useCallback(
    async (pedido: PedidoVenda) => {
      selectedIdRef.current = pedido.id;
      setSelected(pedido);
      setItens([]);
      setAlerta(DEFAULT_ALERTA);
      const [itensResult, alertaResult] = await Promise.allSettled([
        getPedidoVendaItens(pedido.id),
        getPedidoSaldoAlertaPreferencia(pedido.id, currentUser.id),
      ]);
      if (selectedIdRef.current !== pedido.id) return;
      if (itensResult.status === 'fulfilled') setItens(itensResult.value);
      if (alertaResult.status === 'fulfilled') setAlerta(alertaResult.value);
    },
    [currentUser.id]
  );

  const openPedidoById = async (pedidoId: string) => {
    const pedido =
      pedidos.find((item) => item.id === pedidoId) ?? (await getPedidoVendaById(pedidoId));
    if (!pedido) {
      showError('Este pedido não está disponível para o seu nível de acesso.');
      return;
    }
    setActiveTab('pedidos');
    await openPedido(pedido);
  };

  const closePedido = () => {
    selectedIdRef.current = null;
    setSelected(null);
  };

  const refreshAfterChange = async () => {
    await loadCarteira();
    if (selectedIdRef.current) {
      const fresh = await getPedidoVendaById(selectedIdRef.current);
      if (fresh) await openPedido({ ...selected, ...fresh } as PedidoVenda);
    }
  };

  const saveAlerta = async (preferencia: PedidoSaldoAlertaPreferencia) => {
    if (!selected) return;
    try {
      await savePedidoSaldoAlertaPreferencia(selected.id, currentUser.id, preferencia);
      setAlerta(preferencia);
      showSuccess('Preferência do alerta salva.');
    } catch {
      showError('Não foi possível salvar a preferência do alerta.');
    }
  };

  const handleSolicitarCarregamento = async (form: CarregamentoFormData) => {
    try {
      await createCarregamento(
        {
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
        form.itens,
        form.request_id
      );
      showSuccess('Carregamento solicitado.');
      setPedidoCarregamento(null);
      await refreshAfterChange();
    } catch (err: unknown) {
      showError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro ao criar carregamento. Verifique os dados e tente novamente.'
      );
      throw err;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedClient = selected
    ? clients.find((client) => client.id === selected.cliente_id)
    : undefined;
  const pricingCode = selected?.precificacao_id
    ? String(
        pricingRecords.find((record) => record.id === selected.precificacao_id)?.cod ??
          selected.precificacao_id.slice(0, 8)
      )
    : undefined;
  const parentLabel = selected?.pedido_pai_id
    ? (() => {
        const parent = pedidos.find((item) => item.id === selected.pedido_pai_id);
        return parent ? pedidoLabel(parent) : 'Ver em Canc/Substitui';
      })()
    : undefined;

  const tabs: Array<{ id: ActiveTab; label: string; icon: typeof ClipboardList }> = [
    { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
    { id: 'relatorio', label: 'Canc/Substitui', icon: FileText },
    { id: 'saldos_cancelados', label: 'Saldos cancelados', icon: Ban },
  ];

  const kpis = resumo
    ? [
        {
          label: 'Pedidos ativos',
          value: String(resumo.ativos),
          hint: `${resumo.emCarregamento} em carregamento`,
        },
        {
          label: 'Volume ativo',
          value: formatTon(resumo.volumeAtivo),
          hint: 'vendido nos pedidos ativos',
        },
        {
          label: 'Saldo a carregar',
          value: formatTon(resumo.saldoACarregar),
          hint: `${formatTon(resumo.carregado)} já carregadas`,
          accent: true,
        },
        {
          label: 'Parados',
          value: String(resumo.parados),
          hint: `sem nova carga há ${DIAS_PARADO}+ dias`,
          warning: resumo.parados > 0,
        },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Comercial</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight text-stone-900">
            <ClipboardList className="h-7 w-7 text-emerald-600" aria-hidden="true" />
            Pedidos de Venda
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Carteira de pedidos, saldo a carregar e cancelamentos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadCarteira()}
            aria-label="Atualizar"
            className="grid h-11 w-11 place-items-center rounded-xl border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowNovoPedido(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Novo pedido
          </button>
        </div>
      </header>

      <div
        className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-bold sm:w-fit"
        role="tablist"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-xs sm:flex-none sm:px-4 sm:text-sm ${
              activeTab === id
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Icon className="hidden h-4 w-4 shrink-0 sm:block" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'relatorio' && (
        <CancelamentosReportView
          mode="canc_substitui"
          onOpenPedido={(id) => void openPedidoById(id)}
        />
      )}

      {activeTab === 'saldos_cancelados' && (
        <CancelamentosReportView mode="definitivo" onOpenPedido={(id) => void openPedidoById(id)} />
      )}

      {activeTab === 'pedidos' && (
        <>
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    kpi.warning ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <p
                    className={`text-xs font-bold uppercase tracking-wide ${
                      kpi.warning ? 'text-amber-600' : 'text-stone-400'
                    }`}
                  >
                    {kpi.label}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-black ${
                      kpi.warning
                        ? 'text-amber-700'
                        : kpi.accent
                          ? 'text-emerald-700'
                          : 'text-stone-900'
                    }`}
                  >
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">{kpi.hint}</p>
                </div>
              ))}
            </div>
          )}

          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-3 border-b border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
              <label className="relative block">
                <span className="sr-only">Buscar pedido</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Pedido, cliente, I.E., produto, vendedor ou contrato"
                  className="h-11 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Status"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todos os status</option>
                {(Object.keys(STATUS_LABEL) as PedidoVenda['status'][]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <select
                value={filialFilter}
                onChange={(event) => {
                  setFilialFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Filial"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <select
                value={safraFilter}
                onChange={(event) => {
                  setSafraFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Safra"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas as safras</option>
                {(resumo?.safras ?? []).map((safra) => (
                  <option key={safra} value={safra}>
                    Safra {safra}
                  </option>
                ))}
              </select>
            </div>

            {loadError ? (
              <div className="m-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={() => void loadCarteira()}
                  className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800"
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading && pedidos.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-stone-400">Carregando pedidos…</p>
            ) : pedidos.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-stone-300" />
                <p className="mt-2 font-bold text-stone-700">Nenhum pedido encontrado</p>
                <p className="text-sm text-stone-500">
                  Ajuste os filtros ou crie um pedido pelo botão acima ou a partir de uma
                  precificação.
                </p>
              </div>
            ) : (
              <PedidosCarteiraTable
                pedidos={pedidos}
                selectedId={selected?.id}
                diasParado={DIAS_PARADO}
                onSelect={(pedido) => void openPedido(pedido)}
              />
            )}

            <div className="border-t border-stone-100 px-4 py-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                firstItemNumber={total === 0 ? 0 : (page - 1) * pageSize + 1}
                lastItemNumber={Math.min(total, page * pageSize)}
                pageSize={pageSize}
                pageSizeOptions={[25, 50, 100]}
                itemLabel="pedidos"
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </section>
        </>
      )}

      {/* Painel lateral do pedido */}
      {selected && activeTab === 'pedidos' && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Fechar detalhe"
            onClick={closePedido}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />
          <div className="relative h-full w-full max-w-2xl shadow-2xl">
            <PedidoDetailPanel
              pedido={selected}
              itens={itens}
              client={selectedClient}
              pricingCode={pricingCode}
              parentLabel={parentLabel}
              alerta={alerta}
              podeReceberAlerta={podeReceberAlerta}
              onSaveAlerta={(preferencia) => void saveAlerta(preferencia)}
              onClose={closePedido}
              onEdit={() => setPedidoEdicao(selected)}
              onSolicitarCarregamento={() => setPedidoCarregamento(selected)}
              onCancSubstitui={() => setPedidoCancSubstitui(selected)}
              onCancelamentoDefinitivo={() => setPedidoCancelamento(selected)}
              onChanged={() => void refreshAfterChange()}
            />
          </div>
        </div>
      )}

      <React.Suspense fallback={<LoadingFeature label="Carregando formulário…" overlay />}>
        {showNovoPedido && (
          <NovoPedidoVendaModal
            pricing={null}
            currentUser={currentUser}
            onClose={() => setShowNovoPedido(false)}
            onSuccess={() => void loadCarteira()}
          />
        )}
        {pedidoEdicao && (
          <EditarPedidoVendaModal
            pedido={pedidoEdicao}
            items={itens}
            clients={clients}
            pricingRecords={pricingRecords}
            branches={branches}
            currentUser={currentUser}
            onClose={() => setPedidoEdicao(null)}
            onSuccess={() => void refreshAfterChange()}
          />
        )}
        {pedidoCancSubstitui && (
          <CancSubstituiModal
            pedido={pedidoCancSubstitui}
            currentUser={currentUser}
            onClose={() => setPedidoCancSubstitui(null)}
            onSuccess={() => void refreshAfterChange()}
          />
        )}
        {pedidoCancelamento && (
          <CancelamentoDefinitivoModal
            pedido={pedidoCancelamento}
            currentUser={currentUser}
            onClose={() => setPedidoCancelamento(null)}
            onSuccess={() => void refreshAfterChange()}
          />
        )}
        {pedidoCarregamento && (
          <ModalNovoCarregamento
            filiais={filiais}
            pedidoVinculado={pedidoCarregamento}
            onSave={handleSolicitarCarregamento}
            onClose={() => setPedidoCarregamento(null)}
          />
        )}
      </React.Suspense>
    </div>
  );
}
