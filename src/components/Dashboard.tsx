import React, { useState, useEffect } from 'react';
import { PricingRecord, Goal, User } from '../types';
import { TrendingUp, TrendingDown, DollarSign, FileText, Target, Clock, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { getPricingRecords, getGoals } from '../services/db';
import { getPricingTotalTons, getPricingTotalSaleValue } from '../utils/pricingMetrics';

interface DashboardProps {
  currentUser: User;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [allPricings, allGoals] = await Promise.all([getPricingRecords(), getGoals()]);
      setPricings(allPricings.filter(p => p.userId === currentUser.id));
      setGoals(allGoals.filter(g => g.userId === currentUser.id));
    };
    loadData();
  }, [currentUser]);

  const stats = {
    totalValue: pricings.filter(p => p.status === 'Fechada').reduce((sum, p) => sum + getPricingTotalSaleValue(p), 0),
    totalValueInProgress: pricings.filter(p => p.status === 'Em Andamento').reduce((sum, p) => sum + getPricingTotalSaleValue(p), 0),
    count: pricings.length,
    closedCount: pricings.filter(p => p.status === 'Fechada').length,
    inProgressCount: pricings.filter(p => p.status === 'Em Andamento').length,
    lostCount: pricings.filter(p => p.status === 'Perdida').length,
    avgMargin: pricings.length > 0 ? pricings.reduce((sum, p) => sum + ((p.factors?.margin || 0) - (p.factors?.discount || 0)), 0) / pricings.length : 0
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const monthlyGoal = goals.find(g => g.type === 'monthly' && g.month === currentMonth && g.year === currentYear && g.status === 'Aprovada');

  const monthlySales = pricings
    .filter(p => {
      const d = new Date(p.date);
      return p.status === 'Fechada' && p.approvalStatus === 'Aprovada' &&
        d.getMonth() + 1 === monthlyGoal?.month &&
        d.getFullYear() === monthlyGoal?.year;
    })
    .reduce((sum, p) => sum + getPricingTotalTons(p), 0);

  const goalProgress = monthlyGoal ? (monthlySales / monthlyGoal.targetValue) * 100 : 0;

  const statusData = [
    { name: 'Fechada', value: stats.closedCount, color: '#10b981' },
    { name: 'Em Andamento', value: stats.inProgressCount, color: '#3b82f6' },
    { name: 'Perdida', value: stats.lostCount, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      month: d.toLocaleString('pt-BR', { month: 'short' }),
      monthNum: d.getMonth() + 1,
      year: d.getFullYear(),
      value: 0
    };
  }).reverse();

  last6Months.forEach(m => {
    m.value = pricings
      .filter(p => {
        const d = new Date(p.date);
        return p.status === 'Fechada' && (d.getMonth() + 1) === m.monthNum && d.getFullYear() === m.year;
      })
      .reduce((sum, p) => sum + getPricingTotalSaleValue(p), 0);
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-stone-800">Meu Progresso</h1>
          <p className="text-stone-500">Acompanhe seu desempenho e metas de vendas.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-bold text-stone-600 uppercase tracking-wider">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Vendas Fechadas</p>
          <p className="text-2xl font-black text-stone-800">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Em Negociação</p>
          <p className="text-2xl font-black text-stone-800">R$ {stats.totalValueInProgress.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-stone-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-stone-600" />
            </div>
            <span className="text-xs font-bold text-stone-400">{stats.count} total</span>
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Precificações</p>
          <p className="text-2xl font-black text-stone-800">{stats.closedCount} <span className="text-sm font-medium text-stone-400">Sucessos</span></p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Margem Média</p>
          <p className="text-2xl font-black text-stone-800">R$ {stats.avgMargin.toFixed(2)} <span className="text-sm font-medium text-stone-400">/ton</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Goal Progress */}
        <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-stone-200 flex flex-col">
          <h3 className="text-lg font-black text-stone-800 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            Meta Mensal
          </h3>

          {monthlyGoal ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <div className="relative w-48 h-48 mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-stone-100"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={552.9}
                    strokeDashoffset={552.9 - (552.9 * Math.min(goalProgress, 100)) / 100}
                    className="text-emerald-500 transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-stone-800">{Math.round(goalProgress)}%</span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Atingido</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Volume no Mês</p>
                <p className="text-2xl font-black text-emerald-600">{monthlySales.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t</p>
                <p className="text-xs text-stone-500">De uma meta de {monthlyGoal.targetValue.toLocaleString('pt-BR')} toneladas</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <Target className="w-12 h-12 text-stone-300 mb-4" />
              <p className="text-stone-500 text-sm">Nenhuma meta aprovada para este mês.</p>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-lg font-black text-stone-800 mb-6">Vendas nos Últimos 6 Meses</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a8a29e', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a8a29e', fontSize: 10 }}
                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f5f5f4' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {last6Months.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === last6Months.length - 1 ? '#10b981' : '#d6d3d1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-black text-stone-800 mb-4 uppercase tracking-wider">Status das Propostas</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-bold text-stone-500 uppercase">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-stone-900 p-6 rounded-3xl shadow-xl text-white">
              <h3 className="text-sm font-bold text-stone-400 mb-4 uppercase tracking-wider">Últimas Atividades</h3>
              <div className="space-y-4">
                {pricings.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-start gap-3 pb-3 border-b border-stone-800 last:border-0">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'Fechada' ? 'bg-emerald-500' :
                      p.status === 'Perdida' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                    <div>
                      <p className="text-xs font-bold">{p.factors?.client?.name || 'Cliente não identificado'}</p>
                      <p className="text-[10px] text-stone-500">#{p.id.slice(0, 8)} • {new Date(p.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
                {pricings.length === 0 && <p className="text-xs text-stone-500 italic">Nenhuma atividade recente.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
