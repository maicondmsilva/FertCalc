import React, { useState, useEffect, useCallback } from 'react';
import { User, PricingRecord, PedidoVenda } from '../../types';
import {
  Truck,
  Package,
  Calendar,
  BarChart3,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  FileText,
  Eye,
  Search,
  Pencil,
  Trash2,
  History,
} from 'lucide-react';
import {
  Carregamento,
  Filial,
  Transportadora,
  CotacaoFrete,
  KPICarregamento,
  StatusCarregamento,
  FiltrosRelatorioCarregamento,
  LocalCarregamento,
} from '../../types/carregamento';
import {
  getCarregamentos,
  createCarregamento,
  updateCarregamento,
  deleteCarregamento,
  updateStatusCarregamento,
  gerarNumeroCarregamento,
  getFiliais,
  getTransportadoras,
  getAllTransportadoras,
  createTransportadora,
  updateTransportadora,
  getCotacoesCarregamento,
  createCotacao,
  updateCotacao,
  getKPICarregamento,
  getCarregamentosRelatorio,
  getCarregamentosCalendario,
  getAlertasCarregamento,
  getCarregamentosLogistica,
} from '../../services/carregamentoService';
import { registrarAuditLog } from '../../services/auditLogService';
import {
  notifyCarregamentoExcluido,
  notifyCarregamentoEditado,
} from '../../services/notificationService';
import { getPricingRecords } from '../../services/db';
import { getPedidosVenda } from '../../services/pedidosVendaService';
import { getLocaisAtivos } from '../../services/locaisCarregamentoService';
import { useToast } from '../Toast';
import SolicitacaoCotacaoIndependente from './SolicitacaoCotacao';
import HistoricoModificacoes from '../HistoricoModificacoes';
import { formatCarregamentoId } from '../../utils/formatId';

// ─── Permission helper ────────────────────────────────────────────────────────
function canEditDeleteCarregamento(
  status: StatusCarregamento,
  currentUser: User
): { canEdit: boolean; canDelete: boolean } {
  const isAdmin = ['admin', 'master'].includes(currentUser.role);
  const isLogistica = !!(currentUser.permissions as Record<string, unknown>)?.carregamento_aprovar;
  if (isAdmin || isLogistica) return { canEdit: true, canDelete: true };
  // After liberation / in transit / completed — only logística can edit
  const statusBloqueado: StatusCarregamento[] = [
    'liberado_parcial',
    'liberado_total',
    'em_carregamento',
    'carregado',
  ];
  if (statusBloqueado.includes(status)) return { canEdit: false, canDelete: false };
  return { canEdit: true, canDelete: true };
}

// ─── Sub-view type ─────────────────────────────────────────────────────────────
type CarregamentoView =
  | 'visao_geral'
  | 'solicitacao'
  | 'liberacao'
  | 'logistica'
  | 'calendario'
  | 'relatorios'
  | 'transportadoras';

interface CarregamentoModuleProps {
  currentUser: User;
  view?: CarregamentoView;
}

// ─── Status labels & colors ─────────────────────────────────────────────────────
const STATUS_LABEL: Record<StatusCarregamento, string> = {
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

const STATUS_COLOR: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cotacao_solicitada: 'bg-blue-100 text-blue-800 border-blue-200',
  cotacao_recebida: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  aguardando_liberacao: 'bg-orange-100 text-orange-800 border-orange-200',
  liberado_parcial: 'bg-teal-100 text-teal-800 border-teal-200',
  liberado_total: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  em_carregamento: 'bg-purple-100 text-purple-800 border-purple-200',
  carregado: 'bg-green-100 text-green-800 border-green-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

// ─── Helper: format currency ──────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtCarregamentoNum(c: { numero?: number; numero_carregamento: string }): string {
  return c.numero != null ? formatCarregamentoId(c.numero) : c.numero_carregamento || '—';
}

// ─── Badge component ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusCarregamento }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Novo Carregamento
// ─────────────────────────────────────────────────────────────────────────────

interface EnrichedPedido {
  id: string | null;
  precificacao_id: string | null;
  numero_pedido?: string | null;
  barra_pedido?: string | null;
  quantidade_real?: number | null;
  tipo_frete?: string | null;
  saldo_disponivel?: number | null;
  status?: PedidoVenda['status'];
  pricing?: PricingRecord;
  clientName?: string;
  _source: string;
}

export interface CarregamentoFormData {
  tipo_frete: 'CIF' | 'FOB';
  quantidade_total: string;
  filial_id: string;
  local_carregamento_id: string;
  data_prevista_carregamento: string;
  observacoes: string;
  pedido_venda_id: string;
  pedido_venda_numero: string;
  precificacao_id: string;
  cliente_nome: string;
  valor_frete: string;
  _freteAutoDetectado: boolean;
}

interface CotacaoFormData {
  transportadora_id: string;
  valor_cotado: string;
  prazo_dias: string;
  validade_cotacao: string;
  observacoes: string;
}

export interface ModalNovoCarregamentoProps {
  filiais: Filial[];
  onSave: (data: CarregamentoFormData) => Promise<void>;
  onClose: () => void;
  pedidoVinculado?: PedidoVenda;
  carregamentoEditando?: Carregamento;
}

// Bug 2 fix — determina o tipo de frete em ordem de prioridade
function derivarTipoFrete(pedido: EnrichedPedido, pricing?: PricingRecord): 'CIF' | 'FOB' {
  if (pedido?.tipo_frete === 'CIF' || pedido?.tipo_frete === 'FOB') {
    return pedido.tipo_frete as 'CIF' | 'FOB';
  }
  if (pricing?.factors?.tipoFrete === 'CIF' || pricing?.factors?.tipoFrete === 'FOB') {
    return pricing.factors.tipoFrete;
  }
  if (pricing?.factors?.freight != null && Number(pricing.factors.freight) > 0) {
    return 'CIF';
  }
  return 'FOB';
}

export function ModalNovoCarregamento({
  filiais,
  onSave,
  onClose,
  pedidoVinculado,
  carregamentoEditando,
}: ModalNovoCarregamentoProps) {
  const { showError } = useToast();
  const isEditMode = !!carregamentoEditando;
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
      };
    }
    return {
      tipo_frete: (pedidoVinculado?.tipo_frete as 'CIF' | 'FOB') || ('FOB' as 'CIF' | 'FOB'),
      quantidade_total: pedidoVinculado?.saldo_disponivel
        ? String(pedidoVinculado.saldo_disponivel)
        : '',
      filial_id: '',
      local_carregamento_id: '',
      data_prevista_carregamento: '',
      observacoes: '',
      pedido_venda_id: pedidoVinculado?.id || '',
      pedido_venda_numero: pedidoVinculado?.numero_pedido || '',
      precificacao_id: pedidoVinculado?.precificacao_id || '',
      cliente_nome: pedidoVinculado?.cliente_nome || '',
      valor_frete:
        pedidoVinculado?.tipo_frete === 'CIF' && pedidoVinculado?.valor_frete
          ? String(pedidoVinculado.valor_frete)
          : '',
      _freteAutoDetectado: !!pedidoVinculado,
    };
  });
  const [saving, setSaving] = useState(false);
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
    if (form.filial_id) {
      setForm((prev) => ({ ...prev, local_carregamento_id: '' }));
      getLocaisAtivos(form.filial_id)
        .then(setLocais)
        .catch(() => setLocais([]));
    } else {
      setLocais([]);
    }
  }, [form.filial_id]);

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
          const pricing = pricingsMap.get(p.precificacao_id);
          return {
            ...p,
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

  const selectPedido = (p: EnrichedPedido) => {
    const pricing = p.pricing;
    const tipoFrete = derivarTipoFrete(p, pricing);
    const freteVal = Number(pricing?.factors?.freight ?? 0);
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
      valor_frete: freteVal > 0 ? freteVal.toFixed(2) : '',
      cliente_nome: p.clientName || pricing?.factors?.client?.name || '',
      _freteAutoDetectado: true,
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
      setPedidoSearch(
        p.numero_pedido
          ? `${p.numero_pedido}${p.barra_pedido ? '/' + p.barra_pedido : ''}`
          : p.clientName || ''
      );
    }
    setPedidoResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      // Error toast is handled by the parent (handleCreateCarregamento)
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="w-5 h-5 text-amber-600" /> Editar Carregamento
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-amber-600" /> Novo Carregamento
              </>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Pedido de Venda / Precificação search */}
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
              <div className="absolute z-10 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-56 overflow-y-auto w-full max-w-lg">
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
                          {p.numero_pedido ? `Pedido: ${p.numero_pedido}` : '—'}
                          {p.barra_pedido ? ` / ${p.barra_pedido}` : ''}
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
                      · {selectedPedidoVenda.saldo_disponivel.toLocaleString('pt-BR')} ton
                      disponíveis
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
                    }));
                    setSelectedPedidoVenda(null);
                    setPedidoSearch('');
                  }}
                  className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  ✕ Desvincular
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                  })
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                required
              >
                <option value="FOB">FOB</option>
                <option value="CIF">CIF</option>
              </select>
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm ${
                  selectedPedidoVenda?.saldo_disponivel != null &&
                  parseFloat(form.quantidade_total || '0') > selectedPedidoVenda.saldo_disponivel
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-300'
                }`}
                required
              />
            </div>
          </div>

          {/* Saldo warning */}
          {selectedPedidoVenda?.saldo_disponivel != null &&
            form.quantidade_total &&
            parseFloat(form.quantidade_total) > selectedPedidoVenda.saldo_disponivel && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                ⚠️ Quantidade excede o saldo disponível do pedido (
                {selectedPedidoVenda.saldo_disponivel.toLocaleString('pt-BR')} ton).
              </div>
            )}

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Filial</label>
            <select
              value={form.filial_id}
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
              disabled={!form.filial_id}
            >
              <option value="">— Selecione o local (opcional) —</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.cidade ? ` — ${l.cidade}${l.estado ? `/${l.estado}` : ''}` : ''}
                </option>
              ))}
            </select>
            {!form.filial_id && (
              <p className="text-xs text-stone-400 mt-1">
                Selecione uma filial para ver os locais disponíveis
              </p>
            )}
          </div>

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

          {form.tipo_frete === 'CIF' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Valor do Frete (R$/t)
                {form._freteAutoDetectado && form.valor_frete && (
                  <span className="ml-2 text-[10px] font-normal text-emerald-600 normal-case">
                    ✓ preenchido da precificação
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_frete}
                onChange={(e) => setForm({ ...form, valor_frete: e.target.value })}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              />
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
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Salvando...' : isEditMode ? 'Salvar Alterações' : 'Criar Carregamento'}
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
interface ModalCotacaoProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (carregamentoId: string, data: CotacaoFormData) => Promise<void>;
  onClose: () => void;
}

function ModalCotacao({ carregamento, transportadoras, onSave, onClose }: ModalCotacaoProps) {
  const [form, setForm] = useState({
    transportadora_id: '',
    valor_cotado: '',
    prazo_dias: '',
    validade_cotacao: '',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(carregamento.id, form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Solicitar Cotação de Frete
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-sm text-stone-600">
          <span className="font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </span>{' '}
          &mdash; {carregamento.tipo_frete} &mdash; {carregamento.quantidade_total} ton
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Transportadora *
            </label>
            <select
              value={form.transportadora_id}
              onChange={(e) => setForm({ ...form, transportadora_id: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            >
              <option value="">— Selecione —</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Valor Cotado (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_cotado}
                onChange={(e) => setForm({ ...form, valor_cotado: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Prazo (dias)
              </label>
              <input
                type="number"
                min="0"
                value={form.prazo_dias}
                onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Validade da Cotação
            </label>
            <input
              type="date"
              value={form.validade_cotacao}
              onChange={(e) => setForm({ ...form, validade_cotacao: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
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
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Salvando...' : 'Solicitar Cotação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Solicitar Cotação (multi-transportadora)
// ─────────────────────────────────────────────────────────────────────────────
interface ModalSolicitarCotacaoProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (
    carregamentoId: string,
    transportadoraIds: string[],
    prazo_dias?: number,
    observacoes?: string
  ) => Promise<void>;
  onClose: () => void;
}

function ModalSolicitarCotacao({
  carregamento,
  transportadoras,
  onSave,
  onClose,
}: ModalSolicitarCotacaoProps) {
  const { showError } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prazo, setPrazo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleTransportadora = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      showError('Selecione ao menos uma transportadora.');
      return;
    }
    setSaving(true);
    await onSave(
      carregamento.id,
      selectedIds,
      prazo ? parseInt(prazo) : undefined,
      observacoes || undefined
    );
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Solicitar Cotação de Frete
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Carregamento details */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <p className="font-mono font-bold text-emerald-600 text-sm">
            {fmtCarregamentoNum(carregamento)}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                carregamento.tipo_frete === 'CIF'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {carregamento.tipo_frete}
            </span>
            <span className="text-xs text-stone-600">
              {carregamento.quantidade_total.toFixed(3)} ton
            </span>
            {carregamento.filial && (
              <span className="text-xs text-stone-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {carregamento.filial.nome}
              </span>
            )}
            {carregamento.data_prevista_carregamento && (
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(carregamento.data_prevista_carregamento)}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Transportadoras checkboxes */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
              Selecionar Transportadoras *
            </label>
            {transportadoras.length === 0 ? (
              <p className="text-sm text-stone-400">Nenhuma transportadora cadastrada.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {transportadoras.map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedIds.includes(t.id)
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleTransportadora(t.id)}
                      className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800">{t.nome}</p>
                      {t.email && <p className="text-xs text-stone-500">{t.email}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.length > 0 && (
              <p className="text-xs text-blue-600 mt-2 font-medium">
                {selectedIds.length} transportadora
                {selectedIds.length > 1 ? 's' : ''} selecionada
                {selectedIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Prazo Desejado (dias) — opcional
            </label>
            <input
              type="number"
              min="1"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              placeholder="Ex: 7"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Observações — opcional
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Instruções especiais, restrições, etc."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
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
              disabled={saving || selectedIds.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving
                ? 'Solicitando...'
                : `Solicitar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Liberação Parcial
// ─────────────────────────────────────────────────────────────────────────────
interface ModalLiberacaoProps {
  carregamento: Carregamento;
  onSave: (carregamentoId: string, tipo: 'total' | 'parcial', quantidade?: number) => Promise<void>;
  onClose: () => void;
}

function ModalLiberacao({ carregamento, onSave, onClose }: ModalLiberacaoProps) {
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [quantidade, setQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(carregamento.id, tipo, tipo === 'parcial' ? parseFloat(quantidade) : undefined);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" /> Liberar Carregamento
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100">
          <p className="text-sm font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </p>
          <p className="text-xs text-stone-500">
            Total: {carregamento.quantidade_total} ton | Liberado:{' '}
            {carregamento.quantidade_liberada} ton
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
              Tipo de Liberação
            </label>
            <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50">
              <input
                type="radio"
                value="total"
                checked={tipo === 'total'}
                onChange={() => setTipo('total')}
                className="text-emerald-600"
              />
              <div>
                <p className="text-sm font-bold text-stone-800">Liberação Total</p>
                <p className="text-xs text-stone-500">
                  Libera {carregamento.quantidade_total} ton completas
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50">
              <input
                type="radio"
                value="parcial"
                checked={tipo === 'parcial'}
                onChange={() => setTipo('parcial')}
                className="text-emerald-600"
              />
              <div>
                <p className="text-sm font-bold text-stone-800">Liberação Parcial</p>
                <p className="text-xs text-stone-500">Informe a quantidade a liberar</p>
              </div>
            </label>
          </div>

          {tipo === 'parcial' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Quantidade a Liberar (ton) *
              </label>
              <input
                type="number"
                min="0.001"
                max={carregamento.quantidade_total - carregamento.quantidade_liberada}
                step="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                required={tipo === 'parcial'}
              />
              <p className="text-xs text-stone-400 mt-1">
                Máximo disponível:{' '}
                {(carregamento.quantidade_total - carregamento.quantidade_liberada).toFixed(3)} ton
              </p>
            </div>
          )}

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
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Liberando...' : 'Confirmar Liberação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE: Carregamentos
// ─────────────────────────────────────────────────────────────────────────────
interface TabelaCarregamentosProps {
  carregamentos: Carregamento[];
  currentUser?: User;
  onAction?: (c: Carregamento, action: string) => void;
  showActions?: string[];
  onEdit?: (c: Carregamento) => void;
  onDelete?: (c: Carregamento) => void;
  onCancel?: (c: Carregamento) => void;
  onHistory?: (c: Carregamento) => void;
}

function TabelaCarregamentos({
  carregamentos,
  currentUser,
  onAction,
  showActions = [],
  onEdit,
  onDelete,
  onCancel,
  onHistory,
}: TabelaCarregamentosProps) {
  const hasEditDelete = !!(onEdit || onDelete || onCancel || onHistory);
  if (carregamentos.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum carregamento encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
          <tr>
            <th className="px-4 py-3">Número</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Pedido de Venda</th>
            <th className="px-4 py-3">Filial</th>
            <th className="px-4 py-3">Local</th>
            <th className="px-4 py-3">Qtd (ton)</th>
            <th className="px-4 py-3">Dt. Prevista</th>
            <th className="px-4 py-3">Transportadora</th>
            {showActions.length > 0 && <th className="px-4 py-3 text-right">Ações</th>}
            {hasEditDelete && showActions.length === 0 && (
              <th className="px-4 py-3 text-right">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {carregamentos.map((c) => (
            <tr key={c.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-stone-700 text-xs">
                {fmtCarregamentoNum(c)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    c.tipo_frete === 'CIF'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {c.tipo_frete}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3">
                {c.pedido_venda_numero ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {c.pedido_venda_numero}
                  </span>
                ) : (
                  <span className="text-stone-400 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">{c.filial?.nome ?? '—'}</td>
              <td className="px-4 py-3 text-stone-600 text-xs">
                {c.local_carregamento ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0" />
                    {c.local_carregamento.nome}
                    {c.local_carregamento.cidade && (
                      <span className="text-stone-400">— {c.local_carregamento.cidade}</span>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-stone-700 font-mono">
                <div className="text-xs">
                  <span className="font-bold">{c.quantidade_total.toFixed(3)}</span>
                  {c.quantidade_liberada > 0 && (
                    <span className="text-emerald-600 ml-1">
                      / {c.quantidade_liberada.toFixed(3)} lib.
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">
                {fmtDate(c.data_prevista_carregamento)}
              </td>
              <td className="px-4 py-3 text-stone-600 text-xs">{c.transportadora?.nome ?? '—'}</td>
              {(showActions.length > 0 || hasEditDelete) && (
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {showActions.includes('cotacao') &&
                      ['aguardando_cotacao'].includes(c.status) && (
                        <button
                          onClick={() => onAction?.(c, 'cotacao')}
                          className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          Solicitar Cotação
                        </button>
                      )}
                    {showActions.includes('liberar') &&
                      ['cotacao_recebida', 'aguardando_liberacao'].includes(c.status) && (
                        <button
                          onClick={() => onAction?.(c, 'liberar')}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          Liberar
                        </button>
                      )}
                    {showActions.includes('transportador') &&
                      c.tipo_frete === 'CIF' &&
                      ['liberado_total', 'liberado_parcial', 'aguardando_liberacao'].includes(
                        c.status
                      ) && (
                        <button
                          onClick={() => onAction?.(c, 'transportador')}
                          className="px-2.5 py-1 text-xs font-bold bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          Inf. Transportador
                        </button>
                      )}
                    {showActions.includes('confirmar') &&
                      ['liberado_total', 'liberado_parcial', 'em_carregamento'].includes(
                        c.status
                      ) && (
                        <button
                          onClick={() => onAction?.(c, 'confirmar')}
                          className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          Confirmar Carg.
                        </button>
                      )}
                    {/* Edit / Delete / History buttons */}
                    {hasEditDelete &&
                      currentUser &&
                      (() => {
                        const perms = canEditDeleteCarregamento(c.status, currentUser);
                        return (
                          <>
                            {onEdit && (
                              <button
                                onClick={() => (perms.canEdit ? onEdit(c) : undefined)}
                                disabled={!perms.canEdit}
                                title={
                                  perms.canEdit
                                    ? 'Editar carregamento'
                                    : 'Somente a equipe logística pode editar após aprovação'
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  perms.canEdit
                                    ? 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-stone-300 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={() => (perms.canDelete ? onDelete(c) : undefined)}
                                disabled={!perms.canDelete}
                                title={
                                  perms.canDelete
                                    ? 'Excluir carregamento'
                                    : 'Somente a equipe logística pode excluir após aprovação'
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  perms.canDelete
                                    ? 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                                    : 'text-stone-300 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onCancel &&
                              c.status !== 'cancelado' &&
                              c.status !== 'carregado' &&
                              perms.canDelete && (
                                <button
                                  onClick={() => onCancel(c)}
                                  title="Cancelar carregamento"
                                  className="p-1.5 rounded-lg transition-colors text-stone-400 hover:text-orange-600 hover:bg-orange-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            {onHistory && (
                              <button
                                onClick={() => onHistory(c)}
                                title="Histórico de modificações"
                                className="p-1.5 rounded-lg transition-colors text-stone-400 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        );
                      })()}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Visão Geral
// ─────────────────────────────────────────────────────────────────────────────
function VisaoGeral({
  carregamentos,
  kpi,
  loading,
  onAction,
  currentUser,
  onEdit,
  onDelete,
  onCancel,
  onHistory,
}: {
  carregamentos: Carregamento[];
  kpi: KPICarregamento;
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
  currentUser?: User;
  onEdit?: (c: Carregamento) => void;
  onDelete?: (c: Carregamento) => void;
  onCancel?: (c: Carregamento) => void;
  onHistory?: (c: Carregamento) => void;
}) {
  const pendentes = carregamentos.filter((c) =>
    [
      'aguardando_cotacao',
      'cotacao_solicitada',
      'cotacao_recebida',
      'aguardando_liberacao',
    ].includes(c.status)
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Aguardando Cotação',
            value: kpi.aguardando_cotacao,
            icon: Clock,
            color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            iconColor: 'text-yellow-500',
          },
          {
            label: 'Em Carregamento',
            value: kpi.em_carregamento,
            icon: Truck,
            color: 'bg-purple-50 border-purple-200 text-purple-700',
            iconColor: 'text-purple-500',
          },
          {
            label: 'Carregados Hoje',
            value: kpi.carregados_hoje,
            icon: CheckCircle,
            color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            iconColor: 'text-emerald-500',
          },
          {
            label: 'Valor Frete (Mês)',
            value: fmtBRL(kpi.valor_frete_mes),
            icon: BarChart3,
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            iconColor: 'text-blue-500',
          },
        ].map((kpiItem) => {
          const Icon = kpiItem.icon;
          return (
            <div
              key={kpiItem.label}
              className={`p-5 rounded-xl border ${kpiItem.color} flex items-center gap-4`}
            >
              <Icon className={`w-8 h-8 flex-shrink-0 ${kpiItem.iconColor}`} />
              <div>
                <p className="text-2xl font-black">{kpiItem.value}</p>
                <p className="text-xs font-semibold opacity-70 mt-0.5">{kpiItem.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending list */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Pendências ({pendentes.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : (
          <TabelaCarregamentos
            carregamentos={pendentes}
            currentUser={currentUser}
            onAction={onAction}
            showActions={['cotacao', 'liberar']}
            onEdit={onEdit}
            onDelete={onDelete}
            onCancel={onCancel}
            onHistory={onHistory}
          />
        )}
      </div>

      {/* All carregamentos */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-stone-400" />
            Todos os Carregamentos ({carregamentos.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : (
          <TabelaCarregamentos
            carregamentos={carregamentos}
            currentUser={currentUser}
            onEdit={onEdit}
            onDelete={onDelete}
            onCancel={onCancel}
            onHistory={onHistory}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Solicitação de Cotação
// ─────────────────────────────────────────────────────────────────────────────
function SolicitacaoCotacao({
  carregamentos,
  transportadoras,
  loading,
  onSolicitarCotacao,
}: {
  carregamentos: Carregamento[];
  transportadoras: Transportadora[];
  loading: boolean;
  onSolicitarCotacao: (
    carregamentoId: string,
    transportadoraIds: string[],
    prazo_dias?: number,
    observacoes?: string
  ) => Promise<void>;
}) {
  const elegiveis = carregamentos.filter((c) => c.status === 'aguardando_cotacao');
  const emAndamento = carregamentos.filter((c) =>
    ['cotacao_solicitada', 'cotacao_recebida'].includes(c.status)
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalCarregamento, setModalCarregamento] = useState<Carregamento | null>(null);
  const [cotacoesPorCarregamento, setCotacoesPorCarregamento] = useState<
    Record<string, CotacaoFrete[]>
  >({});
  const [loadingCotacoes, setLoadingCotacoes] = useState<Record<string, boolean>>({});

  const toggleExpand = async (c: Carregamento) => {
    if (expandedId === c.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(c.id);
    if (!cotacoesPorCarregamento[c.id]) {
      setLoadingCotacoes((prev) => ({ ...prev, [c.id]: true }));
      const cotacoes = await getCotacoesCarregamento(c.id);
      setCotacoesPorCarregamento((prev) => ({ ...prev, [c.id]: cotacoes }));
      setLoadingCotacoes((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  const STATUS_COTACAO_COLOR: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-700',
    aprovada: 'bg-green-100 text-green-700',
    reprovada: 'bg-red-100 text-red-700',
    expirada: 'bg-stone-100 text-stone-500',
  };

  return (
    <div className="space-y-6">
      {/* ── Aguardando Cotação ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-yellow-500" />
          <h3 className="font-bold text-stone-800 text-sm">
            Aguardando Cotação ({elegiveis.length})
          </h3>
          <span className="text-xs text-stone-400 font-normal">
            — selecione as transportadoras para solicitar cotação
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : elegiveis.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8 text-center text-stone-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum carregamento aguardando cotação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {elegiveis.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(c)}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                  >
                    {expandedId === c.id ? (
                      <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-stone-800 text-sm">
                        {fmtCarregamentoNum(c)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.tipo_frete === 'CIF'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {c.tipo_frete}
                        </span>
                        <span className="text-xs text-stone-500">
                          {c.quantidade_total.toFixed(3)} ton
                        </span>
                        {c.filial && (
                          <span className="text-xs text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {c.filial.nome}
                          </span>
                        )}
                        {c.data_prevista_carregamento && (
                          <span className="text-xs text-stone-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(c.data_prevista_carregamento)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setModalCarregamento(c)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Solicitar Cotação
                  </button>
                </div>

                {expandedId === c.id && (
                  <div className="border-t border-stone-100 bg-stone-50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-stone-400 font-bold uppercase text-[10px]">Qtd Total</p>
                        <p className="text-stone-700 font-mono mt-0.5">
                          {c.quantidade_total.toFixed(3)} ton
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-400 font-bold uppercase text-[10px]">Tipo Frete</p>
                        <p className="text-stone-700 mt-0.5">{c.tipo_frete}</p>
                      </div>
                      <div>
                        <p className="text-stone-400 font-bold uppercase text-[10px]">
                          Data Prevista
                        </p>
                        <p className="text-stone-700 mt-0.5">
                          {fmtDate(c.data_prevista_carregamento)}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-400 font-bold uppercase text-[10px]">Filial</p>
                        <p className="text-stone-700 mt-0.5">{c.filial?.nome ?? '—'}</p>
                      </div>
                    </div>
                    {c.observacoes && (
                      <p className="text-xs text-stone-600 mt-3">
                        <span className="font-bold">Obs: </span>
                        {c.observacoes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cotações em Andamento ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-stone-800 text-sm">
            Cotações em Andamento ({emAndamento.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : emAndamento.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8 text-center text-stone-400">
            <p className="text-sm">Nenhuma cotação em andamento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emAndamento.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(c)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  {expandedId === c.id ? (
                    <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-mono font-bold text-stone-800 text-sm">
                        {fmtCarregamentoNum(c)}
                      </p>
                      <StatusBadge status={c.status} />
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          c.tipo_frete === 'CIF'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.tipo_frete}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-stone-500">
                        {c.quantidade_total.toFixed(3)} ton
                      </span>
                      {c.filial && <span className="text-xs text-stone-500">{c.filial.nome}</span>}
                      {c.data_solicitacao_cotacao && (
                        <span className="text-xs text-stone-400">
                          Solicitado em: {fmtDate(c.data_solicitacao_cotacao)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === c.id && (
                  <div className="border-t border-stone-100 bg-stone-50 p-4">
                    {loadingCotacoes[c.id] ? (
                      <div className="flex justify-center py-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-stone-300" />
                      </div>
                    ) : (cotacoesPorCarregamento[c.id] ?? []).length === 0 ? (
                      <p className="text-xs text-stone-400">Nenhuma cotação registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-stone-500 uppercase mb-2">
                          Transportadoras Contactadas
                        </p>
                        {(cotacoesPorCarregamento[c.id] ?? []).map((cot) => (
                          <div
                            key={cot.id}
                            className="flex items-center justify-between p-2 bg-white border border-stone-100 rounded-lg"
                          >
                            <div>
                              <p className="text-xs font-bold text-stone-700">
                                {cot.transportadora?.nome ?? '—'}
                              </p>
                              {cot.prazo_dias != null && (
                                <p className="text-[10px] text-stone-400">
                                  Prazo: {cot.prazo_dias} dias
                                </p>
                              )}
                              {cot.observacoes && (
                                <p className="text-[10px] text-stone-400">{cot.observacoes}</p>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                STATUS_COTACAO_COLOR[cot.status] ?? 'bg-stone-100 text-stone-500'
                              }`}
                            >
                              {cot.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalCarregamento && (
        <ModalSolicitarCotacao
          carregamento={modalCarregamento}
          transportadoras={transportadoras}
          onSave={async (carregamentoId, transportadoraIds, prazo_dias, observacoes) => {
            await onSolicitarCotacao(carregamentoId, transportadoraIds, prazo_dias, observacoes);
            setModalCarregamento(null);
          }}
          onClose={() => setModalCarregamento(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Liberação de Carregamento
// ─────────────────────────────────────────────────────────────────────────────
function LiberacaoCarregamento({
  carregamentos,
  loading,
  onAction,
}: {
  carregamentos: Carregamento[];
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
}) {
  const prontos = carregamentos.filter((c) =>
    ['cotacao_recebida', 'aguardando_liberacao'].includes(c.status)
  );
  const liberados = carregamentos.filter((c) =>
    ['liberado_parcial', 'liberado_total'].includes(c.status)
  );

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
            showActions={['liberar']}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm">Liberados ({liberados.length})</h3>
        </div>
        <TabelaCarregamentos carregamentos={liberados} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Painel de Logística
// ─────────────────────────────────────────────────────────────────────────────
function PainelLogistica({
  carregamentos,
  loading,
  onAction,
}: {
  carregamentos: Carregamento[];
  loading: boolean;
  onAction: (c: Carregamento, action: string) => void;
}) {
  const cif = carregamentos.filter(
    (c) => c.tipo_frete === 'CIF' && c.status !== 'cancelado' && c.status !== 'carregado'
  );
  const fob = carregamentos.filter(
    (c) => c.tipo_frete === 'FOB' && c.status !== 'cancelado' && c.status !== 'carregado'
  );

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const isUrgent = (c: Carregamento) =>
    c.data_prevista_carregamento === today || c.data_prevista_carregamento === tomorrow;

  const isVencimentoUrgente = (c: Carregamento) => {
    if (!c.pedido_data_vencimento) return false;
    const venc = new Date(c.pedido_data_vencimento + 'T00:00:00');
    const diff = (venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  };

  const isVencimentoAtrasado = (c: Carregamento) => {
    if (!c.pedido_data_vencimento) return false;
    return new Date(c.pedido_data_vencimento + 'T00:00:00') < new Date();
  };

  return (
    <div className="space-y-6">
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
                        <span className="font-medium">{c.quantidade_total} ton</span>
                        {' '}— Previsto: {fmtDate(c.data_prevista_carregamento)}
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
                  <button
                    onClick={() => onAction(c, 'confirmar')}
                    className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Confirmar
                  </button>
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
                        <span className="font-medium">{c.quantidade_total} ton</span>
                        {' '}— Previsto:{' '}
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
                  <button
                    onClick={() => onAction(c, 'confirmar')}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Confirmar Carg.
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Calendário
// ─────────────────────────────────────────────────────────────────────────────
function CalendarioCarregamentos({ currentUser }: { currentUser: User }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [eventos, setEventos] = useState<Carregamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Carregamento | null>(null);

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCarregamentosCalendario(mes, ano);
    setEventos(data);
    setLoading(false);
  }, [mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  const navigate = (dir: number) => {
    setMes((m) => {
      let nm = m + dir;
      if (nm > 12) {
        setAno((y) => y + 1);
        return 1;
      }
      if (nm < 1) {
        setAno((y) => y - 1);
        return 12;
      }
      return nm;
    });
  };

  // Build calendar grid
  const firstDay = new Date(ano, mes - 1, 1).getDay();
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsForDay = (day: number) => {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventos.filter((e) => e.data_prevista_carregamento === dateStr);
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && mes === today.getMonth() + 1 && ano === today.getFullYear();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
        >
          ‹
        </button>
        <h3 className="text-lg font-bold text-stone-800">
          {monthNames[mes - 1]} {ano}
        </h3>
        <button
          onClick={() => navigate(1)}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
        >
          ›
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        {[
          { label: 'Aguardando', color: 'bg-yellow-400' },
          { label: 'Liberado', color: 'bg-emerald-400' },
          { label: 'Em Carregamento', color: 'bg-purple-400' },
          { label: 'Carregado', color: 'bg-green-500' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-stone-600">
            <span className={`w-3 h-3 rounded-full ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-stone-200">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-stone-400 py-2 uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[80px] border-b border-r border-stone-100 bg-stone-50/50"
                  />
                );
              }
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day}
                  className={`min-h-[80px] p-1.5 border-b border-r border-stone-100 ${isToday(day) ? 'bg-emerald-50' : 'hover:bg-stone-50'} cursor-default`}
                >
                  <p
                    className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-emerald-600 text-white' : 'text-stone-600'
                    }`}
                  >
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const dotColor =
                        e.status === 'carregado'
                          ? 'bg-green-500'
                          : ['liberado_total', 'liberado_parcial'].includes(e.status)
                            ? 'bg-emerald-400'
                            : e.status === 'em_carregamento'
                              ? 'bg-purple-400'
                              : 'bg-yellow-400';
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelected(e)}
                          className={`w-full text-left text-[9px] font-bold ${dotColor} text-white rounded px-1 py-0.5 truncate`}
                          title={`${fmtCarregamentoNum(e)} — ${STATUS_LABEL[e.status]}`}
                        >
                          {fmtCarregamentoNum(e)}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-stone-400">+{dayEvents.length - 3} mais</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-mono font-bold text-emerald-600">{fmtCarregamentoNum(selected)}</h4>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-stone-100 rounded">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Status</p>
              <StatusBadge status={selected.status} />
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Tipo</p>
              <span className="font-bold">{selected.tipo_frete}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Quantidade</p>
              <span>{selected.quantidade_total} ton</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Filial</p>
              <span>{selected.filial?.nome ?? '—'}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">
                Local de Carregamento
              </p>
              {selected.local_carregamento ? (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-stone-400" />
                  {selected.local_carregamento.nome}
                  {selected.local_carregamento.cidade && (
                    <span className="text-stone-500">
                      — {selected.local_carregamento.cidade}
                      {selected.local_carregamento.estado
                        ? `/${selected.local_carregamento.estado}`
                        : ''}
                    </span>
                  )}
                  {selected.local_carregamento.maps_url && (
                    <a
                      href={selected.local_carregamento.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-xs text-blue-600 hover:underline"
                      title="Abrir no Google Maps"
                    >
                      🗺️
                    </a>
                  )}
                </span>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Data Prevista</p>
              <span>{fmtDate(selected.data_prevista_carregamento)}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Transportadora</p>
              <span>{selected.transportadora?.nome ?? '—'}</span>
            </div>
            {selected.observacoes && (
              <div className="col-span-2">
                <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Observações</p>
                <p className="text-stone-600">{selected.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Relatórios
// ─────────────────────────────────────────────────────────────────────────────
function RelatoriosCarregamento({
  filiais,
  transportadoras,
}: {
  filiais: Filial[];
  transportadoras: Transportadora[];
}) {
  const [filtros, setFiltros] = useState<FiltrosRelatorioCarregamento>({});
  const [dados, setDados] = useState<Carregamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const buscar = async () => {
    setLoading(true);
    const result = await getCarregamentosRelatorio(filtros);
    setDados(result);
    setSearched(true);
    setLoading(false);
  };

  const totalTon = dados.reduce((a, c) => a + c.quantidade_carregada, 0);
  const totalFrete = dados.reduce((a, c) => a + (c.valor_frete ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <h3 className="font-bold text-stone-800 text-sm mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-stone-400" />
          Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Filial</label>
            <select
              value={filtros.filial_id ?? ''}
              onChange={(e) => setFiltros({ ...filtros, filial_id: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Tipo de Frete
            </label>
            <select
              value={filtros.tipo_frete ?? ''}
              onChange={(e) => setFiltros({ ...filtros, tipo_frete: e.target.value as any })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todos</option>
              <option value="CIF">CIF</option>
              <option value="FOB">FOB</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Status</label>
            <select
              value={filtros.status ?? ''}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todos</option>
              {(Object.keys(STATUS_LABEL) as StatusCarregamento[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Transportadora
            </label>
            <select
              value={filtros.transportadora_id ?? ''}
              onChange={(e) =>
                setFiltros({ ...filtros, transportadora_id: e.target.value || undefined })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todas</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filtros.data_inicio ?? ''}
              onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={filtros.data_fim ?? ''}
              onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={buscar}
            disabled={loading}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Buscar
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {searched && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">Total de Registros</p>
              <p className="text-3xl font-black text-stone-800">{dados.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Volume Carregado (ton)
              </p>
              <p className="text-3xl font-black text-stone-800">{totalTon.toFixed(3)}</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Custo Total de Frete
              </p>
              <p className="text-3xl font-black text-stone-800">{fmtBRL(totalFrete)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 text-sm">Resultados ({dados.length})</h3>
            </div>
            <TabelaCarregamentos carregamentos={dados} />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Informar Transportador (Logística)
// ─────────────────────────────────────────────────────────────────────────────
interface ModalInformarTransportadorProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (transportadoraId: string, valorFrete?: number) => Promise<void>;
  onClose: () => void;
}

function ModalInformarTransportador({
  carregamento,
  transportadoras,
  onSave,
  onClose,
}: ModalInformarTransportadorProps) {
  const [transportadoraId, setTransportadoraId] = useState(carregamento.transportadora_id ?? '');
  const [valorFrete, setValorFrete] = useState(
    carregamento.valor_frete != null ? String(carregamento.valor_frete) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(transportadoraId, valorFrete ? parseFloat(valorFrete) : undefined);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Informar Transportador
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-sm text-stone-600">
          <span className="font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </span>{' '}
          &mdash; {carregamento.tipo_frete} &mdash; {carregamento.quantidade_total} ton
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Transportadora *
            </label>
            <select
              value={transportadoraId}
              onChange={(e) => setTransportadoraId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            >
              <option value="">— Selecione —</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                  {t.telefone ? ` — ${t.telefone}` : ''}
                </option>
              ))}
            </select>
            {transportadoras.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhuma transportadora cadastrada. Acesse Logística → Transportadoras para
                cadastrar.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Valor do Frete (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
              disabled={saving || !transportadoraId}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT: Transportadora Manager
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT: Modal Cancelar Carregamento
// ─────────────────────────────────────────────────────────────────────────────

interface DadosCancelamento {
  tipo: 'total' | 'parcial';
  quantidadeCancelada: number;
  motivo: string;
}

function ModalCancelarCarregamento({
  carregamento,
  onConfirm,
  onClose,
}: {
  carregamento: Carregamento;
  onConfirm: (dados: DadosCancelamento) => Promise<void>;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [quantidadeCancelada, setQuantidadeCancelada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const qtdTotal = carregamento.quantidade_total ?? 0;
  const qtdCancelada = parseFloat(quantidadeCancelada) || 0;

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    if (tipo === 'parcial' && (qtdCancelada <= 0 || qtdCancelada >= qtdTotal)) return;
    setSaving(true);
    await onConfirm({ tipo, quantidadeCancelada: qtdCancelada, motivo: motivo.trim() });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <X className="w-5 h-5" />
          <h3 className="font-bold text-base">
            Cancelar Carregamento{' '}
            {carregamento.numero
              ? `CAR-${String(carregamento.numero).padStart(4, '0')}`
              : carregamento.numero_carregamento}
          </h3>
        </div>

        {/* Tipo de cancelamento */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
            Tipo de Cancelamento
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTipo('total')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${
                tipo === 'total'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              Total ({qtdTotal.toFixed(3)} ton)
            </button>
            <button
              type="button"
              onClick={() => setTipo('parcial')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${
                tipo === 'parcial'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              Parcial
            </button>
          </div>
        </div>

        {/* Campo de quantidade (só para parcial) */}
        {tipo === 'parcial' && (
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Quantidade a Cancelar (ton) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max={qtdTotal - 0.001}
              value={quantidadeCancelada}
              onChange={(e) => setQuantidadeCancelada(e.target.value)}
              placeholder={`Máx: ${(qtdTotal - 0.001).toFixed(3)} ton`}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400"
            />
            {qtdCancelada > 0 && qtdCancelada < qtdTotal && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                <p className="text-amber-700 font-bold">Impacto no Pedido de Venda:</p>
                <p className="text-amber-600 mt-0.5">
                  + {qtdCancelada.toFixed(3)} ton devolvidas ao saldo disponível
                </p>
                <p className="text-amber-600">
                  Saldo restante neste carregamento: {(qtdTotal - qtdCancelada).toFixed(3)} ton
                </p>
              </div>
            )}
          </div>
        )}

        {tipo === 'total' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">
            <strong>{qtdTotal.toFixed(3)} ton</strong> serão devolvidas ao saldo do pedido
            automaticamente.
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo do cancelamento..."
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        <p className="text-xs text-stone-400">
          ⚠️ O solicitante será notificado. Esta operação ficará registrada no histórico.
        </p>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg font-bold hover:bg-stone-200"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              saving ||
              !motivo.trim() ||
              (tipo === 'parcial' && (qtdCancelada <= 0 || qtdCancelada >= qtdTotal))
            }
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransportadoraManager() {
  const { showSuccess, showError } = useToast();
  const [lista, setLista] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Transportadora | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<Omit<Transportadora, 'id' | 'criado_em'>>({
    nome: '',
    cnpj: '',
    contato: '',
    telefone: '',
    email: '',
    ativo: true,
  });

  const carregarTodas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTransportadoras();
      setLista(data);
    } catch (err) {
      console.error(err);
      showError('Erro ao carregar transportadoras.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    carregarTodas();
  }, [carregarTodas]);

  const abrirCriacao = () => {
    setForm({ nome: '', cnpj: '', contato: '', telefone: '', email: '', ativo: true });
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (t: Transportadora) => {
    setForm({
      nome: t.nome,
      cnpj: t.cnpj ?? '',
      contato: t.contato ?? '',
      telefone: t.telefone ?? '',
      email: t.email ?? '',
      ativo: t.ativo,
    });
    setEditando(t);
    setCriando(true);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editando) {
        await updateTransportadora(editando.id, form);
        showSuccess('Transportadora atualizada com sucesso!');
      } else {
        await createTransportadora(form);
        showSuccess('Transportadora cadastrada com sucesso!');
      }
      fechar();
      await carregarTodas();
    } catch (err) {
      console.error(err);
      showError('Erro ao salvar transportadora.');
    }
  };

  const alternarAtivo = async (t: Transportadora) => {
    try {
      await updateTransportadora(t.id, { ativo: !t.ativo });
      showSuccess(t.ativo ? 'Transportadora desativada.' : 'Transportadora ativada.');
      await carregarTodas();
    } catch (err) {
      console.error(err);
      showError('Erro ao alterar status da transportadora.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-stone-400" />
            Transportadoras
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Gerencie as transportadoras disponíveis para cotação de frete
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Transportadora
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">
          Nenhuma transportadora cadastrada
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lista.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-stone-50 transition-colors ${!t.ativo ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 font-bold text-stone-800">{t.nome}</td>
                  <td className="px-4 py-3 text-stone-600 font-mono text-xs">{t.cnpj || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.contato || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.telefone || '—'}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs">{t.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirEdicao(t)}
                        className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => alternarAtivo(t)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                          t.ativo
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {t.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulário de criação/edição */}
      {criando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                {editando ? 'Editar Transportadora' : 'Nova Transportadora'}
              </h3>
              <button
                onClick={fechar}
                className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <form onSubmit={salvar} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cnpj ?? ''}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Contato
                  </label>
                  <input
                    type="text"
                    value={form.contato ?? ''}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={form.telefone ?? ''}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
              {editando && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span className="text-sm text-stone-700">Ativo</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  {editando ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN MODULE
// ─────────────────────────────────────────────────────────────────────────────
export default function CarregamentoModule({
  currentUser,
  view = 'visao_geral',
}: CarregamentoModuleProps) {
  const { showSuccess, showError } = useToast();
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [carregamentosLogistica, setCarregamentosLogistica] = useState<Carregamento[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [kpi, setKpi] = useState<KPICarregamento>({
    aguardando_cotacao: 0,
    em_carregamento: 0,
    carregados_hoje: 0,
    valor_frete_mes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [showModalNovo, setShowModalNovo] = useState(false);
  const [modalCotacao, setModalCotacao] = useState<Carregamento | null>(null);
  const [modalLiberacao, setModalLiberacao] = useState<Carregamento | null>(null);
  const [modalTransportador, setModalTransportador] = useState<Carregamento | null>(null);
  // Edit / Delete / History
  const [editandoCarregamento, setEditandoCarregamento] = useState<Carregamento | null>(null);
  const [excluindoCarregamento, setExcluindoCarregamento] = useState<Carregamento | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [excluindoLoading, setExcluindoLoading] = useState(false);
  const [historicoCarregamento, setHistoricoCarregamento] = useState<Carregamento | null>(null);
  const [carregamentoParaCancelar, setCarregamentoParaCancelar] = useState<Carregamento | null>(
    null
  );

  const canCreate =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.carregamento_solicitar_cotacao;

  const podeVerTodas =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.permissions?.carregamento_all_filiais;

  const filiaisVisiveis = podeVerTodas
    ? filiais
    : filiais.filter((f) => currentUser.filiais_permitidas?.includes(f.id));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const canSeeAll =
        currentUser.role === 'master' ||
        currentUser.role === 'admin' ||
        currentUser.permissions?.carregamento_all_filiais;
      const filtroPorFiliais = canSeeAll ? undefined : currentUser.filiais_permitidas;
      const [cgs, cgsLogistica, fls, trs, kpiData] = await Promise.all([
        getCarregamentos(undefined, filtroPorFiliais),
        getCarregamentosLogistica(filtroPorFiliais ?? undefined),
        getFiliais(),
        getTransportadoras(),
        getKPICarregamento(),
      ]);
      setCarregamentos(cgs);
      setCarregamentosLogistica(cgsLogistica);
      setFiliais(fls);
      setTransportadoras(trs);
      setKpi(kpiData);
    } catch (err) {
      console.error('Erro ao carregar dados de carregamento:', err);
      setLoadError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Action handler ────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (c: Carregamento, action: string) => {
      if (action === 'cotacao') {
        setModalCotacao(c);
      } else if (action === 'liberar') {
        setModalLiberacao(c);
      } else if (action === 'transportador') {
        setModalTransportador(c);
      } else if (action === 'confirmar') {
        await updateStatusCarregamento(c.id, 'carregado', {
          data_real_carregamento: new Date().toISOString().slice(0, 10),
        });
        await load();
      }
    },
    [load]
  );

  // ── Create carregamento ───────────────────────────────────────────────────
  const handleCreateCarregamento = async (form: CarregamentoFormData) => {
    try {
      const numero = await gerarNumeroCarregamento();
      await createCarregamento({
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
        status: 'aguardando_cotacao',
        criado_por: currentUser.id,
      });
      showSuccess('Carregamento criado com sucesso!');
      setShowModalNovo(false);
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao criar carregamento. Verifique os dados e tente novamente.';
      showError(msg);
      // Rethrow so the modal's handleSubmit can keep saving=false without closing
      throw err;
    }
  };

  // ── Solicitar cotação (único — usado pelo ModalCotacao na visão geral) ───────
  const handleSolicitarCotacao = async (carregamentoId: string, form: CotacaoFormData) => {
    try {
      await createCotacao({
        carregamento_id: carregamentoId,
        transportadora_id: form.transportadora_id || undefined,
        valor_cotado: form.valor_cotado ? parseFloat(form.valor_cotado) : undefined,
        prazo_dias: form.prazo_dias ? parseInt(form.prazo_dias) : undefined,
        validade_cotacao: form.validade_cotacao || undefined,
        observacoes: form.observacoes || undefined,
        status: 'pendente',
        solicitado_por: currentUser.id,
      });
      await updateStatusCarregamento(carregamentoId, 'cotacao_solicitada', {
        data_solicitacao_cotacao: new Date().toISOString(),
      });
      showSuccess('Cotação solicitada com sucesso!');
      setModalCotacao(null);
      await load();
    } catch {
      showError('Erro ao solicitar cotação.');
    }
  };

  // ── Edit carregamento ─────────────────────────────────────────────────────
  const handleEditarCarregamento = async (form: CarregamentoFormData) => {
    if (!editandoCarregamento) return;
    const anterior = editandoCarregamento;
    const updates: Partial<Carregamento> = {
      tipo_frete: form.tipo_frete,
      quantidade_total: parseFloat(form.quantidade_total),
      filial_id: form.filial_id || undefined,
      local_carregamento_id: form.local_carregamento_id || undefined,
      pedido_venda_id: form.pedido_venda_id || undefined,
      pedido_venda_numero: form.pedido_venda_numero || undefined,
      data_prevista_carregamento: form.data_prevista_carregamento || undefined,
      observacoes: form.observacoes || undefined,
      valor_frete: form.valor_frete ? parseFloat(form.valor_frete) : undefined,
    };
    try {
      await updateCarregamento(editandoCarregamento.id, updates);
      // Register audit log
      await registrarAuditLog({
        tabela: 'carregamentos',
        registro_id: editandoCarregamento.id,
        acao: 'UPDATE',
        dados_anteriores: anterior as unknown as Record<string, unknown>,
        dados_novos: { ...anterior, ...updates } as unknown as Record<string, unknown>,
        motivo: 'Edição pelo usuário',
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      // Notify solicitante if different from current user
      if (anterior.criado_por && anterior.criado_por !== currentUser.id) {
        await notifyCarregamentoEditado(
          anterior.numero_carregamento,
          currentUser.name ?? 'Logística',
          anterior.criado_por
        );
      }
      showSuccess('Carregamento editado com sucesso!');
      setEditandoCarregamento(null);
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao editar carregamento.';
      showError(msg);
      throw err;
    }
  };

  // ── Delete carregamento ───────────────────────────────────────────────────
  const handleConfirmarExclusao = async () => {
    if (!excluindoCarregamento) return;
    if (!motivoExclusao.trim()) {
      showError('Informe o motivo da exclusão.');
      return;
    }
    setExcluindoLoading(true);
    try {
      const snapshot = excluindoCarregamento;
      // Register audit log BEFORE deleting
      await registrarAuditLog({
        tabela: 'carregamentos',
        registro_id: snapshot.id,
        acao: 'DELETE',
        dados_anteriores: snapshot as unknown as Record<string, unknown>,
        dados_novos: null,
        motivo: motivoExclusao.trim(),
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      await deleteCarregamento(snapshot.id);
      // Notify solicitante and current user if different
      const destinatarios = new Set<string>();
      if (snapshot.criado_por) destinatarios.add(snapshot.criado_por);
      await notifyCarregamentoExcluido(
        snapshot.numero_carregamento,
        currentUser.name ?? 'Usuário',
        Array.from(destinatarios).filter((id) => id !== currentUser.id)
      );
      showSuccess('Carregamento excluído com sucesso.');
      setExcluindoCarregamento(null);
      setMotivoExclusao('');
      await load();
    } catch {
      showError('Erro ao excluir carregamento.');
    } finally {
      setExcluindoLoading(false);
    }
  };

  // ── Cancelar carregamento (total ou parcial) ─────────────────────────────
  const handleCancelarCarregamento = async (
    carregamento: Carregamento,
    dados: DadosCancelamento
  ) => {
    const anterior = { ...carregamento };
    const qtdOriginal = carregamento.quantidade_total ?? 0;

    try {
      if (dados.tipo === 'total' || dados.quantidadeCancelada >= qtdOriginal) {
        await updateCarregamento(carregamento.id, {
          status: 'cancelado',
          cancelado_por_id: currentUser.id,
          cancelado_por_nome: currentUser.name,
          cancelado_em: new Date().toISOString(),
        } as Parameters<typeof updateCarregamento>[1]);
      } else {
        const novaQtd = qtdOriginal - dados.quantidadeCancelada;
        await updateCarregamento(carregamento.id, {
          quantidade_total: novaQtd,
          obs_cancelamento_parcial: `Cancelamento parcial em ${new Date().toLocaleDateString('pt-BR')}: ${dados.quantidadeCancelada.toFixed(3)} ton removidas — ${dados.motivo}`,
          cancelado_por_id: currentUser.id,
          cancelado_por_nome: currentUser.name,
          cancelado_em: new Date().toISOString(),
        } as Parameters<typeof updateCarregamento>[1]);
      }

      await registrarAuditLog({
        tabela: 'carregamentos',
        registro_id: carregamento.id,
        acao: dados.tipo === 'total' ? 'DELETE' : 'UPDATE',
        dados_anteriores: anterior as unknown as Record<string, unknown>,
        dados_novos: {
          status: dados.tipo === 'total' ? 'cancelado' : anterior.status,
          quantidade_total:
            dados.tipo === 'total' ? qtdOriginal : qtdOriginal - dados.quantidadeCancelada,
          tipo_cancelamento: dados.tipo,
          quantidade_cancelada: dados.tipo === 'total' ? qtdOriginal : dados.quantidadeCancelada,
        } as Record<string, unknown>,
        motivo: `Cancelamento ${dados.tipo}: ${dados.motivo}`,
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });

      showSuccess(
        dados.tipo === 'total'
          ? 'Carregamento cancelado. Saldo devolvido ao pedido.'
          : `Cancelamento parcial: ${dados.quantidadeCancelada.toFixed(3)} ton devolvidas ao pedido.`
      );
      setCarregamentoParaCancelar(null);
      await load();
    } catch (err) {
      showError('Erro ao cancelar carregamento.');
      console.error(err);
    }
  };

  // ── Solicitar cotação para múltiplas transportadoras (view Solicitação) ───
  const handleSolicitarCotacaoMultipla = async (
    carregamentoId: string,
    transportadoraIds: string[],
    prazo_dias?: number,
    observacoes?: string
  ) => {
    try {
      await Promise.all(
        transportadoraIds.map((tid) =>
          createCotacao({
            carregamento_id: carregamentoId,
            transportadora_id: tid,
            prazo_dias,
            observacoes,
            status: 'pendente',
            solicitado_por: currentUser.id,
          })
        )
      );
      await updateStatusCarregamento(carregamentoId, 'cotacao_solicitada', {
        data_solicitacao_cotacao: new Date().toISOString(),
      });
      showSuccess(
        `Cotação solicitada para ${transportadoraIds.length} transportadora${transportadoraIds.length > 1 ? 's' : ''}!`
      );
      await load();
    } catch {
      showError('Erro ao solicitar cotações.');
    }
  };

  // ── Liberar ───────────────────────────────────────────────────────────────
  const handleLiberacao = async (
    carregamentoId: string,
    tipo: 'total' | 'parcial',
    quantidade?: number
  ) => {
    const c = carregamentos.find((x) => x.id === carregamentoId);
    if (!c) return;
    const qtdLiberada =
      tipo === 'total' ? c.quantidade_total : c.quantidade_liberada + (quantidade ?? 0);
    const novoStatus: StatusCarregamento = tipo === 'total' ? 'liberado_total' : 'liberado_parcial';
    await updateStatusCarregamento(carregamentoId, novoStatus, {
      tipo_liberacao: tipo,
      quantidade_liberada: qtdLiberada,
      data_liberacao: new Date().toISOString(),
      liberado_por: currentUser.id,
    });
    setModalLiberacao(null);
    await load();
  };

  // ── Informar transportador ────────────────────────────────────────────────
  const handleInformarTransportador = async (transportadoraId: string, valorFrete?: number) => {
    if (!modalTransportador) return;
    await updateCarregamento(modalTransportador.id, {
      transportadora_id: transportadoraId,
      valor_frete: valorFrete,
      status: 'em_carregamento',
    });
    setModalTransportador(null);
    await load();
  };

  // ── Page title map ────────────────────────────────────────────────────────
  const titles: Record<CarregamentoView, string> = {
    visao_geral: 'Visão Geral',
    solicitacao: 'Solicitação de Cotação',
    liberacao: 'Liberação de Carregamento',
    logistica: 'Painel de Logística',
    calendario: 'Calendário de Carregamentos',
    relatorios: 'Relatórios',
    transportadoras: 'Transportadoras',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-800 flex items-center gap-2">
            <Truck className="w-7 h-7 text-amber-600" />
            Carregamento — {titles[view]}
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Gestão completa do fluxo de cotação e carregamento
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && view === 'visao_geral' && (
            <button
              onClick={() => setShowModalNovo(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Carregamento
            </button>
          )}
        </div>
      </div>

      {/* Views */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {loadError}
        </div>
      )}
      {view === 'visao_geral' && (
        <VisaoGeral
          carregamentos={carregamentos}
          kpi={kpi}
          loading={loading}
          onAction={handleAction}
          currentUser={currentUser}
          onEdit={(c) => setEditandoCarregamento(c)}
          onDelete={(c) => {
            setExcluindoCarregamento(c);
            setMotivoExclusao('');
          }}
          onCancel={(c) => setCarregamentoParaCancelar(c)}
          onHistory={(c) => setHistoricoCarregamento(c)}
        />
      )}
      {view === 'solicitacao' && <SolicitacaoCotacaoIndependente currentUser={currentUser} />}
      {view === 'liberacao' && (
        <LiberacaoCarregamento
          carregamentos={carregamentos}
          loading={loading}
          onAction={handleAction}
        />
      )}
      {view === 'logistica' && (
        <PainelLogistica carregamentos={carregamentosLogistica} loading={loading} onAction={handleAction} />
      )}
      {view === 'calendario' && <CalendarioCarregamentos currentUser={currentUser} />}
      {view === 'relatorios' && (
        <RelatoriosCarregamento filiais={filiais} transportadoras={transportadoras} />
      )}
      {view === 'transportadoras' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
          <TransportadoraManager />
        </div>
      )}

      {/* Modals */}
      {showModalNovo && (
        <ModalNovoCarregamento
          filiais={filiaisVisiveis}
          onSave={handleCreateCarregamento}
          onClose={() => setShowModalNovo(false)}
        />
      )}
      {/* Edit modal */}
      {editandoCarregamento && (
        <ModalNovoCarregamento
          filiais={filiaisVisiveis}
          onSave={handleEditarCarregamento}
          onClose={() => setEditandoCarregamento(null)}
          carregamentoEditando={editandoCarregamento}
        />
      )}
      {/* Delete confirmation dialog */}
      {excluindoCarregamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-5 border-b border-stone-100">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Excluir Carregamento</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {fmtCarregamentoNum(excluindoCarregamento)}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-stone-600">
                Tem certeza que deseja excluir{' '}
                <strong>{fmtCarregamentoNum(excluindoCarregamento)}</strong>? Esta ação não pode ser
                desfeita.
              </p>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  placeholder="Informe o motivo da exclusão..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setExcluindoCarregamento(null);
                    setMotivoExclusao('');
                  }}
                  disabled={excluindoLoading}
                  className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarExclusao}
                  disabled={excluindoLoading || !motivoExclusao.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  {excluindoLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cancel carregamento modal */}
      {carregamentoParaCancelar && (
        <ModalCancelarCarregamento
          carregamento={carregamentoParaCancelar}
          onConfirm={(dados) => handleCancelarCarregamento(carregamentoParaCancelar, dados)}
          onClose={() => setCarregamentoParaCancelar(null)}
        />
      )}
      {/* History modal */}
      {historicoCarregamento && (
        <HistoricoModificacoes
          tabela="carregamentos"
          registroId={historicoCarregamento.id}
          titulo={fmtCarregamentoNum(historicoCarregamento)}
          isOpen={!!historicoCarregamento}
          onClose={() => setHistoricoCarregamento(null)}
        />
      )}
      {modalCotacao && (
        <ModalCotacao
          carregamento={modalCotacao}
          transportadoras={transportadoras}
          onSave={handleSolicitarCotacao}
          onClose={() => setModalCotacao(null)}
        />
      )}
      {modalLiberacao && (
        <ModalLiberacao
          carregamento={modalLiberacao}
          onSave={handleLiberacao}
          onClose={() => setModalLiberacao(null)}
        />
      )}

      {/* Modal: Informar Transportador */}
      {modalTransportador && (
        <ModalInformarTransportador
          carregamento={modalTransportador}
          transportadoras={transportadoras}
          onSave={handleInformarTransportador}
          onClose={() => setModalTransportador(null)}
        />
      )}
    </div>
  );
}
