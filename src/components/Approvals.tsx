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
import {
  getPricingRecords,
  getGoals,
  getAppSettings,
  updatePricingRecord,
  updateGoal,
  createNotification,
  getUsers,
} from '../services/db';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface ApprovalsProps {
  currentUser: AppUser;
}

export default function Approvals({ currentUser }: ApprovalsProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [activeTab, setActiveTab] = useState<'pricings' | 'goals' | 'deletions'>('pricings');
  const [allPricings, setAllPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });

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

  const loadData = async () => {
    const [fetchedPricings, allGoals, settings] = await Promise.all([
      getPricingRecords(),
      getGoals(),
      getAppSettings(),
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

    const historyEntry = {
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: `Precificação ${newStatus}${newStatus === 'Reprovada' ? `: ${reason}` : ''}`,
    };

    try {
      await updatePricingRecord(id, {
        approvalStatus: newStatus,
        rejectionObservation: newStatus === 'Reprovada' ? reason : '',
        history: [...(pricing.history || []), historyEntry],
      } as any);

      await createNotification({
        userId: pricing.userId,
        title: `Precificação ${newStatus === 'Aprovada' ? 'Aprovada ✅' : 'Reprovada ❌'}`,
        message: `Sua precificação para ${pricing.factors.client.name} foi ${newStatus.toLowerCase()}.${newStatus === 'Reprovada' ? ` Motivo: ${reason}` : ''}`,
        date: new Date().toISOString(),
        read: false,
        type: 'pricing_approval',
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
    } catch (err: any) {
      console.error('Erro ao processar aprovação da exclusão:', err);
      showError(`Erro ao processar aprovação da exclusão: ${err.message || 'Erro no servidor'}`);
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
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showSuccess(`Meta ${newStatus.toLowerCase()} com sucesso!`);
    } catch {
      showError('Erro ao processar aprovação da meta.');
    }
  };

  if (
    currentUser.role !== 'master' &&
    currentUser.role !== 'admin' &&
    currentUser.role !== 'manager' &&
    !(currentUser.permissions as any)?.approvals
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
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPricing(p)}
                    className="p-2 text-stone-500 hover:bg-stone-200 rounded-full"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4" />
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

      {/* Modal de Reprovação de Precificação */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
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
    </div>
  );
}
