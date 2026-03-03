import React, { useState, useEffect, useMemo } from 'react';
import { getPricingRecords } from '../services/db';
import { User, PricingRecord } from '../types';
import { DollarSign, Percent, TrendingUp, Calendar, User as UserIcon, Building, Download, BarChart3 } from 'lucide-react';

interface CommissionReportProps {
  currentUser: User;
}

export default function CommissionReport({ currentUser }: CommissionReportProps) {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await getPricingRecords();
      let filtered = data.filter(p => p.status === 'Fechada');

      if (currentUser.role !== 'master' && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        filtered = filtered.filter(p => p.userId === currentUser.id);
      }

      setPricings(filtered);
      setLoading(false);
    };
    loadData();
  }, [currentUser]);

  const filteredPricings = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    return pricings.filter(p => new Date(p.date) >= startDate);
  }, [pricings, timeRange]);

  const stats = useMemo(() => {
    const totalComission = filteredPricings.reduce((sum, p) => sum + (p.summary.commissionValue || 0), 0);
    const totalSales = filteredPricings.reduce((sum, p) => sum + (p.summary.totalSaleValue || 0), 0);
    const avgCommissionRate = totalSales > 0 ? (totalComission / totalSales) * 100 : 0;

    return { totalComission, totalSales, avgCommissionRate };
  }, [filteredPricings]);

  const byAgent = useMemo(() => {
    const map = new Map<string, { name: string; totalSales: number; totalCommission: number; count: number }>();

    filteredPricings.forEach(p => {
      const agentId = p.factors.agent?.id || 'unknown';
      const agentName = p.factors.agent?.name || 'Sem Agente';

      const current = map.get(agentId) || { name: agentName, totalSales: 0, totalCommission: 0, count: 0 };
      current.totalSales += (p.summary.totalSaleValue || 0);
      current.totalCommission += (p.summary.commissionValue || 0);
      current.count += 1;
      map.set(agentId, current);
    });

    return Array.from(map.values()).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [filteredPricings]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Relatório de Comissões
          </h2>
          <p className="text-stone-500">Análise de comissionamento por vendas fechadas e aprovadas.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 flex items-center text-sm font-medium text-stone-600 shadow-sm">
            <Calendar className="w-4 h-4 mr-2" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="month">Últimos 30 dias</option>
              <option value="quarter">Último Trimestre</option>
              <option value="year">Último Ano</option>
              <option value="all">Todo o Período</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Total de Comissões</p>
            <p className="text-2xl font-bold text-stone-800">
              {stats.totalComission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Vendas (Base de Cálculo)</p>
            <p className="text-2xl font-bold text-stone-800">
              {stats.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
            <Percent className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Taxa Média Agregada</p>
            <p className="text-2xl font-bold text-stone-800">
              {stats.avgCommissionRate.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-stone-500" />
            Comissões por Agente
          </h3>
        </div>

        {byAgent.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <BarChart3 className="w-12 h-12 text-stone-300 mb-4" />
            <p className="text-stone-500 text-lg">Nenhuma venda fechada com comissão no período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-stone-50 text-stone-600 text-sm font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-4 px-6">Agente</th>
                  <th className="py-4 px-6 text-right">Qtd. Negócios</th>
                  <th className="py-4 px-6 text-right">Volume de Vendas</th>
                  <th className="py-4 px-6 text-right">Comissão Total</th>
                  <th className="py-4 px-6 text-right">Taxa Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {byAgent.map((agent, index) => (
                  <tr key={index} className="hover:bg-stone-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-stone-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      {agent.name}
                    </td>
                    <td className="py-4 px-6 text-right text-stone-600">{agent.count}</td>
                    <td className="py-4 px-6 text-right text-stone-600">
                      {agent.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600">
                      {agent.totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-4 px-6 text-right text-stone-500">
                      {agent.totalSales > 0 ? ((agent.totalCommission / agent.totalSales) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mt-6">
        <div className="p-6 border-b border-stone-200">
          <h3 className="text-lg font-bold text-stone-800 flex items-center">
            <Building className="w-5 h-5 mr-2 text-stone-500" />
            Últimas Precificações Comissionadas
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-600 text-sm font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-6">Data</th>
                <th className="py-3 px-6">Cliente</th>
                <th className="py-3 px-6">Agente</th>
                <th className="py-3 px-6 text-right">Venda Bruta</th>
                <th className="py-3 px-6 text-right">Taxa %</th>
                <th className="py-3 px-6 text-right">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPricings.slice(0, 10).map((p) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="py-3 px-6 text-stone-600 text-sm">
                    {new Date(p.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-6 font-medium text-stone-800">{p.factors?.client?.name || 'N/A'}</td>
                  <td className="py-3 px-6 text-stone-600">{p.factors?.agent?.name || 'N/A'}</td>
                  <td className="py-3 px-6 text-right text-stone-600">
                    {p.summary.totalSaleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-3 px-6 text-right text-stone-500">
                    {p.factors.commission || 0}%
                  </td>
                  <td className="py-3 px-6 text-right font-medium text-emerald-600">
                    {(p.summary.commissionValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              ))}
              {filteredPricings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
