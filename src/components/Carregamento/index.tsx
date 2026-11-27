import React, { useState, useEffect, useCallback } from 'react';
import { PedidoVenda, Client } from '../../types';
import { Truck, AlertTriangle, RefreshCw, Plus, History } from 'lucide-react';
import {
  Carregamento,
  Filial,
  Transportadora,
  KPICarregamento,
  AlertaCarregamento,
} from '../../types/carregamento';
import {
  getCarregamentos,
  createCarregamento,
  updateCarregamento,
  deleteCarregamento,
  updateStatusCarregamento,
  getFiliais,
  getTransportadoras,
  createCotacao,
  aprovarCotacaoFrete,
  liberarCarregamento,
  getKPICarregamento,
  getAlertasCarregamento,
  marcarAlertaLido,
  getCarregamentosLogistica,
} from '../../services/carregamentoService';
import { registrarAuditLog } from '../../services/auditLogService';
import {
  notifyCarregamentoExcluido,
  notifyCarregamentoEditado,
} from '../../services/notificationService';
import { getClients } from '../../services/db';
import { getPedidosVenda } from '../../services/pedidosVendaService';
import { useToast } from '../Toast';
import SolicitacaoCotacaoIndependente from './SolicitacaoCotacao';
import HistoricoModificacoes from '../HistoricoModificacoes';
import PainelExecucoes from './PainelExecucoes';
import { cancelarSaldoCarregamento } from '../../services/execucaoCarregamentoService';
import { getStatusInicial } from '../../utils/getStatusInicial';
import { subscribeToOrderLoadingChanges } from '../../services/orderLoadingSubscription';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { CalendarioCarregamentos } from './CalendarioCarregamentos';
import { LiberacaoCarregamento, PainelLogistica } from './LiberacaoLogistica';
import { ModalCotacao, ModalLiberacao } from './ModaisCotacaoLiberacao';
import {
  DadosCancelamento,
  ModalCancelarCarregamento,
  ModalInformarTransportador,
} from './ModaisOperacao';
import { ModalNovoCarregamento } from './ModalNovoCarregamento';
import { RelatoriosCarregamento } from './RelatoriosCarregamento';
import { TransportadoraManager } from './TransportadoraManager';
import { VisaoGeral } from './VisaoGeral';
import { useMyRegions } from '../../hooks/useMyRegions';
import {
  CarregamentoFormData,
  CarregamentoModuleProps,
  CarregamentoView,
  CotacaoFormData,
  STATUS_LABEL,
  fmtCarregamentoNum,
} from './shared';

export default function CarregamentoModule({
  currentUser,
  view = 'visao_geral',
}: CarregamentoModuleProps) {
  const { showSuccess, showError } = useToast();
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [carregamentosLogistica, setCarregamentosLogistica] = useState<Carregamento[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const { all: regioesCarregamento } = useMyRegions(currentUser);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [kpi, setKpi] = useState<KPICarregamento>({
    aguardando_cotacao: 0,
    em_carregamento: 0,
    carregados_hoje: 0,
    valor_frete_mes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<AlertaCarregamento[]>([]);

  // Modals
  const [showModalNovo, setShowModalNovo] = useState(false);
  const [modalCotacao, setModalCotacao] = useState<Carregamento | null>(null);
  const [modalLiberacao, setModalLiberacao] = useState<Carregamento | null>(null);
  const [modalTransportador, setModalTransportador] = useState<Carregamento | null>(null);
  const [modalExecucoes, setModalExecucoes] = useState<Carregamento | null>(null);
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

  const canAceitarCotacao =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    !!(currentUser.permissions as any)?.carregamento_aprovar_cotacao;

  const canAceitarCarregamento =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    !!(currentUser.permissions as any)?.carregamento_liberar;

  const canLiberarCarregamento =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    !!(currentUser.permissions as any)?.carregamento_liberar;

  const canVerArquivadas =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    !!(currentUser.permissions as any)?.carregamento_ver_arquivadas ||
    !!(currentUser.permissions as any)?.carregamento_admin;

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
      const results = await Promise.allSettled([
        getCarregamentos(undefined, filtroPorFiliais),
        getCarregamentosLogistica(filtroPorFiliais ?? undefined),
        getFiliais(),
        getTransportadoras(),
        getKPICarregamento(),
        getClients(),
        getPedidosVenda(),
        getAlertasCarregamento(currentUser.id),
      ]);
      const labels = [
        'visão geral',
        'painel de logística',
        'filiais',
        'transportadoras',
        'indicadores',
        'clientes',
        'pedidos',
        'alertas',
      ];
      const failures = results
        .map((result, index) => (result.status === 'rejected' ? labels[index] : null))
        .filter((label): label is string => Boolean(label));

      if (results[0].status === 'fulfilled') setCarregamentos(results[0].value);
      if (results[1].status === 'fulfilled') setCarregamentosLogistica(results[1].value);
      if (results[2].status === 'fulfilled') setFiliais(results[2].value);
      if (results[3].status === 'fulfilled') setTransportadoras(results[3].value);
      if (results[4].status === 'fulfilled') setKpi(results[4].value);
      if (results[5].status === 'fulfilled') setClients(results[5].value);
      if (results[6].status === 'fulfilled') setPedidos(results[6].value);
      if (results[7].status === 'fulfilled') setAlertas(results[7].value);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[carregamento] falha ao carregar ${labels[index]}:`, result.reason);
        }
      });

      if (failures.length > 0) {
        setLoadError(
          `Algumas informações não puderam ser carregadas: ${failures.join(', ')}. Tente novamente.`
        );
      }
    } catch (err) {
      console.error('Erro ao carregar dados de carregamento:', err);
      setLoadError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [currentUser.filiais_permitidas, currentUser.id, currentUser.permissions, currentUser.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToOrderLoadingChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 350);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
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
      } else if (action === 'execucoes') {
        setModalExecucoes(c);
      }
    },
    [load]
  );

  // ── Create carregamento ───────────────────────────────────────────────────
  const handleCreateCarregamento = async (form: CarregamentoFormData) => {
    try {
      // Validações robustas
      const qtdTotal = parseFloat(form.quantidade_total);
      if (isNaN(qtdTotal) || qtdTotal <= 0) {
        showError('Quantidade total inválida. Informe um valor maior que zero.');
        return;
      }

      if (!form.tipo_frete || !['CIF', 'FOB'].includes(form.tipo_frete)) {
        showError('Tipo de frete inválido. Selecione CIF ou FOB.');
        return;
      }

      if (form.itens && form.itens.length > 0) {
        const totalItens = form.itens.reduce((sum, item) => sum + (item.quantidade_ton || 0), 0);
        if (Math.abs(totalItens - qtdTotal) > 0.001) {
          showError(
            `A soma dos itens (${totalItens.toFixed(3)} ton) não coincide com a quantidade total (${qtdTotal.toFixed(3)} ton).`
          );
          return;
        }

        const itensInvalidos = form.itens.filter((i) => !i.produto_nome || i.quantidade_ton <= 0);
        if (itensInvalidos.length > 0) {
          showError('Todos os itens devem ter produto e quantidade válidos.');
          return;
        }
      }

      const statusInicial = getStatusInicial(form.tipo_frete);
      await createCarregamento(
        {
          tipo_frete: form.tipo_frete,
          quantidade_total: qtdTotal,
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
          status: statusInicial,
          criado_por: currentUser.id,
        },
        form.itens,
        form.request_id
      );
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

  const handleMarcarAlertaLido = async (alerta: AlertaCarregamento) => {
    try {
      await marcarAlertaLido(alerta.id);
      setAlertas((atuais) => atuais.filter((item) => item.id !== alerta.id));
    } catch {
      showError('Não foi possível atualizar o alerta.');
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
      showSuccess('Cotação solicitada com sucesso!');
      setModalCotacao(null);
      await load();
    } catch {
      showError('Erro ao solicitar cotação.');
    }
  };

  const handleAprovarCotacao = async (cotacaoId: string) => {
    try {
      await aprovarCotacaoFrete(cotacaoId);
      showSuccess('Proposta aprovada e frete aplicado ao carregamento.');
      setModalCotacao(null);
      await load();
    } catch (error) {
      console.error(error);
      showError('Não foi possível aprovar a proposta. Verifique a validade e tente novamente.');
      throw error;
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
      await deleteCarregamento(snapshot.id, motivoExclusao.trim());
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
    try {
      const restante = Math.max(
        0,
        carregamento.quantidade_total - (carregamento.quantidade_cancelada || 0)
      );
      await cancelarSaldoCarregamento(
        carregamento.id,
        dados.tipo === 'total' ? restante : dados.quantidadeCancelada,
        dados.motivo
      );
      showSuccess('Cancelamento registrado. O saldo livre foi devolvido ao pedido.');
      setCarregamentoParaCancelar(null);
      await load();
    } catch (err) {
      showError(
        'Não foi possível cancelar. Verifique o saldo, os veículos reservados e sua permissão.'
      );
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
    try {
      await liberarCarregamento(carregamentoId, tipo, quantidade);
      showSuccess(
        tipo === 'total'
          ? 'Carregamento liberado integralmente.'
          : 'Liberação parcial registrada com sucesso.'
      );
      setModalLiberacao(null);
      await load();
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Não foi possível liberar o carregamento.';
      showError(message);
      throw error;
    }
  };

  // ── Informar transportador ────────────────────────────────────────────────
  const handleInformarTransportador = async (transportadoraId: string, valorFrete?: number) => {
    if (!modalTransportador) return;
    try {
      await updateCarregamento(modalTransportador.id, {
        transportadora_id: transportadoraId,
        valor_frete: valorFrete,
      });
      setModalTransportador(null);
      await load();
    } catch {
      showError('Não foi possível salvar a transportadora.');
    }
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
          canLiberar={canLiberarCarregamento}
          canAceitar={canAceitarCarregamento}
          clients={clients}
          pedidos={pedidos}
          alertas={alertas}
          onMarcarAlertaLido={handleMarcarAlertaLido}
        />
      )}
      {view === 'solicitacao' && <SolicitacaoCotacaoIndependente currentUser={currentUser} />}
      {view === 'liberacao' && (
        <LiberacaoCarregamento
          carregamentos={carregamentos}
          loading={loading}
          onAction={handleAction}
          canLiberar={canLiberarCarregamento}
          clients={clients}
          pedidos={pedidos}
        />
      )}
      {view === 'logistica' && (
        <PainelLogistica
          carregamentos={carregamentosLogistica}
          loading={loading}
          onAction={handleAction}
          canAceitar={canAceitarCarregamento}
          currentUser={currentUser}
          onUpdateStatus={async (_carregamentoId, newStatus) => {
            showError(
              `A alteração manual para "${STATUS_LABEL[newStatus]}" foi bloqueada. Use as ações de Execuções para manter volumes e histórico corretos.`
            );
          }}
        />
      )}
      {view === 'calendario' && <CalendarioCarregamentos currentUser={currentUser} />}
      {view === 'relatorios' && (
        <RelatoriosCarregamento
          filiais={filiais}
          transportadoras={transportadoras}
          regioes={regioesCarregamento}
        />
      )}
      {view === 'transportadoras' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
          <TransportadoraManager currentUser={currentUser} />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) =>
            closeModalOnBackdrop(
              event,
              () => {
                setExcluindoCarregamento(null);
                setMotivoExclusao('');
              },
              excluindoLoading
            )
          }
        >
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
          canAprovar={canAceitarCotacao}
          onAprovar={handleAprovarCotacao}
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

      {modalExecucoes && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(event) => closeModalOnBackdrop(event, () => setModalExecucoes(null))}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">
                Execuções — {fmtCarregamentoNum(modalExecucoes)}
              </h3>
              <button
                onClick={() => setModalExecucoes(null)}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-sm font-bold text-stone-600 hover:bg-stone-50"
              >
                Fechar
              </button>
            </div>
            <PainelExecucoes
              carregamento={modalExecucoes}
              currentUserId={currentUser.id}
              canManage={
                currentUser.role === 'master' ||
                currentUser.role === 'admin' ||
                !!(currentUser.permissions as Record<string, unknown>)?.carregamento_logistica
              }
              onChanged={load}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { ModalNovoCarregamento } from './ModalNovoCarregamento';
export type { CarregamentoFormData, ModalNovoCarregamentoProps } from './shared';
