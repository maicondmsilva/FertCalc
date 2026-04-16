import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  ChevronUp,
  Eye,
  X,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  Truck,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { User, Client } from '../../types';
import {
  Filial,
  LocalCarregamento,
  Transportadora,
  CotacaoSolicitada,
  StatusCotacaoSolicitada,
} from '../../types/carregamento';
import { getFiliais, getTransportadoras } from '../../services/carregamentoService';
import { getLocaisAtivos } from '../../services/locaisCarregamentoService';
import { getClients } from '../../services/db';
import {
  createCotacaoSolicitada,
  updateCotacaoSolicitada,
  getCotacoesByVendedor,
  getCotacoesByFiliais,
  getResponsaveisByFilial,
} from '../../services/cotacaoSolicitadaService';
import { registrarAuditLog } from '../../services/auditLogService';
import {
  notifyCotacaoSolicitada,
  notifyCotacaoDisponivel,
  notifyCotacaoCancelada,
} from '../../services/notificationService';
import { useToast } from '../Toast';
import HistoricoModificacoes from '../HistoricoModificacoes';

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
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value?: number) {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sanitizeUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
//  Permission helper for cotações
// ─────────────────────────────────────────────────────────────
function canEditDeleteCotacao(
  status: StatusCotacaoSolicitada,
  currentUser: User,
  solicitadoPor?: string
): { canEdit: boolean; canDelete: boolean } {
  const isAdmin = ['admin', 'master'].includes(currentUser.role);
  const isLogistica =
    !!(currentUser.permissions as Record<string, unknown>)?.carregamento_aprovar ||
    !!(currentUser.permissions as Record<string, unknown>)?.carregamento_tratar_cotacao;
  if (isAdmin || isLogistica) return { canEdit: true, canDelete: true };
  const isSolicitante = currentUser.id === solicitadoPor;
  if (status === 'aprovado' || status === 'cancelado') return { canEdit: false, canDelete: false };
  if (status === 'cotado') return { canEdit: false, canDelete: isSolicitante };
  return { canEdit: isSolicitante, canDelete: isSolicitante };
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
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">
                Local de Carregamento
              </p>
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
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">
                Endereço de Entrega
              </p>
              <p className="text-sm text-stone-700">{cotacao.endereco_entrega}</p>
            </div>
          )}
          {cotacao.fazenda && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Fazenda</p>
              <p className="text-sm text-stone-700">{cotacao.fazenda}</p>
            </div>
          )}
          {cotacao.maps_url && sanitizeUrl(cotacao.maps_url) && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Link Maps</p>
              <a
                href={sanitizeUrl(cotacao.maps_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline break-all"
              >
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
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">
                    Transportadora
                  </p>
                  <p className="text-stone-700">
                    {cotacao.transportadora?.nome || cotacao.transportadora_nome || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">Valor Total</p>
                  <p className="text-stone-700 font-semibold">
                    {formatCurrency(cotacao.valor_frete)}
                  </p>
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
                  <p className="text-xs font-bold text-stone-400 uppercase mb-0.5">
                    Obs. Responsável
                  </p>
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
  currentUser: User;
  isLogistica: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function PainelResponsavel({
  cotacao,
  transportadoras,
  canAprovar,
  currentUser,
  isLogistica,
  isAdmin,
  onClose,
  onUpdate,
}: PainelResponsavelProps) {
  const { showSuccess, showError } = useToast();
  const [transportadoraId, setTransportadoraId] = useState(cotacao.transportadora_id ?? '');
  const [fretePorTon, setFretePorTon] = useState(
    cotacao.valor_frete_unitario != null ? String(cotacao.valor_frete_unitario) : ''
  );
  const [prazoDias, setPrazoDias] = useState(
    cotacao.prazo_entrega_dias != null ? String(cotacao.prazo_entrega_dias) : ''
  );
  const [obsResponsavel, setObsResponsavel] = useState(cotacao.obs_responsavel ?? '');
  const [saving, setSaving] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [showModalRecusa, setShowModalRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [historico, setHistorico] = useState<
    import('../../services/auditLogService').AuditLogCarregamento[]
  >([]);

  const fretePorTonNum = parseFloat(fretePorTon) || 0;
  const qtdTon = cotacao.quantidade_ton || 0;
  const valorTotalFrete = fretePorTonNum * qtdTon;

  const canInformar = cotacao.status === 'aguardando' || cotacao.status === 'em_analise';
  const canEdit = cotacao.status === 'cotado' && (isLogistica || isAdmin);

  useEffect(() => {
    import('../../services/auditLogService')
      .then(({ getAuditLog }) => getAuditLog('cotacoes_solicitadas', cotacao.id))
      .then(setHistorico)
      .catch(() => {});
  }, [cotacao.id]);

  const handleSalvarCotacao = async () => {
    if (!transportadoraId) {
      showError('Selecione uma transportadora.');
      return;
    }
    if (!fretePorTonNum) {
      showError('Informe o valor do frete por tonelada.');
      return;
    }
    setSaving(true);
    try {
      await updateCotacaoSolicitada(cotacao.id, {
        status: 'cotado',
        transportadora_id: transportadoraId,
        transportadora_nome: transportadoras.find((t) => t.id === transportadoraId)?.nome,
        valor_frete: valorTotalFrete,
        valor_frete_unitario: fretePorTonNum,
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

  const handleEditarCotacaoResponsavel = async () => {
    if (!fretePorTonNum) {
      showError('Informe o valor do frete por tonelada.');
      return;
    }
    setSaving(true);
    const anterior = { ...cotacao };
    const updates = {
      transportadora_id: transportadoraId || undefined,
      transportadora_nome: transportadoras.find((t) => t.id === transportadoraId)?.nome,
      valor_frete: valorTotalFrete,
      valor_frete_unitario: fretePorTonNum,
      prazo_entrega_dias: prazoDias ? parseInt(prazoDias, 10) : undefined,
      obs_responsavel: obsResponsavel || undefined,
    };
    try {
      await updateCotacaoSolicitada(cotacao.id, updates);
      const { registrarAuditLog } = await import('../../services/auditLogService');
      await registrarAuditLog({
        tabela: 'cotacoes_solicitadas',
        registro_id: cotacao.id,
        acao: 'UPDATE',
        dados_anteriores: anterior as unknown as Record<string, unknown>,
        dados_novos: { ...anterior, ...updates } as unknown as Record<string, unknown>,
        motivo: 'Edição de cotação após envio',
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      showSuccess('Cotação atualizada com sucesso!');
      setModoEdicao(false);
      onUpdate();
    } catch {
      showError('Erro ao atualizar cotação.');
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

  const handleRecusarCotacao = async () => {
    if (!motivoRecusa.trim()) {
      showError('Informe o motivo da recusa.');
      return;
    }
    setSaving(true);
    const anterior = { ...cotacao };
    try {
      await updateCotacaoSolicitada(cotacao.id, {
        status: 'em_analise',
        motivo_recusa: motivoRecusa.trim(),
        recusado_por_id: currentUser.id,
        recusado_por_nome: currentUser.name ?? currentUser.id,
        recusado_em: new Date().toISOString(),
        transportadora_id: undefined,
        transportadora_nome: undefined,
        valor_frete: undefined,
        valor_frete_unitario: undefined,
        cotado_em: undefined,
      } as unknown as Parameters<typeof updateCotacaoSolicitada>[1]);
      const { registrarAuditLog } = await import('../../services/auditLogService');
      await registrarAuditLog({
        tabela: 'cotacoes_solicitadas',
        registro_id: cotacao.id,
        acao: 'UPDATE',
        dados_anteriores: anterior as unknown as Record<string, unknown>,
        dados_novos: { status: 'em_analise', motivo_recusa: motivoRecusa.trim() } as Record<
          string,
          unknown
        >,
        motivo: `Recusado: ${motivoRecusa.trim()}`,
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      await notifyCotacaoCancelada(
        { ...cotacao, status: 'em_analise' },
        `${currentUser.name ?? 'Responsável'} — Motivo: ${motivoRecusa.trim()}`
      );
      showSuccess('Cotação devolvida ao solicitante para revisão.');
      setShowModalRecusa(false);
      setMotivoRecusa('');
      onUpdate();
      onClose();
    } catch {
      showError('Erro ao recusar cotação.');
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
            {cotacao.status === 'cotado' && canEdit && !modoEdicao && (
              <button
                onClick={() => setModoEdicao(true)}
                className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Cotação
              </button>
            )}
            {modoEdicao && (
              <button
                onClick={() => setModoEdicao(false)}
                className="text-xs text-stone-500 underline"
              >
                Cancelar edição
              </button>
            )}
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
                <p className="font-medium text-stone-700">
                  {cotacao.local_carregamento?.nome || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Quantidade (ton)</p>
                <p className="font-medium text-stone-700">
                  {cotacao.quantidade_ton?.toFixed(3) ?? '—'}
                </p>
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
            {cotacao.maps_url && sanitizeUrl(cotacao.maps_url) && (
              <div className="mt-2">
                <p className="text-xs text-stone-400 mb-0.5">Link Maps</p>
                <a
                  href={sanitizeUrl(cotacao.maps_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline break-all"
                >
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
          {(canInformar || modoEdicao) && (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-stone-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-600">
                {modoEdicao ? 'Editar Cotação' : 'Informar Cotação'}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Transportadora <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transportadoraId}
                    onChange={(e) => setTransportadoraId(e.target.value)}
                    disabled={!modoEdicao && cotacao.status === 'cotado'}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                  >
                    <option value="">Selecione...</option>
                    {transportadoras.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-500 uppercase">
                    Frete por Tonelada (R$/ton) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fretePorTon}
                    onChange={(e) => setFretePorTon(e.target.value)}
                    placeholder="Ex: 148.50"
                    disabled={!modoEdicao && cotacao.status === 'cotado'}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                  {fretePorTonNum > 0 && qtdTon > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs text-emerald-600 font-bold uppercase mb-0.5">
                        Valor Total do Frete
                      </p>
                      <p className="text-xl font-black text-emerald-700">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(valorTotalFrete)}
                      </p>
                      <p className="text-xs text-emerald-500 mt-0.5">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(fretePorTonNum)}
                        /ton × {qtdTon.toFixed(3)} ton
                      </p>
                    </div>
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
                    disabled={!modoEdicao && cotacao.status === 'cotado'}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Observações do Responsável
                  </label>
                  <textarea
                    rows={2}
                    value={obsResponsavel}
                    onChange={(e) => setObsResponsavel(e.target.value)}
                    disabled={!modoEdicao && cotacao.status === 'cotado'}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none disabled:opacity-60"
                    placeholder="Observações opcionais..."
                  />
                </div>

                {modoEdicao ? (
                  <button
                    onClick={handleEditarCotacaoResponsavel}
                    disabled={saving}
                    className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Salvar Edição'}
                  </button>
                ) : (
                  canInformar && (
                    <button
                      onClick={handleSalvarCotacao}
                      disabled={saving}
                      className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Salvando...' : 'Salvar Cotação'}
                    </button>
                  )
                )}
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
            {(cotacao.status === 'aguardando' ||
              cotacao.status === 'em_analise' ||
              cotacao.status === 'cotado') && (
              <button
                onClick={() => setShowModalRecusa(true)}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-red-50 border border-red-300 text-red-600 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50"
              >
                Recusar / Devolver
              </button>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 0 && (
            <div className="border-t border-stone-100 pt-4 mt-4">
              <p className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Histórico de Alterações
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {historico.map((entry, i) => (
                  <div key={entry.id ?? i} className="flex gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-stone-600">{entry.usuario_nome}</span>
                      <span className="text-stone-400 mx-1">·</span>
                      <span className="text-stone-400">
                        {entry.criado_em ? new Date(entry.criado_em).toLocaleString('pt-BR') : ''}
                      </span>
                      <span className="ml-1 text-stone-500 capitalize">
                        ({entry.acao.toLowerCase()})
                      </span>
                      {entry.motivo && (
                        <p className="text-stone-500 italic mt-0.5">"{entry.motivo}"</p>
                      )}
                      {entry.campos_alterados && entry.campos_alterados.length > 0 && (
                        <p className="text-stone-400 mt-0.5">
                          Alterou: {entry.campos_alterados.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Recusa */}
      {showModalRecusa && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Recusar e Devolver para Revisão</h3>
            </div>
            <p className="text-sm text-stone-500">
              A cotação voltará ao status <strong>em análise</strong> e o solicitante receberá uma
              notificação com o motivo. Ele poderá editar e reenviar.
            </p>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Motivo da Recusa <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex: Prazo incompatível, transportadora sem disponibilidade..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModalRecusa(false);
                  setMotivoRecusa('');
                }}
                className="px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg font-bold hover:bg-stone-200"
              >
                Voltar
              </button>
              <button
                onClick={handleRecusarCotacao}
                disabled={saving || !motivoRecusa.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modal: Editar Cotação (vendedor edita campos antes da aprovação)
// ─────────────────────────────────────────────────────────────

interface ModalEditarCotacaoProps {
  cotacao: CotacaoSolicitada;
  filiais: Filial[];
  onSave: (
    e: React.FormEvent,
    form: {
      clienteNome: string;
      clienteId: string;
      filialId: string;
      localId: string;
      endereco: string;
      fazenda: string;
      maps: string;
      produto: string;
      qtd: string;
      obs: string;
    }
  ) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function ModalEditarCotacao({
  cotacao,
  filiais,
  onSave,
  onClose,
  saving,
}: ModalEditarCotacaoProps) {
  const [clienteNome, setClienteNome] = useState(cotacao.cliente_nome ?? '');
  const [filialId, setFilialId] = useState(cotacao.filial_id ?? '');
  const [localId, setLocalId] = useState(cotacao.local_carregamento_id ?? '');
  const [endereco, setEndereco] = useState(cotacao.endereco_entrega ?? '');
  const [fazenda, setFazenda] = useState(cotacao.fazenda ?? '');
  const [maps, setMaps] = useState(cotacao.maps_url ?? '');
  const [produto, setProduto] = useState(cotacao.produto ?? '');
  const [qtd, setQtd] = useState(
    cotacao.quantidade_ton != null ? String(cotacao.quantidade_ton) : ''
  );
  const [obs, setObs] = useState(cotacao.observacoes ?? '');
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);

  useEffect(() => {
    if (!filialId) {
      setLocais([]);
      return;
    }
    import('../../services/locaisCarregamentoService').then(({ getLocaisAtivos }) =>
      getLocaisAtivos(filialId)
        .then(setLocais)
        .catch(() => setLocais([]))
    );
  }, [filialId]);

  const handleSubmit = (e: React.FormEvent) => {
    onSave(e, {
      clienteNome,
      clienteId: cotacao.cliente_id ?? '',
      filialId,
      localId,
      endereco,
      fazenda,
      maps,
      produto,
      qtd,
      obs,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <p className="font-bold text-stone-800">Editar Cotação</p>
            <p className="text-xs text-stone-400 mt-0.5">{cotacao.numero_cotacao}</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Filial
              </label>
              <select
                value={filialId}
                onChange={(e) => {
                  setFilialId(e.target.value);
                  setLocalId('');
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="">Selecione...</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                Local de Carregamento
              </label>
              <select
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                disabled={!filialId}
              >
                <option value="">Selecione...</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Produto</label>
            <input
              type="text"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Quantidade (ton)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Endereço de Entrega
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Fazenda</label>
            <input
              type="text"
              value={fazenda}
              onChange={(e) => setFazenda(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Link Google Maps
            </label>
            <input
              type="url"
              value={maps}
              onChange={(e) => setMaps(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
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
    currentUser.permissions?.carregamento_tratar_cotacao || role === 'master' || role === 'admin';

  const canAprovar =
    role === 'master' || role === 'admin' || !!currentUser.permissions?.carregamento_admin;

  const filialIds: string[] = useMemo(
    () => currentUser.permissions?.carregamento_filial_ids ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(currentUser.permissions?.carregamento_filial_ids)]
  );

  // ── State ──
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);

  // Vendedor state
  const [showForm, setShowForm] = useState(false);
  const [minhasCotacoes, setMinhasCotacoes] = useState<CotacaoSolicitada[]>([]);
  const [loadingMinhas, setLoadingMinhas] = useState(false);
  const [detalheModal, setDetalheModal] = useState<CotacaoSolicitada | null>(null);

  // Form state
  const [formClienteNome, setFormClienteNome] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formClienteSearch, setFormClienteSearch] = useState('');
  const [showClienteResults, setShowClienteResults] = useState(false);
  const clienteSearchRef = useRef<HTMLDivElement>(null);
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

  // Delete confirmation state
  const [excluindoCotacao, setExcluindoCotacao] = useState<CotacaoSolicitada | null>(null);
  const [motivoExclusaoCotacao, setMotivoExclusaoCotacao] = useState('');
  const [excluindoLoading, setExcluindoLoading] = useState(false);

  // Edit state
  const [editandoCotacao, setEditandoCotacao] = useState<CotacaoSolicitada | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // History state
  const [historicoCotacao, setHistoricoCotacao] = useState<CotacaoSolicitada | null>(null);

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

  const loadClientes = useCallback(async () => {
    const data = await getClients();
    setAllClients(data);
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
    loadClientes();
    loadMinhasCotacoes();
    loadCotacoesResponsavel();
  }, [loadFiliais, loadTransportadoras, loadClientes, loadMinhasCotacoes, loadCotacoesResponsavel]);

  // Close client autocomplete on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clienteSearchRef.current && !clienteSearchRef.current.contains(event.target as Node)) {
        setShowClienteResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Pre-computed lowercase client values for autocomplete performance
  const clientsLower = useMemo(
    () =>
      allClients.map((c) => ({
        client: c,
        nameLower: c.name.toLowerCase(),
        codeLower: c.code.toLowerCase(),
      })),
    [allClients]
  );

  // Filtered clients for autocomplete
  const filteredClients = useMemo(() => {
    const q = formClienteSearch.trim().toLowerCase();
    if (!q) return [];
    return clientsLower
      .filter((x) => x.nameLower.includes(q) || x.codeLower.includes(q))
      .map((x) => x.client)
      .slice(0, 10);
  }, [clientsLower, formClienteSearch]);

  // Client selection helpers
  const clearClienteSelection = () => {
    setFormClienteNome('');
    setFormClienteId('');
    setFormClienteSearch('');
  };

  const selectCliente = (c: Client) => {
    setFormClienteNome(c.name);
    setFormClienteId(c.id);
    setFormClienteSearch(c.name);
    setShowClienteResults(false);
  };

  // Safe Maps URL: only allow http/https to prevent XSS
  const safeMapsUrl = sanitizeUrl(formMaps);

  // ── Form submit ──
  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClienteNome.trim()) {
      showError('Informe o nome do cliente.');
      return;
    }
    setSubmitting(true);
    try {
      const cotacao = await createCotacaoSolicitada({
        solicitado_por: currentUser.id,
        solicitante_nome: currentUser.name,
        cliente_id: formClienteId || undefined,
        cliente_nome: formClienteNome.trim(),
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
      setFormClienteNome('');
      setFormClienteId('');
      setFormClienteSearch('');
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

  const handleExcluirCotacao = async () => {
    if (!excluindoCotacao) return;
    if (!motivoExclusaoCotacao.trim()) {
      showError('Informe o motivo da exclusão.');
      return;
    }
    setExcluindoLoading(true);
    try {
      const snapshot = excluindoCotacao;
      await registrarAuditLog({
        tabela: 'cotacoes_solicitadas',
        registro_id: snapshot.id,
        acao: 'DELETE',
        dados_anteriores: snapshot as unknown as Record<string, unknown>,
        dados_novos: null,
        motivo: motivoExclusaoCotacao.trim(),
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      await updateCotacaoSolicitada(snapshot.id, { status: 'cancelado' });
      await notifyCotacaoCancelada(snapshot, currentUser.name ?? 'Usuário');
      showSuccess('Cotação excluída com sucesso.');
      setExcluindoCotacao(null);
      setMotivoExclusaoCotacao('');
      await handleUpdate();
    } catch {
      showError('Erro ao excluir cotação.');
    } finally {
      setExcluindoLoading(false);
    }
  };

  // ── Edit cotação handler ──
  const handleEditarCotacao = async (
    e: React.FormEvent,
    form: {
      clienteNome: string;
      clienteId: string;
      filialId: string;
      localId: string;
      endereco: string;
      fazenda: string;
      maps: string;
      produto: string;
      qtd: string;
      obs: string;
    }
  ) => {
    e.preventDefault();
    if (!editandoCotacao) return;
    if (!form.clienteNome.trim()) {
      showError('Informe o nome do cliente.');
      return;
    }
    setEditSaving(true);
    const anterior = editandoCotacao;
    const updates: Partial<CotacaoSolicitada> = {
      cliente_nome: form.clienteNome.trim(),
      filial_id: form.filialId || undefined,
      local_carregamento_id: form.localId || undefined,
      endereco_entrega: form.endereco.trim() || undefined,
      fazenda: form.fazenda.trim() || undefined,
      maps_url: form.maps.trim() || undefined,
      produto: form.produto.trim() || undefined,
      quantidade_ton: form.qtd ? parseFloat(form.qtd) : undefined,
      observacoes: form.obs.trim() || undefined,
    };
    // If the cotação was rejected, reset status to aguardando and clear rejection fields
    if (editandoCotacao.motivo_recusa) {
      Object.assign(updates, {
        status: 'aguardando' as const,
        motivo_recusa: null,
        recusado_por_id: null,
        recusado_por_nome: null,
        recusado_em: null,
      });
    }
    try {
      await updateCotacaoSolicitada(
        editandoCotacao.id,
        updates as Parameters<typeof updateCotacaoSolicitada>[1]
      );
      await registrarAuditLog({
        tabela: 'cotacoes_solicitadas',
        registro_id: editandoCotacao.id,
        acao: 'UPDATE',
        dados_anteriores: anterior as unknown as Record<string, unknown>,
        dados_novos: { ...anterior, ...updates } as unknown as Record<string, unknown>,
        usuario_id: currentUser.id,
        usuario_nome: currentUser.name ?? currentUser.id,
      });
      showSuccess('Cotação atualizada com sucesso!');
      setEditandoCotacao(null);
      await handleUpdate();
    } catch {
      showError('Erro ao editar cotação.');
    } finally {
      setEditSaving(false);
    }
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
              <p className="text-xs text-stone-400 mt-0.5">
                Solicite cotações de frete independentes
              </p>
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
                  {/* Client autocomplete */}
                  <div className="relative" ref={clienteSearchRef}>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    {formClienteNome ? (
                      <div className="flex items-center gap-2 px-3 py-2 border border-amber-400 bg-amber-50 rounded-lg text-sm">
                        <span className="flex-1 font-medium text-stone-800">{formClienteNome}</span>
                        <button
                          type="button"
                          onClick={clearClienteSelection}
                          className="text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
                          <input
                            type="text"
                            value={formClienteSearch}
                            onChange={(e) => {
                              setFormClienteSearch(e.target.value);
                              setShowClienteResults(true);
                            }}
                            onFocus={() => setShowClienteResults(true)}
                            className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="Digite nome ou código..."
                          />
                        </div>
                        {showClienteResults && filteredClients.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                            {filteredClients.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCliente(c)}
                                className="w-full text-left px-4 py-2 hover:bg-amber-50 border-b border-stone-100 last:border-0 transition-colors"
                              >
                                <p className="text-sm font-bold text-stone-800">{c.name}</p>
                                <p className="text-[10px] text-stone-500">{c.code}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Filial
                    </label>
                    <select
                      value={formFilialId}
                      onChange={(e) => setFormFilialId(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">Selecione...</option>
                      {filiais.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Local de Carregamento
                    </label>
                    <select
                      value={formLocalId}
                      onChange={(e) => setFormLocalId(e.target.value)}
                      disabled={!formFilialId}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      {locais.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Endereço de Entrega
                    </label>
                    <input
                      type="text"
                      value={formEndereco}
                      onChange={(e) => setFormEndereco(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Endereço de entrega"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Fazenda
                    </label>
                    <input
                      type="text"
                      value={formFazenda}
                      onChange={(e) => setFormFazenda(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Nome da fazenda"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Link Google Maps
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formMaps}
                        onChange={(e) => setFormMaps(e.target.value)}
                        className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="https://maps.google.com/..."
                      />
                      {safeMapsUrl && (
                        <a
                          href={safeMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-2 bg-stone-100 border border-stone-300 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors whitespace-nowrap"
                          title="Abrir no Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Produto/Pedido
                    </label>
                    <input
                      type="text"
                      value={formProduto}
                      onChange={(e) => setFormProduto(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Produto ou nº do pedido (opcional)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Quantidade (ton)
                    </label>
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
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Observações
                  </label>
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
              <button
                onClick={loadMinhasCotacoes}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
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
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-blue-600 text-xs">
                            {c.numero_cotacao}
                          </td>
                          <td className="px-4 py-3 text-stone-700">{c.cliente_nome || '—'}</td>
                          <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">
                            {c.filial?.nome || '—'}
                          </td>
                          <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                            {c.local_carregamento?.nome || '—'}
                          </td>
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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setDetalheModal(c)}
                                className="text-stone-400 hover:text-amber-600 transition-colors p-1"
                                title="Ver detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {(() => {
                                const perms = canEditDeleteCotacao(
                                  c.status,
                                  currentUser,
                                  c.solicitado_por
                                );
                                return (
                                  <>
                                    {perms.canEdit && (
                                      <button
                                        onClick={() => setEditandoCotacao(c)}
                                        className="text-stone-400 hover:text-amber-600 transition-colors p-1"
                                        title="Editar cotação"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}
                                    {perms.canDelete && (
                                      <button
                                        onClick={() => {
                                          setExcluindoCotacao(c);
                                          setMotivoExclusaoCotacao('');
                                        }}
                                        className="text-stone-400 hover:text-red-600 transition-colors p-1"
                                        title="Excluir cotação"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setHistoricoCotacao(c)}
                                      className="text-stone-400 hover:text-blue-600 transition-colors p-1"
                                      title="Histórico de modificações"
                                    >
                                      <History className="w-4 h-4" />
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                        {c.status === 'em_analise' && c.motivo_recusa && (
                          <tr>
                            <td colSpan={8} className="px-4 pb-3 pt-0">
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold text-red-700">
                                    Devolvida para revisão
                                  </p>
                                  <p className="text-xs text-red-600 mt-0.5">
                                    <strong>{c.recusado_por_nome ?? 'Logística'}</strong>: "
                                    {c.motivo_recusa}"
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
              <h2 className="text-base font-bold text-stone-800">
                Solicitações Pendentes — Logística
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Cotações aguardando resposta ou aprovação
              </p>
            </div>
            <button
              onClick={loadCotacoesResponsavel}
              className="text-stone-400 hover:text-stone-600 transition-colors p-1"
            >
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
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 text-xs">
                          {c.numero_cotacao}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{c.solicitante_nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-700">{c.cliente_nome || '—'}</td>
                        <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">
                          {c.filial?.nome || '—'}
                        </td>
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPainelCotacao(c)}
                              className="text-stone-400 hover:text-amber-600 transition-colors p-1"
                              title="Tratar cotação"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                            {(() => {
                              const perms = canEditDeleteCotacao(
                                c.status,
                                currentUser,
                                c.solicitado_por
                              );
                              return (
                                <>
                                  {perms.canDelete && (
                                    <button
                                      onClick={() => {
                                        setExcluindoCotacao(c);
                                        setMotivoExclusaoCotacao('');
                                      }}
                                      className="text-stone-400 hover:text-red-600 transition-colors p-1"
                                      title={perms.canDelete ? 'Excluir cotação' : 'Sem permissão'}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setHistoricoCotacao(c)}
                                    className="text-stone-400 hover:text-blue-600 transition-colors p-1"
                                    title="Histórico de modificações"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                </>
                              );
                            })()}
                          </div>
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
          currentUser={currentUser}
          isLogistica={canTratar}
          isAdmin={['admin', 'master'].includes(currentUser.role)}
          onClose={() => setPainelCotacao(null)}
          onUpdate={handleUpdate}
        />
      )}
      {/* Delete cotação confirmation dialog */}
      {excluindoCotacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-5 border-b border-stone-100">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Excluir Cotação</p>
                <p className="text-xs text-stone-400 mt-0.5">{excluindoCotacao.numero_cotacao}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-stone-600">
                Tem certeza que deseja excluir a cotação{' '}
                <strong>{excluindoCotacao.numero_cotacao}</strong>? Esta ação não pode ser desfeita.
              </p>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={motivoExclusaoCotacao}
                  onChange={(e) => setMotivoExclusaoCotacao(e.target.value)}
                  placeholder="Informe o motivo da exclusão..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setExcluindoCotacao(null);
                    setMotivoExclusaoCotacao('');
                  }}
                  disabled={excluindoLoading}
                  className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluirCotacao}
                  disabled={excluindoLoading || !motivoExclusaoCotacao.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  {excluindoLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit cotação modal */}
      {editandoCotacao && (
        <ModalEditarCotacao
          cotacao={editandoCotacao}
          filiais={filiais}
          onSave={handleEditarCotacao}
          onClose={() => setEditandoCotacao(null)}
          saving={editSaving}
        />
      )}

      {/* History modal for cotações */}
      {historicoCotacao && (
        <HistoricoModificacoes
          tabela="cotacoes_solicitadas"
          registroId={historicoCotacao.id}
          titulo={historicoCotacao.numero_cotacao}
          isOpen={!!historicoCotacao}
          onClose={() => setHistoricoCotacao(null)}
        />
      )}
    </div>
  );
}
