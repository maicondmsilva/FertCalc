import React, { useState } from 'react';
import { User } from '../../types';
import {
  Truck,
  Package,
  Calendar,
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  History,
} from 'lucide-react';
import { Carregamento, Filial, Transportadora, CotacaoFrete } from '../../types/carregamento';
import {
  getCotacoesCarregamento,
  getCotacoesArquivadas,
  arquivarCotacao,
} from '../../services/carregamentoService';
import { useToast } from '../Toast';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { ModalSolicitarCotacao } from './ModaisCotacaoLiberacao';
import { StatusBadge, ValidadeCotacaoBadge, fmtCarregamentoNum, fmtDate } from './shared';

export function SolicitacaoCotacao({
  carregamentos,
  transportadoras,
  loading,
  onSolicitarCotacao,
  currentUser,
  canVerArquivadas,
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
  currentUser?: User;
  canVerArquivadas?: boolean;
}) {
  const { showSuccess, showError } = useToast();
  const elegiveis = carregamentos.filter(
    (c) =>
      c.tipo_frete === 'CIF' &&
      ['aguardando_liberacao', 'liberado_total', 'liberado_parcial'].includes(c.status)
  );
  const emAndamento = carregamentos.filter((c) =>
    ['cotacao_solicitada', 'cotacao_recebida'].includes(c.status)
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalCarregamento, setModalCarregamento] = useState<Carregamento | null>(null);
  const [cotacoesPorCarregamento, setCotacoesPorCarregamento] = useState<
    Record<string, CotacaoFrete[]>
  >({});
  const [loadingCotacoes, setLoadingCotacoes] = useState<Record<string, boolean>>({});
  const [showArquivadas, setShowArquivadas] = useState<Record<string, boolean>>({});
  const [cotacoesArquivadas, setCotacoesArquivadas] = useState<Record<string, CotacaoFrete[]>>({});
  const [loadingArquivadas, setLoadingArquivadas] = useState<Record<string, boolean>>({});
  const [confirmArquivar, setConfirmArquivar] = useState<{
    cotacao: CotacaoFrete;
    carregamentoId: string;
  } | null>(null);
  const [arquivando, setArquivando] = useState(false);

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

  const toggleArquivadas = async (carregamentoId: string) => {
    const nowShowing = !showArquivadas[carregamentoId];
    setShowArquivadas((prev) => ({ ...prev, [carregamentoId]: nowShowing }));
    if (nowShowing && !cotacoesArquivadas[carregamentoId]) {
      setLoadingArquivadas((prev) => ({ ...prev, [carregamentoId]: true }));
      const data = await getCotacoesArquivadas(carregamentoId);
      setCotacoesArquivadas((prev) => ({ ...prev, [carregamentoId]: data }));
      setLoadingArquivadas((prev) => ({ ...prev, [carregamentoId]: false }));
    }
  };

  const handleArquivar = async () => {
    if (!confirmArquivar || !currentUser) return;
    setArquivando(true);
    try {
      await arquivarCotacao(confirmArquivar.cotacao.id, currentUser.id);
      // Refresh active cotações list
      const updated = await getCotacoesCarregamento(confirmArquivar.carregamentoId);
      setCotacoesPorCarregamento((prev) => ({
        ...prev,
        [confirmArquivar.carregamentoId]: updated,
      }));
      // Invalidate archived cache so it reloads next time
      setCotacoesArquivadas((prev) => {
        const next = { ...prev };
        delete next[confirmArquivar.carregamentoId];
        return next;
      });
      setShowArquivadas((prev) => ({ ...prev, [confirmArquivar.carregamentoId]: false }));
      showSuccess('Cotação arquivada com sucesso.');
    } catch {
      showError('Erro ao arquivar cotação.');
    } finally {
      setArquivando(false);
      setConfirmArquivar(null);
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
                              {cot.validade_cotacao && (
                                <ValidadeCotacaoBadge validade={cot.validade_cotacao} />
                              )}
                              {cot.observacoes && (
                                <p className="text-[10px] text-stone-400">{cot.observacoes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                  STATUS_COTACAO_COLOR[cot.status] ?? 'bg-stone-100 text-stone-500'
                                }`}
                              >
                                {cot.status}
                              </span>
                              <button
                                onClick={() =>
                                  setConfirmArquivar({ cotacao: cot, carregamentoId: c.id })
                                }
                                title="Arquivar cotação"
                                className="p-1 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Cotações Arquivadas */}
                        {canVerArquivadas && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleArquivadas(c.id)}
                              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 font-medium"
                            >
                              {showArquivadas[c.id] ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              Cotações Arquivadas
                              {cotacoesArquivadas[c.id]?.length
                                ? ` (${cotacoesArquivadas[c.id].length})`
                                : ''}
                            </button>
                            {showArquivadas[c.id] && (
                              <div className="mt-2 space-y-1 pl-2 border-l-2 border-stone-200">
                                {loadingArquivadas[c.id] ? (
                                  <div className="flex justify-center py-2">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-300" />
                                  </div>
                                ) : (cotacoesArquivadas[c.id] ?? []).length === 0 ? (
                                  <p className="text-[10px] text-stone-400">
                                    Nenhuma cotação arquivada.
                                  </p>
                                ) : (
                                  (cotacoesArquivadas[c.id] ?? []).map((cot) => (
                                    <div
                                      key={cot.id}
                                      className="flex items-center justify-between p-2 bg-stone-50 border border-stone-100 rounded-lg opacity-70"
                                    >
                                      <div>
                                        <p className="text-xs font-bold text-stone-600">
                                          {cot.transportadora?.nome ?? '—'}
                                        </p>
                                        {cot.arquivada_em && (
                                          <p className="text-[10px] text-stone-400">
                                            Arquivada em:{' '}
                                            {new Date(cot.arquivada_em).toLocaleDateString('pt-BR')}
                                          </p>
                                        )}
                                      </div>
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                          STATUS_COTACAO_COLOR[cot.status] ??
                                          'bg-stone-100 text-stone-500'
                                        }`}
                                      >
                                        {cot.status}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
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

      {/* Confirmation: archive cotação */}
      {confirmArquivar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) =>
            closeModalOnBackdrop(event, () => setConfirmArquivar(null), arquivando)
          }
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-stone-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <History className="w-5 h-5 text-amber-600" />
              </div>
              <p className="font-bold text-stone-800">Arquivar Cotação</p>
            </div>
            <div className="p-5">
              <p className="text-sm text-stone-600">
                Arquivar esta cotação?{' '}
                <span className="text-stone-500">
                  Ela ficará disponível em &quot;Cotações Arquivadas&quot;.
                </span>
              </p>
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setConfirmArquivar(null)}
                  disabled={arquivando}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleArquivar}
                  disabled={arquivando}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  {arquivando ? 'Arquivando...' : 'Arquivar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Liberação de Carregamento
// ─────────────────────────────────────────────────────────────────────────────
