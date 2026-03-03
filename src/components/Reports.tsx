import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Download, Filter, Calendar, Users, Target, DollarSign, ChevronDown } from 'lucide-react';
import { User, PricingRecord, Goal } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { getPricingRecords, getGoals } from '../services/db';

interface ReportsProps {
  currentUser: User;
}

export default function Reports({ currentUser }: ReportsProps) {
  const [history, setHistory] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [activeReportTab, setActiveReportTab] = useState<'overview' | 'pricing' | 'commission'>('overview');

  useEffect(() => {
    const loadData = async () => {
      const [allPricings, allGoals] = await Promise.all([getPricingRecords(), getGoals()]);
      if (currentUser.role === 'user') {
        setHistory(allPricings.filter(p => p.userId === currentUser.id));
        setGoals(allGoals.filter(g => g.userId === currentUser.id));
      } else if (currentUser.role === 'manager' || currentUser.role === 'admin') {
        setHistory(allPricings);
        setGoals(allGoals.filter(g => g.status === 'Aprovada'));
      } else {
        setHistory(allPricings);
        setGoals(allGoals);
      }
    };
    loadData();
  }, [currentUser]);

  const getFilteredHistory = () => {
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return history.filter(p => new Date(p.date) >= startDate);
  };

  const filteredHistory = getFilteredHistory();

  const stats = {
    totalSales: filteredHistory.filter(p => p.status === 'Fechada').reduce((acc, p) => acc + p.summary.totalSaleValue, 0),
    totalTons: filteredHistory.filter(p => p.status === 'Fechada').reduce((acc, p) => acc + p.factors.totalTons, 0),
    conversionRate: filteredHistory.length > 0 ? (filteredHistory.filter(p => p.status === 'Fechada').length / filteredHistory.length) * 100 : 0,
    averageTicket: filteredHistory.filter(p => p.status === 'Fechada').length > 0
      ? filteredHistory.filter(p => p.status === 'Fechada').reduce((acc, p) => acc + p.summary.totalSaleValue, 0) / filteredHistory.filter(p => p.status === 'Fechada').length
      : 0
  };

  const salesByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = d.toLocaleString('pt-BR', { month: 'short' });
    const monthNum = d.getMonth() + 1;
    const year = d.getFullYear();

    const value = filteredHistory
      .filter(p => {
        const pDate = new Date(p.date);
        return p.status === 'Fechada' && (pDate.getMonth() + 1) === monthNum && pDate.getFullYear() === year;
      })
      .reduce((sum, p) => sum + p.summary.totalSaleValue, 0);

    return { name: monthName, value };
  }).reverse();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Relatórios e BI</h2>
          <p className="text-stone-500 text-sm">Acompanhe o desempenho e metas em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 flex items-center text-sm font-medium text-stone-600">
            <Calendar className="w-4 h-4 mr-2" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="week">Última Semana</option>
              <option value="month">Este Mês</option>
              <option value="year">Este Ano</option>
            </select>
          </div>
          <button className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center transition-colors">
            <Download className="w-4 h-4 mr-2" /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveReportTab('overview')}
          className={`px-4 py-2 text-sm font-medium ${activeReportTab === 'overview' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveReportTab('pricing')}
          className={`ml-4 px-4 py-2 text-sm font-medium ${activeReportTab === 'pricing' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Precificação
        </button>
        <button
          onClick={() => setActiveReportTab('commission')}
          className={`ml-4 px-4 py-2 text-sm font-medium ${activeReportTab === 'commission' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Comissão
        </button>
      </div>

      {activeReportTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12.5%</span>
              </div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total em Vendas</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">R$ {stats.totalSales.toLocaleString()}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">+5.2%</span>
              </div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Volume (Toneladas)</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{stats.totalTons.toLocaleString()} t</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{stats.conversionRate.toFixed(1)}%</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Ticket Médio</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">R$ {stats.averageTicket.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-stone-800">Evolução de Vendas</h3>
                <button className="text-xs text-emerald-600 font-bold hover:underline">Ver Detalhes</button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                    <Tooltip
                      cursor={{ fill: '#f8f8f8' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-stone-800">Meta vs Realizado</h3>
                <button className="text-xs text-emerald-600 font-bold hover:underline">Ver Metas</button>
              </div>
              <div className="space-y-6">
                {goals.filter(g => g.status === 'Aprovada').slice(0, 3).map(g => {
                  const realized = history.filter(p => p.userId === g.userId && p.status === 'Fechada').reduce((acc, p) => acc + p.summary.totalSaleValue, 0);
                  const percent = Math.min((realized / g.targetValue) * 100, 100);
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-stone-600">{g.userName} ({g.type === 'monthly' ? 'Mensal' : 'Anual'})</span>
                        <span className="font-bold text-stone-800">{percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-1000"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                        <span>R$ {realized.toLocaleString()}</span>
                        <span>Alvo: R$ {g.targetValue.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
                {goals.length === 0 && (
                  <div className="h-48 flex items-center justify-center text-stone-400 text-sm italic">
                    Nenhuma meta configurada para exibição
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-bold text-stone-800">Detalhamento de Operações</h3>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-stone-50 rounded-lg border border-stone-200"><Filter className="w-4 h-4 text-stone-500" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    {currentUser.role !== 'user' && <th className="px-6 py-4">Vendedor</th>}
                    <th className="px-6 py-4">Fórmula</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredHistory.slice(0, 10).map(p => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 text-stone-500">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{p.factors.client.name}</td>
                      {currentUser.role !== 'user' && <td className="px-6 py-4 text-stone-600">{p.userName}</td>}
                      <td className="px-6 py-4 font-mono text-xs">{p.factors.targetFormula}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">R$ {p.summary.totalSaleValue.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'Fechada' ? 'bg-emerald-100 text-emerald-700' :
                            p.status === 'Perdida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-stone-400 italic">Nenhum registro encontrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
