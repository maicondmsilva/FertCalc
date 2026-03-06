import React, { useState, useEffect, useMemo } from 'react';
import { Goal, User as AppUser, PricingRecord, Notification } from '../types';
import { Target, TrendingUp, Calendar, CheckCircle2, AlertCircle, Clock, Plus, Trash2 } from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal, getPricingRecords, getUsers, createNotification } from '../services/db';
import { useToast } from './Toast';

interface GoalsProps {
  currentUser: AppUser;
}

export default function Goals({ currentUser }: GoalsProps) {
  const { showSuccess, showError } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({
    type: 'monthly',
    targetValue: 0,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: 'Pendente'
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [g, p, u] = await Promise.all([getGoals(), getPricingRecords(), getUsers()]);
    setGoals(g);
    setPricings(p);
    setAllUsers(u);
    setLoading(false);
  };

  const userGoals = useMemo(() => {
    if (currentUser.role === 'master' || currentUser.role === 'admin') return goals;
    if (currentUser.role === 'manager') {
      const managedIds = currentUser.managedUserIds || [];
      return goals.filter(g => g.userId === currentUser.id || managedIds.includes(g.userId));
    }
    return goals.filter(g => g.userId === currentUser.id);
  }, [goals, currentUser]);

  const calculateProgress = (goal: Goal) => {
    const relevant = pricings.filter(p => {
      // Must be the same user, closed, and approved
      if (p.userId !== goal.userId || p.status !== 'Fechada' || p.approvalStatus !== 'Aprovada') return false;

      const date = new Date(p.date);
      const pricingYear = date.getFullYear();

      if (goal.type === 'monthly') {
        // For monthly goals, match month and year
        return date.getMonth() + 1 === goal.month && pricingYear === goal.year;
      } else {
        // For annual goals, match year
        return pricingYear === goal.year;
      }
    });

    const current = relevant.reduce((sum, p) => sum + (p.factors?.totalTons || 0), 0);
    const percentage = goal.targetValue > 0 ? Math.min((current / goal.targetValue) * 100, 100) : 0;

    return {
      current,
      percentage,
      remaining: Math.max(goal.targetValue - current, 0)
    };
  };

  const handleAddGoal = async () => {
    if (!newGoal.targetValue || newGoal.targetValue <= 0) { showError('Insira um valor de meta válido.'); return; }
    setLoading(true);
    try {
      const userId = (currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager')
        ? (newGoal.userId || currentUser.id) : currentUser.id;
      const userName = allUsers.find(u => u.id === userId)?.name || currentUser.name;
      await createGoal({
        userId, userName,
        type: newGoal.type as 'monthly' | 'annual',
        targetValue: Number(newGoal.targetValue),
        month: newGoal.month,
        year: newGoal.year || new Date().getFullYear(),
        status: 'Pendente'
      });
      if (currentUser.role === 'user') {
        await createNotification({
          userId: '',
          title: 'Nova Meta Pendente',
          message: `${currentUser.name} criou uma nova meta de ${Number(newGoal.targetValue).toLocaleString('pt-BR')} Toneladas (${newGoal.type === 'monthly' ? 'Mensal' : 'Anual'}).`,
          date: new Date().toISOString(),
          read: false,
          type: 'goal_approval'
        });
      }
      showSuccess('Meta criada com sucesso!');
      setIsAddingGoal(false);
      await loadData();
    } catch {
      showError('Erro ao criar meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGoal = async (id: string, status: 'Aprovada' | 'Reprovada') => {
    try {
      await updateGoal(id, { status });
      showSuccess(`Meta ${status.toLowerCase()} com sucesso!`);
      await loadData();
    } catch {
      showError('Erro ao atualizar status da meta.');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteGoal(id);
      showSuccess('Meta excluída com sucesso!');
      await loadData();
    } catch {
      showError('Erro ao excluir meta.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-stone-800">Metas de Vendas</h1>
          <p className="text-stone-500">Acompanhe seu desempenho e objetivos</p>
        </div>
        <button onClick={() => setIsAddingGoal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all">
          <Plus className="w-5 h-5" /> Definir Nova Meta
        </button>
      </div>

      {isAddingGoal && (
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-800">Configurar Objetivo</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Vendedor</label>
                <select value={newGoal.userId || ''} onChange={(e) => setNewGoal({ ...newGoal, userId: e.target.value })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
                  <option value="">Selecione...</option>
                  {allUsers.filter(u => u.role === 'user' && (currentUser.role !== 'manager' || (currentUser.managedUserIds || []).includes(u.id))).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">Tipo</label>
              <select value={newGoal.type} onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value as any })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">Valor Alvo (Toneladas)</label>
              <input type="number" value={newGoal.targetValue} onChange={(e) => setNewGoal({ ...newGoal, targetValue: Number(e.target.value) })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" />
            </div>
            {newGoal.type === 'monthly' && (
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Mês</label>
                <select value={newGoal.month} onChange={(e) => setNewGoal({ ...newGoal, month: Number(e.target.value) })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">Ano</label>
              <input type="number" value={newGoal.year} onChange={(e) => setNewGoal({ ...newGoal, year: Number(e.target.value) })} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAddingGoal(false)} className="px-4 py-2 text-stone-600 font-bold border border-stone-200 rounded-lg hover:bg-stone-50">Cancelar</button>
            <button onClick={handleAddGoal} disabled={loading} className="px-4 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-900 disabled:bg-stone-400">
              {loading ? 'Salvando...' : 'Salvar Meta'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userGoals.map(goal => {
          const progress = calculateProgress(goal);
          return (
            <div key={goal.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${goal.type === 'monthly' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {goal.type === 'monthly' ? <Calendar className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-800">{goal.userName}</h3>
                      <p className="text-xs text-stone-500 uppercase font-bold tracking-wider">
                        {goal.type === 'monthly' ? `${new Date(0, goal.month! - 1).toLocaleString('pt-BR', { month: 'long' })} / ${goal.year}` : `Anual ${goal.year}`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${goal.status === 'Aprovada' ? 'bg-emerald-100 text-emerald-700' : goal.status === 'Reprovada' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {goal.status}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone-500 font-medium">Progresso</span>
                      <span className="text-stone-800 font-bold">{progress.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${progress.percentage >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress.percentage}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-3xl font-black text-stone-800">
                        {progress.current.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-lg text-stone-500">t</span>
                      </p>
                      <p className="text-sm font-medium text-stone-500 mt-1">
                        de {goal.targetValue.toLocaleString('pt-BR')} toneladas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-600">{progress.percentage.toFixed(1)}%</p>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mt-1">Concluído</p>
                    </div>
                  </div>
                  {progress.remaining > 0 && (
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 flex items-center gap-3">
                      <Clock className="w-4 h-4 text-stone-400" />
                      <p className="text-xs text-stone-600">Faltam <strong>{progress.remaining.toLocaleString('pt-BR')} Ton</strong> para bater a meta.</p>
                    </div>
                  )}
                  {progress.percentage >= 100 && (
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <p className="text-xs text-emerald-700 font-bold">Meta atingida! Parabéns!</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-stone-50 flex justify-between items-center">
                <div className="flex gap-2">
                  {(currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') && goal.status === 'Pendente' && (
                    <>
                      <button onClick={() => handleApproveGoal(goal.id, 'Aprovada')} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors" title="Aprovar"><CheckCircle2 className="w-4 h-4" /></button>
                      <button onClick={() => handleApproveGoal(goal.id, 'Reprovada')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Reprovar"><AlertCircle className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
                <button onClick={() => handleDeleteGoal(goal.id)} className="p-2 text-stone-400 hover:text-red-500 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {userGoals.length === 0 && !loading && (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-stone-200 border-dashed">
            <Target className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-900 mb-1">Nenhuma meta definida</h3>
            <p className="text-stone-500">Comece definindo seus objetivos de vendas.</p>
          </div>
        )}
        {loading && (
          <div className="col-span-full py-8 text-center text-stone-400">Carregando metas...</div>
        )}
      </div>
    </div>
  );
}
