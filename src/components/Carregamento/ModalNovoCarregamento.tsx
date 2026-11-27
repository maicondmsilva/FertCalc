import React, { useState, useEffect } from 'react';
import { PedidoVenda, PedidoVendaItem } from '../../types';
import { AlertTriangle, Plus, X, Search, Pencil } from 'lucide-react';
import {
  Carregamento,
  CotacaoSolicitada,
  Filial,
  LocalCarregamento,
} from '../../types/carregamento';
import { getCotacaoById } from '../../services/cotacaoSolicitadaService';
import { getFiliais } from '../../services/carregamentoService';
import { getPricingRecords } from '../../services/db';
import { getPedidosVenda, getPedidoVendaItens } from '../../services/pedidosVendaService';
import { getLocaisAtivos } from '../../services/locaisCarregamentoService';
import { useToast } from '../Toast';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import {
  CarregamentoFormData,
  EnrichedPedido,
  ItemCarregamentoState,
  ModalNovoCarregamentoProps,
  PedidoVendaItemComSaldo,
  derivarTipoFrete,
} from './shared';

export function ModalNovoCarregamento({
  filiais,
  onSave,
  onClose,
  pedidoVinculado,
  carregamentoEditando,
}: ModalNovoCarregamentoProps) {
  const { showError } = useToast();
  const isEditMode = !!carregamentoEditando;
  const creationRequestId = React.useRef(crypto.randomUUID());
  const submitBusy = React.useRef(false);
  const [form, setForm] = useState<CarregamentoFormData>(() => {
    if (carregamentoEditando) {
      return {
        tipo_frete: (carregamentoEditando.tipo_frete as 'CIF' | 'FOB') || 'FOB',
        quantidade_total: carregamentoEditando.quantidade_total
          ? String(carregamentoEditando.quantidade_total)
          : '',
        filial_id: carregamentoEditando.filial_id || '',
        local_carregamento_id: carregamentoEditando.local_carregamento_id || '',
        data_prevista_carregamento: carregamentoEditando.data_prevista_carregamento || '',
        observacoes: carregamentoEditando.observacoes || '',
        pedido_venda_id: carregamentoEditando.pedido_venda_id || '',
        pedido_venda_numero: carregamentoEditando.pedido_venda_numero || '',
        precificacao_id: carregamentoEditando.pedido_precificacao_id || '',
        cliente_nome: '',
        valor_frete: carregamentoEditando.valor_frete
          ? String(carregamentoEditando.valor_frete)
          : '',
        _freteAutoDetectado: false,
        _freteOrigem: undefined,
        itens: [],
      };
    }
    return {
      tipo_frete: (pedidoVinculado?.tipo_frete as 'CIF' | 'FOB') || ('FOB' as 'CIF' | 'FOB'),
      quantidade_total: pedidoVinculado?.saldo_disponivel
        ? String(pedidoVinculado.saldo_disponivel)
        : '',
      // Pedido vinculado: filial, local e previsão já vêm dele.
      filial_id: pedidoVinculado?.filial_id || '',
      local_carregamento_id: pedidoVinculado?.local_carregamento_id || '',
      data_prevista_carregamento: pedidoVinculado?.previsao_entrega || '',
      observacoes: '',
      pedido_venda_id: pedidoVinculado?.id || '',
      pedido_venda_numero: pedidoVinculado
        ? pedidoVinculado.barra_pedido ||
          `${pedidoVinculado.numero_pedido}/${pedidoVinculado.emitente ?? 1}`
        : '',
      precificacao_id: pedidoVinculado?.precificacao_id || '',
      cliente_nome: pedidoVinculado?.cliente_nome || '',
      valor_frete:
        pedidoVinculado?.tipo_frete === 'CIF' && pedidoVinculado?.valor_frete != null
          ? String(pedidoVinculado.valor_frete)
          : '',
      _freteAutoDetectado: pedidoVinculado?.valor_frete != null,
      _freteOrigem: pedidoVinculado?.valor_frete != null ? 'pedido' : undefined,
      itens: [],
    };
  });
  const [saving, setSaving] = useState(false);
  // Aberto de dentro de um pedido: sem busca, tudo vem do pedido.
  const pedidoFixo = Boolean(pedidoVinculado && !isEditMode);
  const [cotacaoPedido, setCotacaoPedido] = useState<CotacaoSolicitada | null>(null);
  useEffect(() => {
    if (!pedidoFixo || !pedidoVinculado?.cotacao_frete_id) return;
    getCotacaoById(pedidoVinculado.cotacao_frete_id)
      .then(setCotacaoPedido)
      .catch(() => setCotacaoPedido(null));
  }, [pedidoFixo, pedidoVinculado?.cotacao_frete_id]);
  const [pedidoSearch, setPedidoSearch] = useState(pedidoVinculado?.numero_pedido || '');
  const [allPedidos, setAllPedidos] = useState<EnrichedPedido[]>([]);
  const [pedidoResults, setPedidoResults] = useState<EnrichedPedido[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  // Bug 3 fix — fallback para filiais da prop (vindas de branches/Configurações)
  const [localFiliais, setLocalFiliais] = useState<Filial[]>([]);
  // Track selected pedido de venda for saldo validation
  const [selectedPedidoVenda, setSelectedPedidoVenda] = useState<PedidoVenda | null>(
    pedidoVinculado ?? null
  );
  const [pedidoItens, setPedidoItens] = useState<PedidoVendaItem[]>([]);
  const [itensCarregamento, setItensCarregamento] = useState<ItemCarregamentoState[]>([]);
  const [carregandoPedidoItens, setCarregandoPedidoItens] = useState(false);
  const todosItensEsgotados =
    pedidoItens.length > 0 &&
    pedidoItens.every(
      (item) => Number((item as PedidoVendaItemComSaldo).saldo_disponivel ?? 0) <= 0
    );

  useEffect(() => {
    if (filiais.length === 0) {
      getFiliais()
        .then(setLocalFiliais)
        .catch((err) => {
          console.error('Erro ao carregar filiais:', err);
        });
    }
  }, [filiais]);

  useEffect(() => {
    getLocaisAtivos()
      .then(setLocais)
      .catch(() => setLocais([]));
  }, []);

  const filiaisDisponiveis = filiais.length > 0 ? filiais : localFiliais;

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [pedidos, pricings] = await Promise.all([getPedidosVenda(), getPricingRecords()]);
        if (cancelled) return;
        const pricingsMap = new Map(pricings.map((pr) => [pr.id, pr]));

        // Bug 1 fix — pedidos de venda enriquecidos com dados da precificação
        const pedidosEnriched: EnrichedPedido[] = pedidos.map((p) => {
          const pricing = p.precificacao_id ? pricingsMap.get(p.precificacao_id) : undefined;
          return {
            ...p,
            precificacao_id: p.precificacao_id ?? null,
            pricing,
            clientName: pricing?.factors?.client?.name,
            _source: 'pedido' as const,
          };
        });

        // Bug 1 fix — precificações SEM pedido de venda vinculado
        const pedidosComPrecificacao = new Set(pedidos.map((p) => p.precificacao_id));
        const pricingsSemPedido: EnrichedPedido[] = pricings
          .filter((pr) => !pedidosComPrecificacao.has(pr.id))
          .map((pr) => ({
            id: null,
            precificacao_id: pr.id,
            numero_pedido: null,
            barra_pedido: null,
            quantidade_real: pr.factors?.totalTons ?? null,
            tipo_frete: null,
            pricing: pr,
            clientName: pr.factors?.client?.name,
            _source: 'pricing' as const,
          }));

        setAllPedidos([...pedidosEnriched, ...pricingsSemPedido]);
      } catch (err) {
        console.error('Erro ao carregar pedidos/precificações:', err);
        showError('Erro ao carregar pedidos de venda.');
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lq = pedidoSearch.trim().toLowerCase();
    if (lq.length < 2) {
      setPedidoResults([]);
      return;
    }
    // Bug 1 fix — busca em todos os campos relevantes
    const filtered = allPedidos.filter((p) => {
      const searchFields = [
        p.numero_pedido,
        p.barra_pedido,
        p.clientName,
        p.pricing?.formattedCod,
        p.pricing?.userName,
        p.pricing?.factors?.client?.name,
        p.pricing?.cod != null ? String(p.pricing.cod) : null,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return searchFields.some((f) => f.includes(lq));
    });
    setPedidoResults(filtered.slice(0, 10));
  }, [pedidoSearch, allPedidos]);

  useEffect(() => {
    let cancelled = false;

    const loadPedidoItens = async () => {
      if (!form.pedido_venda_id) {
        setPedidoItens([]);
        setItensCarregamento([]);
        setCarregandoPedidoItens(false);
        setForm((prev) => ({ ...prev, itens: [] }));
        return;
      }

      try {
        setPedidoItens([]);
        setItensCarregamento([]);
        setCarregandoPedidoItens(true);
        const itens = await getPedidoVendaItens(form.pedido_venda_id);
        if (cancelled) return;
        setPedidoItens(itens);
        setItensCarregamento(
          itens.map((item) => ({
            item,
            selecionado: true,
            quantidade: item.quantidade_ton ? String(item.quantidade_ton) : '',
          }))
        );
      } catch (err) {
        console.error('Erro ao carregar itens do pedido:', err);
        if (cancelled) return;
        setPedidoItens([]);
        setItensCarregamento([]);
      } finally {
        if (!cancelled) setCarregandoPedidoItens(false);
      }
    };

    loadPedidoItens();
    return () => {
      cancelled = true;
    };
  }, [form.pedido_venda_id]);

  useEffect(() => {
    if (!form.pedido_venda_id || pedidoItens.length === 0) {
      return;
    }

    const itensSelecionados = itensCarregamento
      .filter((it) => it.selecionado)
      .map((it) => ({
        pedido_venda_item_id: it.item.id,
        produto_nome: it.item.produto_nome,
        quantidade_ton: Number(it.quantidade || 0),
        embalagem: it.item.embalagem,
      }))
      .filter((it) => it.quantidade_ton > 0);

    const total = itensSelecionados.reduce((sum, it) => sum + it.quantidade_ton, 0);
    const totalStr = total > 0 ? total.toFixed(3).replace(/\.?0+$/, '') : '';

    setForm((prev) => ({
      ...prev,
      quantidade_total: totalStr,
      itens: itensSelecionados,
    }));
  }, [itensCarregamento, pedidoItens, form.pedido_venda_id]);

  const selectPedido = (p: EnrichedPedido) => {
    const pricing = p.pricing;
    const tipoFrete = derivarTipoFrete(p, pricing);
    const temFretePedido = p.valor_frete != null;
    const temFretePricing = pricing?.factors?.freight != null;
    const pedidoFreteVal = Number(p.valor_frete ?? 0);
    const pricingFreteVal = Number(pricing?.factors?.freight ?? 0);
    const freteVal = temFretePedido ? pedidoFreteVal : pricingFreteVal;
    const freteOrigem = temFretePedido ? 'pedido' : temFretePricing ? 'precificacao' : undefined;
    const numeroPedido = p._source === 'pedido' ? p.numero_pedido || '' : '';
    setForm((prev) => ({
      ...prev,
      pedido_venda_id: p.id || '',
      pedido_venda_numero: numeroPedido,
      precificacao_id: p.precificacao_id || pricing?.id || '',
      quantidade_total: p.quantidade_real
        ? String(p.quantidade_real)
        : pricing?.factors?.totalTons
          ? String(pricing.factors.totalTons)
          : prev.quantidade_total,
      tipo_frete: tipoFrete,
      valor_frete: freteOrigem ? freteVal.toFixed(2) : '',
      cliente_nome: p.clientName || pricing?.factors?.client?.name || '',
      _freteAutoDetectado: !!freteOrigem,
      _freteOrigem: freteOrigem,
      itens: [],
    }));
    // Track selected pedido de venda for saldo validation
    if (p._source === 'pedido' && p.id) {
      setSelectedPedidoVenda({
        id: p.id,
        precificacao_id: p.precificacao_id ?? '',
        numero_pedido: p.numero_pedido ?? undefined,
        quantidade_real: p.quantidade_real ?? undefined,
        saldo_disponivel: p.saldo_disponivel ?? undefined,
        status: p.status ?? 'pendente',
      } as PedidoVenda);
    } else {
      setSelectedPedidoVenda(null);
    }
    // Bug 1 fix — label correto dependendo da origem
    if (p._source === 'pricing') {
      setPedidoSearch(`Precificação #${pricing?.formattedCod || pricing?.cod || ''}`);
    } else {
      setPedidoSearch(p.barra_pedido || p.numero_pedido || p.clientName || '');
    }
    setPedidoResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitBusy.current) return;

    if (form.pedido_venda_id && pedidoItens.length > 0) {
      const itensQtdInvalida = itensCarregamento
        .filter((entry) => entry.selecionado)
        .filter((entry) => Number(entry.quantidade || 0) <= 0)
        .map((entry) => entry.item.produto_nome);

      const itensAcimaSaldo = itensCarregamento
        .filter((entry) => entry.selecionado)
        .filter((entry) => {
          const quantidade = Number(entry.quantidade || 0);
          const rawSaldo = (entry.item as PedidoVendaItemComSaldo).saldo_disponivel;
          const rawQtd = entry.item.quantidade_ton;
          const temSaldoDefinido = rawSaldo != null || rawQtd != null;

          if (!temSaldoDefinido) return false;

          const saldoDisponivel = Number(rawSaldo ?? rawQtd ?? 0);
          return quantidade > saldoDisponivel;
        })
        .map((entry) => entry.item.produto_nome);

      if (itensQtdInvalida.length > 0 || itensAcimaSaldo.length > 0) {
        const partes: string[] = [];
        if (itensQtdInvalida.length > 0) {
          partes.push(`quantidade inválida: ${itensQtdInvalida.join(', ')}`);
        }
        if (itensAcimaSaldo.length > 0) {
          partes.push(`acima do saldo: ${itensAcimaSaldo.join(', ')}`);
        }
        showError(`Revise os itens selecionados (${partes.join(' | ')}).`);
        return;
      }
    }

    submitBusy.current = true;
    setSaving(true);
    try {
      await onSave({ ...form, request_id: creationRequestId.current });
    } catch {
      // Error toast is handled by the parent (handleCreateCarregamento)
    } finally {
      submitBusy.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="w-5 h-5 text-amber-600" /> Editar Carregamento
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-amber-600" />{' '}
                {pedidoFixo ? 'Solicitar carregamento' : 'Novo Carregamento'}
              </>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {pedidoFixo && pedidoVinculado && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-900 px-4 py-3 text-white">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-black">Pedido {form.pedido_venda_numero}</p>
                  <p className="truncate text-xs text-stone-300">
                    {[
                      pedidoVinculado.cliente_nome,
                      pedidoVinculado.regiao_nome && `Região ${pedidoVinculado.regiao_nome}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                  vinculado
                </span>
              </div>
              <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950 sm:grid-cols-2">
                <p>
                  <span className="block text-[11px] font-bold uppercase text-emerald-700">
                    Frete
                  </span>
                  {form.tipo_frete}
                  {cotacaoPedido?.valor_frete_unitario != null
                    ? ` · R$ ${cotacaoPedido.valor_frete_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/t`
                    : form.valor_frete
                      ? ` · R$ ${Number(form.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/t`
                      : ''}
                </p>
                <p>
                  <span className="block text-[11px] font-bold uppercase text-emerald-700">
                    Transportadora
                    {cotacaoPedido ? ` (da cotação ${cotacaoPedido.numero_cotacao})` : ''}
                  </span>
                  {cotacaoPedido?.transportadora?.nome ||
                    cotacaoPedido?.transportadora_nome ||
                    'Definida no Carregamento'}
                </p>
                <p className="sm:col-span-2">
                  <span className="block text-[11px] font-bold uppercase text-emerald-700">
                    Endereço de entrega
                  </span>
                  {[
                    pedidoVinculado.endereco_entrega,
                    [pedidoVinculado.cidade_entrega, pedidoVinculado.estado_entrega]
                      .filter(Boolean)
                      .join('/'),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Não informado no pedido'}
                </p>
              </div>
            </div>
          )}

          {/* Pedido de Venda / Precificação search */}
          {!pedidoFixo && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Pedido de Venda / Precificação
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={pedidoSearch}
                  onChange={(e) => {
                    setPedidoSearch(e.target.value);
                  }}
                  placeholder="Buscar por cliente, nº pedido ou nº precificação..."
                  className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              {pedidoResults.length > 0 && (
                <div className="absolute z-10 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-56 overflow-y-auto w-full">
                  {pedidoResults.map((p) => (
                    <button
                      key={p.id ?? `pricing-${p.precificacao_id}`}
                      type="button"
                      onClick={() => selectPedido(p)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors text-sm border-b border-stone-100 last:border-0"
                    >
                      {p._source === 'pricing' ? (
                        <>
                          <p className="font-bold text-stone-800">
                            Precificação #{p.pricing?.formattedCod || p.pricing?.cod || '—'}
                          </p>
                          <p className="text-stone-500 text-xs">
                            {p.clientName || '—'} · Vendedor: {p.pricing?.userName || '—'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-stone-800">
                            {p.barra_pedido || p.numero_pedido || '—'}
                          </p>
                          <p className="text-stone-500 text-xs">
                            {p.clientName || '—'} · COD: {p.pricing?.formattedCod || '—'}
                          </p>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {form.cliente_nome && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-emerald-600 font-medium">
                    ✓ Vinculado: {form.cliente_nome}
                    {form.pedido_venda_numero && (
                      <span className="ml-1 text-stone-500">({form.pedido_venda_numero})</span>
                    )}
                    {selectedPedidoVenda?.saldo_disponivel != null && (
                      <span className="ml-1 text-stone-500">
                        ·{' '}
                        {selectedPedidoVenda.saldo_disponivel.toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 3,
                        })}{' '}
                        ton disponíveis
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        pedido_venda_id: '',
                        pedido_venda_numero: '',
                        precificacao_id: '',
                        cliente_nome: '',
                        _freteAutoDetectado: false,
                        _freteOrigem: undefined,
                        itens: [],
                      }));
                      setSelectedPedidoVenda(null);
                      setPedidoItens([]);
                      setItensCarregamento([]);
                      setCarregandoPedidoItens(false);
                      setPedidoSearch('');
                    }}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                  >
                    ✕ Desvincular
                  </button>
                </div>
              )}
            </div>
          )}

          {form.pedido_venda_id && pedidoItens.length > 0 && (
            <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-stone-50/60">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-stone-800">Produtos a Carregar</h4>
                <span className="text-xs text-stone-500">
                  Total:{' '}
                  {itensCarregamento
                    .filter((it) => it.selecionado)
                    .reduce((sum, it) => sum + Number(it.quantidade || 0), 0)
                    .toLocaleString('pt-BR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3,
                    })}{' '}
                  ton
                </span>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
                <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 py-2 bg-stone-100 text-[11px] font-bold uppercase text-stone-500">
                  <div className="sm:col-span-5">Produto</div>
                  <div className="sm:col-span-2">Embalagem</div>
                  <div className="sm:col-span-2">Saldo</div>
                  <div className="sm:col-span-3">Qtd. a carregar</div>
                </div>
                {itensCarregamento.map((entry, idx) => {
                  const rawSaldo = (entry.item as PedidoVendaItemComSaldo).saldo_disponivel;
                  const rawQtd = entry.item.quantidade_ton;
                  const temSaldoDefinido = rawSaldo != null || rawQtd != null;
                  const saldoDisponivel = Number(rawSaldo ?? rawQtd ?? 0);
                  const quantidadeNum = Number(entry.quantidade || 0);
                  const excedeuSaldo = temSaldoDefinido && quantidadeNum > saldoDisponivel;

                  return (
                    <div
                      key={entry.item.id || `${entry.item.produto_nome}-${idx}`}
                      className="border-t first:border-t-0 border-stone-200 p-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        <label className="flex items-start gap-2 text-sm text-stone-800 sm:col-span-5">
                          <input
                            type="checkbox"
                            checked={entry.selecionado}
                            onChange={(e) =>
                              setItensCarregamento((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, selecionado: e.target.checked } : it
                                )
                              )
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-semibold">{entry.item.produto_nome}</span>
                          </span>
                        </label>
                        <div className="sm:col-span-2">
                          <span className="sm:hidden block text-[11px] font-bold uppercase text-stone-500 mb-1">
                            Embalagem
                          </span>
                          <span className="text-xs text-stone-600">
                            {entry.item.embalagem || '—'}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="sm:hidden block text-[11px] font-bold uppercase text-stone-500 mb-1">
                            Saldo
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              temSaldoDefinido &&
                              Number.isFinite(saldoDisponivel) &&
                              saldoDisponivel > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {temSaldoDefinido && Number.isFinite(saldoDisponivel)
                              ? saldoDisponivel > 0
                                ? `Saldo: ${saldoDisponivel.toLocaleString('pt-BR')} ton`
                                : '❌ Esgotado'
                              : '—'}
                          </span>
                        </div>
                        <div className="sm:col-span-3">
                          <span className="sm:hidden block text-[11px] font-bold uppercase text-stone-500 mb-1">
                            Qtd. a carregar
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            disabled={!entry.selecionado}
                            value={entry.quantidade}
                            onChange={(e) =>
                              setItensCarregamento((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, quantidade: e.target.value } : it
                                )
                              )
                            }
                            className={`w-full px-2 py-1.5 text-sm border rounded-md outline-none focus:ring-2 focus:ring-amber-500 ${
                              excedeuSaldo ? 'border-red-300 bg-red-50' : 'border-stone-300'
                            }`}
                          />
                          {entry.selecionado && excedeuSaldo && (
                            <p className="mt-1 text-[10px] text-red-600">
                              Excede o saldo disponível.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {form.pedido_venda_id && !carregandoPedidoItens && pedidoItens.length === 0 && (
            <p className="text-xs text-stone-500">
              Este pedido não possui itens cadastrados. Informe a quantidade total manualmente.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Filial
              </label>
              <select
                value={form.filial_id}
                disabled={pedidoFixo && Boolean(pedidoVinculado?.filial_id)}
                onChange={(e) => setForm({ ...form, filial_id: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              >
                <option value="">— Selecione —</option>
                {filiaisDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                    {f.codigo ? ` (${f.codigo})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Local de Carregamento
              </label>
              <select
                value={form.local_carregamento_id}
                onChange={(e) => setForm({ ...form, local_carregamento_id: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              >
                <option value="">— Selecione o local (opcional) —</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                    {l.cidade ? ` — ${l.cidade}${l.estado ? `/${l.estado}` : ''}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Data Prevista de Carregamento
              </label>
              <input
                type="date"
                value={form.data_prevista_carregamento}
                onChange={(e) => setForm({ ...form, data_prevista_carregamento: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Tipo de Frete *
                {form._freteAutoDetectado && (
                  <span className="ml-2 text-[10px] font-normal text-emerald-600 normal-case">
                    ✓ detectado automaticamente
                  </span>
                )}
              </label>
              <select
                value={form.tipo_frete}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_frete: e.target.value as 'CIF' | 'FOB',
                    _freteAutoDetectado: false,
                    _freteOrigem: undefined,
                  })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                required
              >
                <option value="FOB">FOB</option>
                <option value="CIF">CIF</option>
              </select>
            </div>
            {form.tipo_frete === 'CIF' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Valor do Frete (R$/t)
                  {form._freteAutoDetectado && form.valor_frete && (
                    <span className="ml-2 text-[10px] font-normal text-emerald-600 normal-case">
                      {form._freteOrigem === 'pedido'
                        ? '✓ do pedido de venda'
                        : '✓ da precificação'}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor_frete}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      valor_frete: e.target.value,
                      _freteAutoDetectado: false,
                      _freteOrigem: undefined,
                    })
                  }
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Quantidade Total (ton) *
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.quantidade_total}
              onChange={(e) => setForm({ ...form, quantidade_total: e.target.value })}
              readOnly={form.pedido_venda_id !== '' && pedidoItens.length > 0}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm ${
                form.pedido_venda_id !== '' && pedidoItens.length > 0
                  ? 'bg-stone-100 text-stone-600 cursor-not-allowed'
                  : ''
              } ${
                selectedPedidoVenda?.saldo_disponivel != null &&
                parseFloat(form.quantidade_total || '0') > selectedPedidoVenda.saldo_disponivel
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-300'
              }`}
              required={!form.pedido_venda_id || pedidoItens.length === 0}
            />
            {form.pedido_venda_id && pedidoItens.length > 0 && (
              <p className="mt-1 text-[11px] text-stone-500">
                Total calculado automaticamente com base nos itens selecionados.
              </p>
            )}
          </div>

          {/* Saldo warning */}
          {selectedPedidoVenda?.saldo_disponivel != null &&
            form.quantidade_total &&
            parseFloat(form.quantidade_total) > selectedPedidoVenda.saldo_disponivel && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                ⚠️ Quantidade excede o saldo disponível do pedido (
                {selectedPedidoVenda.saldo_disponivel.toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 3,
                })}{' '}
                ton).
              </div>
            )}

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || todosItensEsgotados}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving
                ? 'Salvando...'
                : isEditMode
                  ? 'Salvar Alterações'
                  : pedidoFixo
                    ? 'Solicitar e abrir no Carregamento'
                    : 'Criar Carregamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Solicitar Cotação
// ─────────────────────────────────────────────────────────────────────────────
