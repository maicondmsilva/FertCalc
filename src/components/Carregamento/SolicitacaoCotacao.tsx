import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  MapPin,
  Truck,
} from 'lucide-react';
import { User } from '../../types';
import { Filial, LocalCarregamento, Transportadora, CotacaoSolicitada, StatusCotacaoSolicitada } from '../../types/carregamento';
import { getFiliais, getTransportadoras } from '../../services/carregamentoService';
import { getLocaisAtivos } from '../../services/locaisCarregamentoService';
import {
  createCotacaoSolicitada,
  updateCotacaoSolicitada,
  getCotacoesByVendedor,
  getCotacoesByFiliais,
  getResponsaveisByFilial,
} from '../../services/cotacaoSolicitadaService';
import { notifyCotacaoSolicitada, notifyCotacaoDisponivel } from '../../services/notificationService';
import { useToast } from '../Toast';

// ─────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────

interface SolicitacaoCotacaoProps {
  currentUser: User;
}

// ─────────────────────────────────────────────────────────────
//  Status badge helpers
// ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusCotacaoSolicitada, string> = {
  aguardando: 'Aguardando',
  em_analise: 'Em Análise',
  cotado: 'Cotado',
  aprovado: 'Aprovado',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<StatusCotacaoSolicitada, string> = {
  aguardando: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  em_analise: 'bg-blue-100 text-blue-700 border-blue-200',
  cotado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  aprovado: 'bg-green-700 text-white border-green-700',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_ICON: Record<StatusCotacaoSolicitada, React.ReactNode> = {
  aguardando: <Clock className="w-3 h-3" />,
  em_analise: <RefreshCw className="w-3 h-3" />,
  cotado: <CheckCircle className="w-3 h-3" />,
  aprovado: <CheckCircle className="w-3 h-3" />,
  cancelado: <XCircle className="w-3 h-3" />,
};

function StatusBadge({ status }: { status: StatusCotacaoSolicitada }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLOR[status]}`}
    >
      {STATUS_ICON[status]}
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value?: number) {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─────────────────────────────────────────────────────────────
//  Detail Modal (read-only for vendedor)
// ─────────────────────────────────────────────────────────────

function DetalheModal({ cotacao, onClose }: { cotacao: CotacaoSolicitada; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <p className="font-mono font-bold text-blue-600 text-base">{cotacao.numero_cotacao}</p>
            <p className="text-xs text-stone-400 mt-0.5">Detalhes da Solicitação</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={cotacao.status} />
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Dados da solicitação */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Cliente</p>
              <p className="text-stone-700">{cotacao.cliente_nome || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Filial</p>
              <p className="text-stone-700">{cotacao.filial?.nome || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Local de Carregamento</p>
              <p className="text-stone-700">{cotacao.local_carregamento?.nome || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Quantidade (ton)</p>
              <p className="text-stone-700">{cotacao.quantidade_ton?.toFixed(3) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Produto/Pedido</p>
              <p className="text-stone-700">{cotacao.produto || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Data</p>
              <p className="text-stone-700">{formatDate(cotacao.criado_em)}</p>
            </div>
          </div>

          {cotacao.endereco_entrega && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Endereço de Entrega</p>
              <p className="text-sm text-stone-700">{cotacao.endereco_entrega}</p>
            </div>
          )}
          {cotacao.fazenda && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Fazenda</p>
              <p className="text-sm text-stone-700">{cotacao.fazenda}</p>
            </div>
          )}
          {cotacao.maps_url && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Link Maps</p>
              <a href={cotacao.maps_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">
                {cotacao.maps_url}
              </a>
            </div>
          )}
          {cotacao.observacoes && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Observações</p>
              <p className="text-sm text-stone-700">{cotacao.observacoes}</p>
            </div>
          )}

          {/* Dados de resposta (se cotado/aprovado) */}
          {(cotacao.status === 'cotado' || cotacao.status === 'aprovado') && (
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-stone-400 uppercase">Resposta da Logística</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Transportadora</p>
                  <p className="text-stone-700">{cotacao.transportadora?.nome || cotacao.transportadora_nome || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Valor Total</p>
                  <p className="text-stone-700 font-semibold">{formatCurrency(cotacao.valor_frete)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">R$/ton</p>
                  <p className="text-stone-700">{formatCurrency(cotacao.valor_frete_unitario)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Prazo (dias)</p>
                  <p className="text-stone-700">{cotacao.prazo_entrega_dias ?? '—'}</p>
                </div>
              </div>
              {cotacao.obs_responsavel && (
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Obs. Responsável</p>
                  <p className="text-sm text-stone-700">{cotacao.obs_responsavel}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Painel de resposta para o responsável
// ─────────────────────────────────────────────────────────────

interface PainelResponsavelProps {
  cotacao: CotacaoSolicitada;
  transportadoras: Transportadora[];
  canAprovar: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function PainelResponsavel({ cotacao, transportadoras, canAprovar, onClose, onUpdate }: PainelResponsavelProps) {
  const { showSuccess, showError } = useToast();
  const [transportadoraId, setTransportadoraId] = useState(cotacao.transportadora_id ?? '');
  const [valorFrete, setValorFrete] = useState(cotacao.valor_frete != null ? String(cotacao.valor_frete) : '');
  const [prazoDias, setPrazoDias] = useState(cotacao.prazo_entrega_dias != null ? String(cotacao.prazo_entrega_dias) : '');
  const [obsResponsavel, setObsResponsavel] = useState(cotacao.obs_responsavel ?? '');
  const [saving, setSaving] = useState(false);

  const valorFreteNum = parseFloat(valorFrete) || 0;
  const qtdTon = cotacao.quantidade_ton || 0;
  const valorUnitario = qtdTon > 0 ? valorFreteNum / qtdTon : 0;

  const canInformar = cotacao.status === 'aguardando' || cotacao.status === 'em_analise';

  const handleSalvarCotacao = async () => {
    if (!transportadoraId) {
      showError('Selecione uma transportadora.');
      return;
    }
    if (!valorFreteNum) {
      showError('Informe o valor do frete.');
      return;
    }
    setSaving(true);
    try {
      await updateCotacaoSolicitada(cotacao.id, {
        status: 'cotado',
        transportadora_id: transportadoraId,
        transportadora_nome: transportadoras.find((t) => t.id === transportadoraId)?.nome,
        valor_frete: valorFreteNum,
        valor_frete_unitario: valorUnitario,
        prazo_entrega_dias: prazoDias ? parseInt(prazoDias, 10) : undefined,
        obs_responsavel: obsResponsavel || undefined,
        cotado_em: new Date().toISOString(),
      });
      await notifyCotacaoDisponivel(
        { ...cotacao, status: 'cotado', numero_cotacao: cotacao.numero_cotacao },
        'Responsável de Logística'
      );
      showSuccess('Cotação informada com sucesso!');
      onUpdate();
      onClose();
    } catch {
      showError('Erro ao salvar cotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleAprovar = async () => {
    setSaving(true);
    try {
      await updateCotacaoSolicitada(cotacao.id, {
        status: 'aprovado',
        aprovado_em: new Date().toISOString(),
      });
      showSuccess('Cotação aprovada!');
      onUpdate();
      onClose();
    } catch {
      showError('Erro ao aprovar cotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async () => {
    if (!window.confirm('Deseja cancelar esta solicitação de cotação?')) return;
    setSaving(true);
    try {
      await updateCotacaoSolicitada(cotacao.id, { status: 'cancelado' });
      showSuccess('Cotação cancelada.');
      onUpdate();
      onClose();
    } catch {
      showError('Erro ao cancelar cotação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <p className="font-mono font-bold text-blue-600">{cotacao.numero_cotacao}</p>
            <p className="text-xs text-stone-400 mt-0.5">Tratar Solicitação</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={cotacao.status} />
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Dados do solicitante */}
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase mb-2">Dados da Solicitação</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Solicitante</p>
                <p className="font-medium text-stone-700">{cotacao.solicitante_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Data</p>
                <p className="font-medium text-stone-700">{formatDate(cotacao.criado_em)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Cliente</p>
                <p className="font-medium text-stone-700">{cotacao.cliente_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Filial</p>
                <p className="font-medium text-stone-700">{cotacao.filial?.nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Local de Carregamento</p>
                <p className="font-medium text-stone-700">{cotacao.local_carregamento?.nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Quantidade (ton)</p>
                <p className="font-medium text-stone-700">{cotacao.quantidade_ton?.toFixed(3) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Produto/Pedido</p>
                <p className="font-medium text-stone-700">{cotacao.produto || '—'}</p>
              </div>
            </div>
            {cotacao.endereco_entrega && (
              <div className="mt-2">
                <p className="text-xs text-stone-400 mb-0.5">Endereço de Entrega</p>
                <p className="text-sm text-stone-700">{cotacao.endereco_entrega}</p>
              </div>
            )}
            {cotacao.fazenda && (
              <div className="mt-2">
                <p className="text-xs text-stone-400 mb-0.5">Fazenda</p>
                <p className="text-sm text-stone-700">{cotacao.fazenda}</p>
              </div>
            )}
            {cotacao.maps_url && (
              <div className="mt-2">
                <p className="text-xs text-stone-400 mb-0.5">Link Maps</p>
                <a href={cotacao.maps_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">
                  {cotacao.maps_url}
                </a>
              </div>
            )}
            {cotacao.observacoes && (
              <div className="mt-2">
                <p className="text-xs text-stone-400 mb-0.5">Observações</p>
                <p className="text-sm text-stone-700">{cotacao.observacoes}</p>
              </div>
            )}
          </div>

          {/* Seção de informar cotação */}
          {canInformar && (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-600">
                Informar Cotação
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Transportadora <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transportadoraId}
                    onChange={(e) => setTransportadoraId(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {transportadoras.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Valor Total do Frete (R$) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorFrete}
                      onChange={(e) => setValorFrete(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="0,00"
                    />
                    {valorFreteNum > 0 && qtdTon > 0 && (
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                        ≈ {formatCurrency(valorUnitario)}/ton
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Prazo de Entrega (dias)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={prazoDias}
                      onChange={(e) => setPrazoDias(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Observações do Responsável
                  </label>
                  <textarea
                    rows={2}
                    value={obsResponsavel}
                    onChange={(e) => setObsResponsavel(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                    placeholder="Observações opcionais..."
                  />
                </div>

                <button
                  onClick={handleSalvarCotacao}
                  disabled={saving}
                  className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar Cotação'}
                </button>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2">
            {canAprovar && cotacao.status === 'cotado' && (
              <button
                onClick={handleAprovar}
                disabled={saving}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                ✓ Aprovar
              </button>
            )}
            {(cotacao.status === 'aguardando' || cotacao.status === 'em_analise' || cotacao.status === 'cotado') && (
              <button
                onClick={handleCancelar}
                disabled={saving}
                className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg font-bold text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────

export default function SolicitacaoCotacao({ currentUser }: SolicitacaoCotacaoProps) {
  const { showSuccess, showError } = useToast();
  const role = currentUser.role;

  const canSolicitar =
    currentUser.permissions?.carregamento_solicitar_cotacao ||
    role === 'master' ||
    role === 'admin';

  const canTratar =
    currentUser.permissions?.carregamento_tratar_cotacao ||
    role === 'master' ||
    role === 'admin';

  const canAprovar = role === 'master' || role === 'admin' || !!currentUser.permissions?.carregamento_admin;

  const filialIds: string[] = useMemo(
    () => currentUser.permissions?.carregamento_filial_ids ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(currentUser.permissions?.carregamento_filial_ids)]
  );

  // ── State ──
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);

  // Vendedor state
  const [showForm, setShowForm] = useState(false);
  const [minhasCotacoes, setMinhasCotacoes] = useState<CotacaoSolicitada[]>([]);
  const [loadingMinhas, setLoadingMinhas] = useState(false);
  const [detalheModal, setDetalheModal] = useState<CotacaoSolicitada | null>(null);

  // Form state
  const [formCliente, setFormCliente] = useState('');
  const [formFilialId, setFormFilialId] = useState('');
  const [formLocalId, setFormLocalId] = useState('');
  const [formEndereco, setFormEndereco] = useState('');
  const [formFazenda, setFormFazenda] = useState('');
  const [formMaps, setFormMaps] = useState('');
  const [formProduto, setFormProduto] = useState('');
  const [formQtd, setFormQtd] = useState('');
  const [formObs, setFormObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Responsável state
  const [cotacoesResponsavel, setCotacoesResponsavel] = useState<CotacaoSolicitada[]>([]);
  const [loadingResponsavel, setLoadingResponsavel] = useState(false);
  const [painelCotacao, setPainelCotacao] = useState<CotacaoSolicitada | null>(null);

  // ── Load data ──
  const loadFiliais = useCallback(async () => {
    const data = await getFiliais();
    // If user has filial restrictions, filter
    if (filialIds.length > 0) {
      setFiliais(data.filter((f) => filialIds.includes(f.id)));
    } else {
      setFiliais(data);
    }
  }, [filialIds]);

  const loadTransportadoras = useCallback(async () => {
    const data = await getTransportadoras();
    setTransportadoras(data);
  }, []);

  const loadMinhasCotacoes = useCallback(async () => {
    if (!canSolicitar) return;
    setLoadingMinhas(true);
    try {
      const data = await getCotacoesByVendedor(currentUser.id);
      setMinhasCotacoes(data);
    } catch {
      // silent
    } finally {
      setLoadingMinhas(false);
    }
  }, [currentUser.id, canSolicitar]);

  const loadCotacoesResponsavel = useCallback(async () => {
    if (!canTratar) return;
    setLoadingResponsavel(true);
    try {
      const data = await getCotacoesByFiliais(filialIds);
      setCotacoesResponsavel(data);
    } catch {
      // silent
    } finally {
      setLoadingResponsavel(false);
    }
  }, [canTratar, filialIds]);

  useEffect(() => {
    loadFiliais();
    loadTransportadoras();
    loadMinhasCotacoes();
    loadCotacoesResponsavel();
  }, [loadFiliais, loadTransportadoras, loadMinhasCotacoes, loadCotacoesResponsavel]);

  // Load locais when filial changes
  useEffect(() => {
    if (!formFilialId) {
      setLocais([]);
      setFormLocalId('');
      return;
    }
    getLocaisAtivos(formFilialId).then((data) => {
      setLocais(data);
      setFormLocalId('');
    });
  }, [formFilialId]);

  // ── Form submit ──
  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCliente.trim()) {
      showError('Informe o nome do cliente.');
      return;
    }
    setSubmitting(true);
    try {
      const cotacao = await createCotacaoSolicitada({
        solicitado_por: currentUser.id,
        solicitante_nome: currentUser.name,
        cliente_nome: formCliente.trim(),
        filial_id: formFilialId || undefined,
        local_carregamento_id: formLocalId || undefined,
        endereco_entrega: formEndereco.trim() || undefined,
        fazenda: formFazenda.trim() || undefined,
        maps_url: formMaps.trim() || undefined,
        produto: formProduto.trim() || undefined,
        quantidade_ton: formQtd ? parseFloat(formQtd) : undefined,
        observacoes: formObs.trim() || undefined,
        status: 'aguardando',
      });

      // Notify responsáveis for the selected filial
      const responsavelIds = await getResponsaveisByFilial(formFilialId || undefined);
      await notifyCotacaoSolicitada(cotacao, currentUser.name ?? 'Vendedor', responsavelIds);

      showSuccess('Solicitação de cotação enviada com sucesso!');
      // Reset form
      setFormCliente('');
      setFormFilialId('');
      setFormLocalId('');
      setFormEndereco('');
      setFormFazenda('');
      setFormMaps('');
      setFormProduto('');
      setFormQtd('');
      setFormObs('');
      setShowForm(false);
      await loadMinhasCotacoes();
    } catch {
      showError('Erro ao solicitar cotação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    await loadMinhasCotacoes();
    await loadCotacoesResponsavel();
  };

  // ─────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════
          VISÃO A — Vendedor
      ══════════════════════════════════════════════════════ */}
      {canSolicitar && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-800">Minhas Solicitações de Cotação</h2>
              <p className="text-xs text-stone-400 mt-0.5">Solicite cotações de frete independentes</p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors"
            >
              {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Fechar' : '+ Nova Cotação'}
            </button>
          </div>

          {/* Nova Solicitação Form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
                Nova Solicitação de Cotação
              </div>
              <form onSubmit={handleSolicitar} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCliente}
                      onChange={(e) => setFormCliente(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Nome do cliente"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Filial</label>
                    <select
                      value={formFilialId}
                      onChange={(e) => setFormFilialId(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">Selecione...</option>
                      {filiais.map((f) => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Local de Carregamento</label>
                    <select
                      value={formLocalId}
                      onChange={(e) => setFormLocalId(e.target.value)}
                      disabled={!formFilialId}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      {locais.map((l) => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Endereço de Entrega</label>
                    <input
                      type="text"
                      value={formEndereco}
                      onChange={(e) => setFormEndereco(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Endereço de entrega"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Fazenda</label>
                    <input
                      type="text"
                      value={formFazenda}
                      onChange={(e) => setFormFazenda(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Nome da fazenda"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Link Maps</label>
                    <input
                      type="url"
                      value={formMaps}
                      onChange={(e) => setFormMaps(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Produto/Pedido</label>
                    <input
                      type="text"
                      value={formProduto}
                      onChange={(e) => setFormProduto(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Produto ou nº do pedido (opcional)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Quantidade (ton)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={formQtd}
                      onChange={(e) => setFormQtd(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="0.000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={formObs}
                    onChange={(e) => setFormObs(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                    placeholder="Informações adicionais..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-stone-600 border border-stone-300 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Enviando...' : 'Solicitar Cotação'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista Minhas Cotações */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-700 text-sm">Minhas Cotações</h3>
              <button onClick={loadMinhasCotacoes} className="text-stone-400 hover:text-stone-600 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingMinhas ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
              </div>
            ) : minhasCotacoes.length === 0 ? (
              <div className="py-10 text-center text-stone-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma solicitação encontrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2 text-left">Nº</th>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left hidden sm:table-cell">Filial</th>
                      <th className="px-4 py-2 text-left hidden md:table-cell">Local</th>
                      <th className="px-4 py-2 text-right hidden md:table-cell">Qtd (ton)</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left hidden sm:table-cell">Data</th>
                      <th className="px-4 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {minhasCotacoes.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 text-xs">{c.numero_cotacao}</td>
                        <td className="px-4 py-3 text-stone-700">{c.cliente_nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{c.filial?.nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-500 hidden md:table-cell">{c.local_carregamento?.nome || '—'}</td>
                        <td className="px-4 py-3 text-right text-stone-700 hidden md:table-cell">
                          {c.quantidade_ton?.toFixed(3) ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs hidden sm:table-cell">
                          {formatDate(c.criado_em)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDetalheModal(c)}
                            className="text-stone-400 hover:text-amber-600 transition-colors"
                            title="Ver detalhes"
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VISÃO B — Responsável
      ══════════════════════════════════════════════════════ */}
      {canTratar && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-800">Solicitações Pendentes — Logística</h2>
              <p className="text-xs text-stone-400 mt-0.5">Cotações aguardando resposta ou aprovação</p>
            </div>
            <button onClick={loadCotacoesResponsavel} className="text-stone-400 hover:text-stone-600 transition-colors p-1">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {loadingResponsavel ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-5 h-5 animate-spin text-stone-300" />
              </div>
            ) : cotacoesResponsavel.length === 0 ? (
              <div className="py-10 text-center text-stone-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma solicitação pendente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2 text-left">Nº</th>
                      <th className="px-4 py-2 text-left">Solicitante</th>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left hidden sm:table-cell">Filial</th>
                      <th className="px-4 py-2 text-right hidden md:table-cell">Qtd (ton)</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left hidden sm:table-cell">Data</th>
                      <th className="px-4 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cotacoesResponsavel.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 text-xs">{c.numero_cotacao}</td>
                        <td className="px-4 py-3 text-stone-700">{c.solicitante_nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-700">{c.cliente_nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{c.filial?.nome || '—'}</td>
                        <td className="px-4 py-3 text-right text-stone-700 hidden md:table-cell">
                          {c.quantidade_ton?.toFixed(3) ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs hidden sm:table-cell">
                          {formatDate(c.criado_em)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setPainelCotacao(c)}
                            className="text-stone-400 hover:text-amber-600 transition-colors"
                            title="Tratar cotação"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sem permissão */}
      {!canSolicitar && !canTratar && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 text-center text-stone-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Você não tem permissão para acessar esta funcionalidade.</p>
        </div>
      )}

      {/* Modals */}
      {detalheModal && (
        <DetalheModal cotacao={detalheModal} onClose={() => setDetalheModal(null)} />
      )}
      {painelCotacao && (
        <PainelResponsavel
          cotacao={painelCotacao}
          transportadoras={transportadoras}
          canAprovar={canAprovar}
          onClose={() => setPainelCotacao(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
