import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { PricingRecord, Goal, User as AppUser, AppSettings } from '../types';
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  Clock,
  Shield,
  Target,
  Eye,
  TriangleAlert as AlertTriangle,
  X,
} from 'lucide-react';
import PricingDetailModal from './PricingDetailModal';
import NovoPedidoVendaModal from './NovoPedidoVendaModal';
import {
  getPricingRecords,
  getGoals,
  getAppSettings,
  updatePricingRecord,
  updateGoal,
  createNotification,
  getUsers,
} from '../services/db';
import { logAudit } from '../services/auditService';
import { processPricingApproval as persistPricingApproval } from '../services/approvalService';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { closeModalOnBackdrop } from '../utils/modalUtils';
import { formatDatePtBr, getPricingDueDate } from '../utils/pricingDisplay';
import { formatPricingMoney, getPricingCurrency } from '../utils/pricingCurrency';
import { getPricingGuaranteeAuthorizationSummary } from '../utils/guaranteeAuthorization';
import {
  decideGuaranteeAuthorizationRequest,
  getGuaranteeAuthorizationRequests,
  type GuaranteeAuthorizationRequest,
} from '../services/guaranteeAuthorizationRequestService';

interface ApprovalsProps {
  currentUser: AppUser;
}

export default function Approvals({ currentUser }: ApprovalsProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [activeTab, setActiveTab] = useState<
    'pricings' | 'guarantees' | 'goals' | 'deletions'
  >('pricings');
  const [allPricings, setAllPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [novoPedidoPricing, setNovoPedidoPricing] = useState<PricingRecord | null>(null);
  const [guaranteeRequests, setGuaranteeRequests] = useState<GuaranteeAuthorizationRequest[]>([]);
  const [reviewingGuaranteeRequest, setReviewingGuaranteeRequest] = useState<{
    request: GuaranteeAuthorizationRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [guaranteeReviewReason, setGuaranteeReviewReason] = useState('');
  const [savingGuaranteeReview, setSavingGuaranteeReview] = useState(false);

  // Modal de reprovação de precificação
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingRejectionId, setPendingRejectionId] = useState<string | null>(null);

  // Modal de reprovação de exclusão
  const [showDeletionRejectionModal, setShowDeletionRejectionModal] = useState(false);
  const [deletionRejectionReason, setDeletionRejectionReason] = useState('');
  const [pendingDeletionRejectionId, setPendingDeletionRejectionId] = useState<string | null>(null);

  // Verificar permissões de aprovação
  const canApproveTotal =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    (currentUser.permissions as any)?.approvals_canApprove === true;
  const canApprove = canApproveTotal || currentUser.role === 'manager';
  const canReviewGuarantees =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    (currentUser.permissions as any)?.calculator_overrideGuaranteeDivergence === true;

  const loadData = async () => {
    setAllPricings([]);
    setGoals([]);
    const [fetchedPricings, allGoals, settings, pendingGuaranteeRequests] = await Promise.all([
      getPricingRecords(),
      getGoals(),
      getAppSettings(),
      canReviewGuarantees ? getGuaranteeAuthorizationRequests('pending') : Promise.resolve([]),
    ]);
    if (settings) setAppSettings(settings);

    let filteredPricings: PricingRecord[] = [];
    let filteredGoals: Goal[] = [];

    const managedIds = currentUser.managedUserIds || [];
    if (canApproveTotal) {
      filteredPricings = fetchedPricings;
      filteredGoals = allGoals.filter((g) => g.status === 'Pendente');
    } else if (currentUser.role === 'manager') {
      filteredPricings = fetchedPricings.filter(
        (p) => p.userId === currentUser.id || managedIds.includes(p.userId)
      );
      filteredGoals = allGoals.filter(
        (g) =>
          (g.userId === currentUser.id || managedIds.includes(g.userId)) && g.status === 'Pendente'
      );
    } else {
      filteredPricings = fetchedPricings.filter((p) => p.userId === currentUser.id);
      filteredGoals = allGoals.filter(
        (g) => g.userId === currentUser.id && g.status === 'Pendente'
      );
    }
    setAllPricings(filteredPricings);
    setGoals(filteredGoals);
    setGuaranteeRequests(pendingGuaranteeRequests);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const pendingPricings = allPricings.filter(
    (p) => p.approvalStatus === 'Pendente' && p.status !== 'Excluída'
  );
  const pendingDeletionRequests = allPricings.filter(
    (p) => p.deletionRequest?.status === 'Pendente'
  );

  // Inicia o fluxo de reprovação (abre modal)
  const initiateRejection = (id: string) => {
    setPendingRejectionId(id);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handlePricingApproval = async (id: string, newStatus: 'Aprovada' | 'Reprovada') => {
    if (newStatus === 'Reprovada') {
      initiateRejection(id);
      return;
    }
    const ok = await confirm({
      title: 'Aprovar precificação?',
      message: 'Deseja realmente aprovar esta precificação?',
      variant: 'info',
      confirmLabel: 'Aprovar',
    });
    if (!ok) return;
    await processPricingApproval(id, 'Aprovada', '');
  };

  const confirmRejection = async () => {
    if (!rejectionReason.trim()) {
      showError('É obrigatório informar o motivo da reprovação.');
      return;
    }
    if (!pendingRejectionId) return;
    await processPricingApproval(pendingRejectionId, 'Reprovada', rejectionReason);
    setShowRejectionModal(false);
    setRejectionReason('');
    setPendingRejectionId(null);
  };

  const processPricingApproval = async (
    id: string,
    newStatus: 'Aprovada' | 'Reprovada',
    reason: string
  ) => {
    const pricing = allPricings.find((p) => p.id === id);
    if (!pricing) return;

    try {
      const historyEntry = await persistPricingApproval({
        pricing,
        status: newStatus,
        reason,
        approver: currentUser,
      });

      setAllPricings((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, approvalStatus: newStatus, history: [...(p.history || []), historyEntry] }
            : p
        )
      );
      if (selectedPricing?.id === id) setSelectedPricing(null);
      showSuccess(`Precificação ${newStatus.toLowerCase()} com sucesso!`);
      loadData(); // Refresh to ensure sync
    } catch {
      showError('Erro ao processar aprovação.');
    }
  };

  const initiateDeletionRejection = (id: string) => {
    setPendingDeletionRejectionId(id);
    setDeletionRejectionReason('');
    setShowDeletionRejectionModal(true);
  };

  const handlePricingDeletionApproval = async (id: string, newStatus: 'Aprovada' | 'Reprovada') => {
    if (newStatus === 'Reprovada') {
      initiateDeletionRejection(id);
      return;
    }
    const okDel = await confirm({
      title: 'Aprovar exclusão?',
      message: 'Deseja realmente aprovar a exclusão desta precificação?',
      variant: 'danger',
      confirmLabel: 'Aprovar Exclusão',
    });
    if (!okDel) return;
    await processDeletionApproval(id, 'Aprovada', '');
  };

  const confirmDeletionRejection = async () => {
    if (!deletionRejectionReason.trim()) {
      showError('É obrigatório informar o motivo da reprovação da exclusão.');
      return;
    }
    if (!pendingDeletionRejectionId) return;
    await processDeletionApproval(pendingDeletionRejectionId, 'Reprovada', deletionRejectionReason);
    setShowDeletionRejectionModal(false);
    setDeletionRejectionReason('');
    setPendingDeletionRejectionId(null);
  };

  const processDeletionApproval = async (
    id: string,
    newStatus: 'Aprovada' | 'Reprovada',
    reason: string
  ) => {
    const pricing = allPricings.find((p) => p.id === id);
    if (!pricing || !pricing.deletionRequest) {
      showError('Ocorreu um erro: registro de exclusão não encontrado.');
      return;
    }

    const historyEntry = {
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: `Solicitação de exclusão ${newStatus}${newStatus === 'Reprovada' ? `: ${reason}` : ''}`,
    };

    try {
      const updatedDeletionRequest = {
        ...pricing.deletionRequest,
        status: newStatus,
        approverName: currentUser.name,
        approverDate: new Date().toISOString(),
        date: new Date().toISOString(),
      };

      await updatePricingRecord(id, {
        deletionRequest: updatedDeletionRequest,
        status: newStatus === 'Aprovada' ? 'Excluída' : pricing.status,
        history: [...(pricing.history || []), historyEntry],
      } as any);

      try {
        await createNotification({
          userId: pricing.userId,
          title: `Solicitação de Exclusão ${newStatus === 'Aprovada' ? 'Aprovada' : 'Reprovada'}`,
          message: `Sua solicitação de exclusão para a precificação ${pricing.formattedCod || ''} de ${pricing.factors?.client?.name || 'Cliente'} foi ${newStatus.toLowerCase()}.${newStatus === 'Reprovada' ? ` Motivo: ${reason}` : ''}`,
          date: new Date().toISOString(),
          read: false,
          type: 'pricing_approval',
        });
      } catch (notifyErr) {
        logger.warn('Falha ao enviar notificação:', notifyErr);
      }

      await logAudit({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action:
          newStatus === 'Aprovada' ? 'pricing.deletion_approved' : 'pricing.deletion_rejected',
        entity_type: 'pricing_record',
        entity_id: id,
        metadata: {
          client: pricing.factors?.client?.name,
          formattedCod: pricing.formattedCod,
          reason: newStatus === 'Reprovada' ? reason : undefined,
        },
      });

      const updatedPricings = allPricings.map((p) =>
        p.id === id
          ? {
              ...p,
              deletionRequest: updatedDeletionRequest,
              status: newStatus === 'Aprovada' ? 'Excluída' : p.status,
              history: [...(p.history || []), historyEntry],
            }
          : p
      );

      setAllPricings(updatedPricings);
      showSuccess(`Solicitação de exclusão ${newStatus.toLowerCase()} com sucesso!`);
      loadData(); // Refresh to ensure sync
    } catch (err: unknown) {
      console.error('Erro ao processar aprovação da exclusão:', err);
      showError(
        `Erro ao processar aprovação da exclusão: ${err instanceof Error ? err.message : 'Erro no servidor'}`
      );
    }
  };

  const handleGoalApproval = async (id: string, newStatus: 'Aprovada' | 'Reprovada') => {
    const okGoal = await confirm({
      title: `${newStatus} meta?`,
      message: `Deseja realmente ${newStatus.toLowerCase()} esta meta?`,
      variant: newStatus === 'Aprovada' ? 'info' : 'danger',
      confirmLabel: newStatus,
    });
    if (!okGoal) return;
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    try {
      await updateGoal(id, { status: newStatus });
      await createNotification({
        userId: goal.userId,
        title: `Meta ${newStatus.toLowerCase()}`,
        message: `Sua meta de ${goal.type === 'monthly' ? `Mês ${goal.month}/${goal.year}` : `Ano ${goal.year}`} foi ${newStatus.toLowerCase()}.`,
        date: new Date().toISOString(),
        read: false,
        type: 'goal_approval',
      });
      await logAudit({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: newStatus === 'Aprovada' ? 'goal.approved' : 'goal.rejected',
        entity_type: 'goal',
        entity_id: id,
        metadata: {
          userId: goal.userId,
          type: goal.type,
          month: goal.month,
          year: goal.year,
        },
      });
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showSuccess(`Meta ${newStatus.toLowerCase()} com sucesso!`);
    } catch {
      showError('Erro ao processar aprovação da meta.');
    }
  };

  const openGuaranteeReview = (
    request: GuaranteeAuthorizationRequest,
    decision: 'approved' | 'rejected'
  ) => {
    setGuaranteeReviewReason('');
    setReviewingGuaranteeRequest({ request, decision });
  };

  const submitGuaranteeReview = async () => {
    if (!reviewingGuaranteeRequest || !guaranteeReviewReason.trim()) {
      showError('Informe a justificativa da decisão.');
      return;
    }
    setSavingGuaranteeReview(true);
    try {
      const reviewed = await decideGuaranteeAuthorizationRequest(
        reviewingGuaranteeRequest.request.id,
        reviewingGuaranteeRequest.decision,
        guaranteeReviewReason
      );
      await createNotification({
        userId: reviewed.requesterId,
        title:
          reviewed.status === 'approved'
            ? 'Garantias autorizadas ✅'
            : 'Autorização de garantias rejeitada',
        message:
          reviewed.status === 'approved'
            ? `${currentUser.name} autorizou a composição para ${reviewed.clientName || 'o cliente informado'}.`
            : `${currentUser.name} rejeitou a solicitação. Motivo: ${reviewed.reviewReason}`,
        date: new Date().toISOString(),
        read: false,
        type: 'pricing_approval',
        dataId: reviewed.id,
      });
      setGuaranteeRequests((previous) =>
        previous.filter((request) => request.id !== reviewed.id)
      );
      setReviewingGuaranteeRequest(null);
      setGuaranteeReviewReason('');
      showSuccess(
        reviewed.status === 'approved'
          ? 'Garantias autorizadas com sucesso.'
          : 'Solicitação rejeitada com sucesso.'
      );
    } catch (error) {
      logger.error('Erro ao revisar autorização de garantias:', error);
      showError('Não foi possível concluir a decisão. Atualize a página e tente novamente.');
    } finally {
      setSavingGuaranteeReview(false);
    }
  };

  if (
    currentUser.role !== 'master' &&
    currentUser.role !== 'admin' &&
    currentUser.role !== 'manager' &&
    !(currentUser.permissions as any)?.approvals &&
    !canReviewGuarantees
  ) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 text-center">
        <Shield className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-stone-800">Acesso Restrito</h2>
        <p className="text-stone-600">
          Esta área é destinada apenas para gerentes e administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <h1 className="text-3xl font-bold text-stone-800">Central de Aprovações</h1>

      {!canApprove && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Você tem acesso de visualização apenas. Seu perfil não possui permissão para aprovar ou
            reprovar precificações.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('pricings')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pricings' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
        >
          Precificações ({pendingPricings.length})
        </button>
        {canReviewGuarantees && (
          <button
            onClick={() => setActiveTab('guarantees')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'guarantees' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
          >
            Garantias ({guaranteeRequests.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'goals' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
        >
          Metas ({goals.length})
        </button>
        <button
          onClick={() => setActiveTab('deletions')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'deletions' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
        >
          Exclusões ({pendingDeletionRequests.length})
        </button>
      </div>

      {activeTab === 'guarantees' && canReviewGuarantees && (
        <div className="space-y-4">
          {guaranteeRequests.length > 0 ? (
            guaranteeRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h3 className="font-black text-stone-800">
                        {request.clientName || 'Cliente não informado'}
                      </h3>
                      <span className="rounded bg-white px-2 py-1 text-[10px] font-bold uppercase text-amber-700">
                        {request.divergences.length} divergência(s)
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Solicitado por <strong>{request.requesterName}</strong> em{' '}
                      {new Date(request.createdAt).toLocaleString('pt-BR')}
                    </p>
                    <div className="mt-3 rounded-lg border border-amber-100 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-stone-400">Motivo</p>
                      <p className="mt-1 text-sm text-stone-700">{request.requestReason}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.divergences.map((divergence, index) => (
                        <span
                          key={`${divergence.formulaId}-${divergence.nutrient}-${index}`}
                          className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-amber-800"
                        >
                          {divergence.formula} · {divergence.nutrient}:{' '}
                          {Number(divergence.calculated).toFixed(2)}% · alvo{' '}
                          {Number(divergence.target).toFixed(2)}%
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => openGuaranteeReview(request, 'approved')}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Autorizar
                    </button>
                    <button
                      onClick={() => openGuaranteeReview(request, 'rejected')}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed bg-white p-6 text-center text-stone-500">
              Nenhuma autorização de garantias pendente.
            </p>
          )}
        </div>
      )}

      {activeTab === 'pricings' && (
        <div className="space-y-4">
          {pendingPricings.length > 0 ? (
            pendingPricings.map((p) => (
              <div
                key={p.id}
                className="p-4 border border-stone-200 rounded-lg flex justify-between items-center bg-stone-50"
              >
                <div>
                  <p className="font-bold text-stone-700">{p.factors.client.name}</p>
                  <p className="text-xs text-stone-500">
                    Solicitado por: {p.userName} | Vendedor: @{p.userCode}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">Status: {p.status}</p>
                  {getPricingGuaranteeAuthorizationSummary(p).hasAuthorizedDivergence && (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900">
                      <div className="flex items-center gap-1 font-bold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Divergência autorizada ·{' '}
                        {getPricingGuaranteeAuthorizationSummary(p).divergenceCount} garantia(s)
                      </div>
                      <p className="mt-1">
                        Por{' '}
                        <strong>
                          {getPricingGuaranteeAuthorizationSummary(p).latestAuthorization
                            ?.authorizedByUserName || 'Usuário não identificado'}
                        </strong>
                        {' · '}
                        {getPricingGuaranteeAuthorizationSummary(p).latestAuthorization?.authorizedAt
                          ? new Date(
                              getPricingGuaranteeAuthorizationSummary(p).latestAuthorization!
                                .authorizedAt
                            ).toLocaleString('pt-BR')
                          : 'Data não informada'}
                        {' · '}
                        {getPricingGuaranteeAuthorizationSummary(p).latestAuthorization?.justification}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-stone-500 mt-1">
                    Emissão: {formatDatePtBr(p.date)}
                    <br />
                    Vencimento: {formatDatePtBr(getPricingDueDate(p))}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <p className="text-xs text-stone-500 flex items-center gap-1">
                      🚚{' '}
                      {(() => {
                        const tipoFrete =
                          p.factors?.tipoFrete ?? ((p.factors?.freight || 0) > 0 ? 'CIF' : 'FOB');
                        if (tipoFrete === 'FOB') return 'FOB';
                        const pricingCurrency = getPricingCurrency(p.summary, p.factors);
                        const freightStr = `CIF · ${formatPricingMoney(p.factors?.freight || 0, pricingCurrency)}/t`;
                        if (p.factors?.cotacaoFreteNumero)
                          return `${freightStr} · ${p.factors.cotacaoFreteNumero}`;
                        return freightStr;
                      })()}
                    </p>
                    {p.factors?.embalagem_nome && (
                      <p className="text-xs text-stone-500 flex items-center gap-1">
                        📦 {p.factors.embalagem_nome}
                        {p.factors.embalagem_valor != null && p.factors.embalagem_valor !== 0 && (
                          <span
                            className={`font-bold ${(p.factors.embalagem_valor || 0) > 0 ? 'text-orange-600' : 'text-blue-600'}`}
                          >
                            {' '}
                            {(p.factors.embalagem_valor || 0) > 0
                              ? `+${formatPricingMoney(p.factors.embalagem_valor || 0, getPricingCurrency(p.summary, p.factors))}/t`
                              : `-${formatPricingMoney(Math.abs(p.factors.embalagem_valor || 0), getPricingCurrency(p.summary, p.factors))}/t`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPricing(p)}
                    className="p-2 text-stone-500 hover:bg-stone-200 rounded-full"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNovoPedidoPricing(p);
                      setShowNovoPedido(true);
                    }}
                    className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full"
                    title="Novo Pedido de Venda"
                  >
                    📋
                  </button>
                  {canApprove && (
                    <>
                      <button
                        onClick={() => handlePricingApproval(p.id, 'Aprovada')}
                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handlePricingApproval(p.id, 'Reprovada')}
                        className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                      >
                        Reprovar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-stone-500 p-6 text-center bg-white rounded-xl border border-dashed">
              Nenhuma precificação pendente.
            </p>
          )}
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="space-y-4">
          {goals.length > 0 ? (
            goals.map((g) => (
              <div
                key={g.id}
                className="p-4 border border-stone-200 rounded-lg flex justify-between items-center bg-stone-50"
              >
                <div>
                  <p className="font-bold text-stone-700">
                    {g.userName} -{' '}
                    {g.type === 'monthly' ? `Mês ${g.month}/${g.year}` : `Ano ${g.year}`}
                  </p>
                  <p className="text-sm text-stone-500">Meta: {g.targetValue} toneladas</p>
                </div>
                {canApprove && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGoalApproval(g.id, 'Aprovada')}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleGoalApproval(g.id, 'Reprovada')}
                      className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                    >
                      Reprovar
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-stone-500 p-6 text-center bg-white rounded-xl border border-dashed">
              Nenhuma meta pendente.
            </p>
          )}
        </div>
      )}

      {activeTab === 'deletions' && (
        <div className="space-y-4">
          {pendingDeletionRequests.length > 0 ? (
            pendingDeletionRequests.map((p) => (
              <div key={p.id} className="p-6 rounded-xl border border-red-200 bg-red-50/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Solicitação de Exclusão: {p.formattedCod}
                    </h3>
                    <div className="mt-2 p-3 bg-white border border-red-100 rounded-lg">
                      <p className="text-xs font-bold text-red-700 uppercase mb-1">Motivo:</p>
                      <p className="text-sm text-stone-600 italic">
                        " {p.deletionRequest?.reason} "
                      </p>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-2 uppercase font-bold">
                      Solicitado por: {p.deletionRequest?.userName} em{' '}
                      {new Date(p.deletionRequest?.date || '').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {canApprove && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePricingDeletionApproval(p.id, 'Aprovada')}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm border border-emerald-500/20 flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Aprovar Exclusão
                      </button>
                      <button
                        onClick={() => handlePricingDeletionApproval(p.id, 'Reprovada')}
                        className="px-4 py-2 bg-stone-100 text-stone-600 text-xs font-bold rounded-lg hover:bg-stone-200 border border-stone-200 shadow-sm transition-all active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeitar Pedido
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-stone-500 p-6 text-center bg-white rounded-xl border border-dashed">
              Nenhuma solicitação de exclusão pendente.
            </p>
          )}
        </div>
      )}

      {selectedPricing && (
        <PricingDetailModal
          selectedPricing={selectedPricing}
          currentUser={currentUser}
          onClose={() => setSelectedPricing(null)}
          onUpdateApproval={handlePricingApproval}
          appSettings={appSettings}
        />
      )}

      {reviewingGuaranteeRequest && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) =>
            closeModalOnBackdrop(event, () => setReviewingGuaranteeRequest(null))
          }
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 p-6">
              <h3
                className={`text-lg font-black ${reviewingGuaranteeRequest.decision === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {reviewingGuaranteeRequest.decision === 'approved'
                  ? 'Autorizar garantias'
                  : 'Rejeitar solicitação'}
              </h3>
              <button
                onClick={() => setReviewingGuaranteeRequest(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-stone-600">
                Registre a justificativa da decisão. Ela ficará disponível para o solicitante e na
                auditoria administrativa.
              </p>
              <textarea
                value={guaranteeReviewReason}
                onChange={(event) => setGuaranteeReviewReason(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Justificativa obrigatória"
                className="w-full rounded-xl border border-stone-300 p-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setReviewingGuaranteeRequest(null)}
                  disabled={savingGuaranteeReview}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void submitGuaranteeReview()}
                  disabled={savingGuaranteeReview || !guaranteeReviewReason.trim()}
                  className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${reviewingGuaranteeRequest.decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {savingGuaranteeReview ? 'Salvando...' : 'Confirmar decisão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reprovação de Precificação */}
      {showRejectionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onMouseDown={(event) => closeModalOnBackdrop(event, () => setShowRejectionModal(false))}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-red-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Reprovar Precificação
              </h3>
              <button
                onClick={() => setShowRejectionModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-600 mb-4">
                Informe o motivo da reprovação. Este motivo será registrado no histórico e
                notificado ao vendedor.
              </p>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">
                Motivo da Reprovação *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Descreva o motivo pelo qual esta precificação foi reprovada..."
                className="w-full p-4 bg-stone-50 border-2 border-red-100 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[120px] transition-all"
                autoFocus
              />
            </div>
            <div className="p-6 bg-stone-50 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!rejectionReason.trim()}
                onClick={confirmRejection}
                className="flex-1 px-4 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-red-200"
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reprovação de Exclusão */}
      {showDeletionRejectionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onMouseDown={(event) =>
            closeModalOnBackdrop(event, () => setShowDeletionRejectionModal(false))
          }
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-stone-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Rejeitar Pedido de Exclusão
              </h3>
              <button
                onClick={() => setShowDeletionRejectionModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-600 mb-4">
                Informe o motivo da rejeição do pedido de exclusão.
              </p>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">
                Motivo da Rejeição *
              </label>
              <textarea
                value={deletionRejectionReason}
                onChange={(e) => setDeletionRejectionReason(e.target.value)}
                placeholder="Explique por que o pedido de exclusão foi rejeitado..."
                className="w-full p-4 bg-stone-50 border-2 border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none min-h-[120px] transition-all"
                autoFocus
              />
            </div>
            <div className="p-6 bg-stone-50 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowDeletionRejectionModal(false);
                  setDeletionRejectionReason('');
                }}
                className="flex-1 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!deletionRejectionReason.trim()}
                onClick={confirmDeletionRejection}
                className="flex-1 px-4 py-2 text-sm font-bold bg-stone-800 text-white hover:bg-stone-900 rounded-lg transition-all disabled:opacity-50"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      {showNovoPedido && novoPedidoPricing && (
        <NovoPedidoVendaModal
          pricing={novoPedidoPricing}
          currentUser={currentUser}
          onClose={() => {
            setShowNovoPedido(false);
            setNovoPedidoPricing(null);
          }}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}
