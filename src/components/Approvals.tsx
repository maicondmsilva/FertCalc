import React, { useState, useEffect } from 'react';
import { PricingRecord, Goal, User as AppUser, AppSettings } from '../types';
import { CheckCircle, XCircle, Clock, Shield, Target, Eye } from 'lucide-react';
import PricingDetailModal from './PricingDetailModal';
import { getPricingRecords, getGoals, getAppSettings, updatePricingRecord, updateGoal, createNotification } from '../services/db';
import { useToast } from './Toast';

interface ApprovalsProps {
  currentUser: AppUser;
}

export default function Approvals({ currentUser }: ApprovalsProps) {
  const { showSuccess, showError } = useToast();
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro', companyLogo: ''
  });

  useEffect(() => {
    const loadData = async () => {
      const [allPricings, allGoals, settings] = await Promise.all([
        getPricingRecords(), getGoals(), getAppSettings()
      ]);
      if (settings) setAppSettings(settings);
      if (currentUser.role === 'master' || currentUser.role === 'admin') {
        setPricings(allPricings.filter(p => p.approvalStatus === 'Pendente'));
        setGoals(allGoals.filter(g => g.status === 'Pendente'));
      } else if (currentUser.role === 'manager') {
        const managedIds = currentUser.managedUserIds || [];
        setPricings(allPricings.filter(p => (p.userId === currentUser.id || managedIds.includes(p.userId)) && p.approvalStatus === 'Pendente'));
        setGoals(allGoals.filter(g => (g.userId === currentUser.id || managedIds.includes(g.userId)) && g.status === 'Pendente'));
      } else {
        setPricings(allPricings.filter(p => p.userId === currentUser.id && p.approvalStatus === 'Pendente'));
        setGoals(allGoals.filter(g => g.userId === currentUser.id && g.status === 'Pendente'));
      }
    };
    loadData();
  }, [currentUser]);

  const handlePricingApproval = async (id: string, newStatus: 'Aprovada' | 'Reprovada') => {
    if (!confirm(`Deseja realmente ${newStatus.toLowerCase()} esta precificação?`)) return;
    const pricing = pricings.find(p => p.id === id);
    if (!pricing) return;
    const historyEntry = {
      date: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name,
      action: `Precificação ${newStatus}`
    };
    try {
      await updatePricingRecord(id, {
        approvalStatus: newStatus,
        history: [...(pricing.history || []), historyEntry]
      } as any);
      await createNotification({
        userId: pricing.userId,
        title: `Precificação ${newStatus.toLowerCase()}`,
        message: `Sua precificação para ${pricing.factors.client.name} foi ${newStatus.toLowerCase()}.`,
        date: new Date().toISOString(), read: false, type: 'pricing_approval',
      });
      setPricings(prev => prev.filter(p => p.id !== id));
      if (selectedPricing?.id === id) setSelectedPricing(null);
      showSuccess(`Precificação ${newStatus.toLowerCase()} com sucesso!`);
    } catch { showError('Erro ao processar aprovação.'); }
  };

  const handleGoalApproval = async (id: string, newStatus: 'Aprovada' | 'Reprovada') => {
    if (!confirm(`Deseja realmente ${newStatus.toLowerCase()} esta meta?`)) return;
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    try {
      await updateGoal(id, { status: newStatus });
      await createNotification({
        userId: goal.userId,
        title: `Meta ${newStatus.toLowerCase()}`,
        message: `Sua meta de ${goal.type === 'monthly' ? `Mês ${goal.month}/${goal.year}` : `Ano ${goal.year}`} foi ${newStatus.toLowerCase()}.`,
        date: new Date().toISOString(), read: false, type: 'goal_approval',
      });
      setGoals(prev => prev.filter(g => g.id !== id));
      showSuccess(`Meta ${newStatus.toLowerCase()} com sucesso!`);
    } catch { showError('Erro ao processar aprovação da meta.'); }
  };

  if (currentUser.role !== 'master' && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200 text-center">
        <Shield className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-stone-800">Acesso Restrito</h2>
        <p className="text-stone-600">Esta área é destinada apenas para gerentes e administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-stone-800">Central de Aprovações</h1>

      {/* Pricings Pending Approval */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-stone-500" />
          Precificações Pendentes
        </h2>
        <div className="space-y-4">
          {pricings.length > 0 ? pricings.map(p => (
            <div key={p.id} className="p-4 border border-stone-200 rounded-lg flex justify-between items-center bg-stone-50">
              <div>
                <p className="font-bold text-stone-700 flex items-center gap-1">
                  <span className="text-emerald-600 font-mono text-xs">#{p.factors.client.code}</span>
                  {p.factors.client.name}
                </p>
                <div className="mt-0.5">
                  <p className="text-[10px] font-bold text-stone-400 uppercase">IE: {p.factors.client.stateRegistration || '---'}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Precificação: #{p.id}</p>
                </div>
                <p className="text-sm text-stone-500 mt-1">
                  <span className="font-bold text-stone-600">Vendedor:</span> {p.userName || '---'} ({p.userCode || '---'}) |
                  <span className="font-bold text-stone-600 ml-1">Agente:</span> {p.factors.agent.name}
                </p>
                <p className="text-sm text-stone-500">
                  <span className="font-bold text-stone-600">Valor:</span> R$ {Number(p.summary.totalSaleValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {p.calculations && p.calculations.length > 0 ? (
                  <p className="text-xs text-emerald-600 font-bold mt-1">
                    {p.calculations.length} fórmulas precificadas
                  </p>
                ) : (
                  <p className="text-xs text-stone-400">Ref: {p.factors.targetFormula}</p>
                )}
                {p.factors.commercialObservation && (
                  <p className="text-[10px] text-stone-400 italic mt-1 line-clamp-1">Obs: {p.factors.commercialObservation}</p>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => setSelectedPricing(p)} className="p-2 text-stone-500 hover:bg-stone-200 rounded-full"><Eye className="w-4 h-4" /></button>
                <button onClick={() => handlePricingApproval(p.id, 'Aprovada')} className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"><CheckCircle className="w-4 h-4 inline mr-1" />Aprovar</button>
                <button onClick={() => handlePricingApproval(p.id, 'Reprovada')} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"><XCircle className="w-4 h-4 inline mr-1" />Reprovar</button>
              </div>
            </div>
          )) : <p className="text-stone-500">Nenhuma precificação pendente.</p>}
        </div>
      </div>

      {/* Goals Pending Approval */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-stone-500" />
          Metas Pendentes
        </h2>
        <div className="space-y-4">
          {goals.length > 0 ? goals.map(g => (
            <div key={g.id} className="p-4 border border-stone-200 rounded-lg flex justify-between items-center bg-stone-50">
              <div>
                <p className="font-bold text-stone-700">{g.userName} - {g.type === 'monthly' ? `Mês ${g.month}/${g.year}` : `Ano ${g.year}`}</p>
                <p className="text-sm text-stone-500">Valor da Meta: R$ {Number(g.targetValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleGoalApproval(g.id, 'Aprovada')} className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"><CheckCircle className="w-4 h-4 inline mr-1" />Aprovar</button>
                <button onClick={() => handleGoalApproval(g.id, 'Reprovada')} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"><XCircle className="w-4 h-4 inline mr-1" />Reprovar</button>
              </div>
            </div>
          )) : <p className="text-stone-500">Nenhuma meta pendente.</p>}
        </div>
      </div>

      {selectedPricing && (
        <PricingDetailModal
          selectedPricing={selectedPricing}
          currentUser={currentUser}
          onClose={() => setSelectedPricing(null)}
          onUpdateApproval={handlePricingApproval}
          appSettings={appSettings}
        />
      )}
    </div>
  );
}
