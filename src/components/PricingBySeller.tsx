import React, { useState, useEffect, useMemo } from 'react';
import { getPricingRecords, getUsers } from '../services/db';
import { User, PricingRecord } from '../types';
import { User as UserIcon, Search, Calendar, FileText, CheckCircle, Package, DollarSign, Ban } from 'lucide-react';
import { getPricingTotalTons, getPricingTotalSaleValue } from '../utils/pricingMetrics';
import PricingDetailModal from './PricingDetailModal';
import { formatPricingCode } from './CommissionReport';

interface PricingBySellerProps {
  currentUser: User;
}

export default function PricingBySeller({ currentUser }: PricingBySellerProps) {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Aprovada' | 'Reprovada' | 'Fechada' | 'Perdida'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allPricings = await getPricingRecords();
      const allUsers = await getUsers();

      // Only show sellers managed by the current user or all if master/admin
      let visibleSellers = allUsers.filter(u => u.role === 'user' || u.role === 'manager');
      
      let visiblePricings = allPricings;

      if (currentUser.role === 'manager') {
        const managedIds = currentUser.managedUserIds || [];
        visibleSellers = visibleSellers.filter(u => managedIds.includes(u.id) || u.id === currentUser.id);
        visiblePricings = allPricings.filter(p => managedIds.includes(p.userId) || p.userId === currentUser.id);
      } else if (currentUser.role === 'user') {
        // Fallback: If a user somehow accesses this, only show themselves
        visibleSellers = visibleSellers.filter(u => u.id === currentUser.id);
        visiblePricings = allPricings.filter(p => p.userId === currentUser.id);
      }

      setSellers(visibleSellers);
      setPricings(visiblePricings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

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

    return pricings.filter(p => {
      const pDate = new Date(p.date);
      const matchesDate = pDate >= startDate;
      const matchesSeller = selectedSellerId === 'all' || p.userId === selectedSellerId;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter || p.approvalStatus === statusFilter;
      return matchesDate && matchesSeller && matchesStatus;
    });
  }, [pricings, timeRange, selectedSellerId, statusFilter]);

  const stats = useMemo(() => {
    const totalTons = filteredPricings.reduce((sum, p) => sum + getPricingTotalTons(p), 0);
    const totalSales = filteredPricings.reduce((sum, p) => sum + getPricingTotalSaleValue(p), 0);
    const approvedCount = filteredPricings.filter(p => p.approvalStatus === 'Aprovada' || p.status === 'Fechada').length;
    
    return { 
      totalRecords: filteredPricings.length, 
      totalTons, 
      totalSales,
      approvedCount
    };
  }, [filteredPricings]);

  const getStatusBadge = (pricing: PricingRecord) => {
    if (pricing.status === 'Fechada') return <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">Fechada</span>;
    if (pricing.status === 'Perdida') return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Perdida</span>;
    if (pricing.approvalStatus === 'Aprovada') return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">Aprovada</span>;
    if (pricing.approvalStatus === 'Reprovada') return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Reprovada</span>;
    return <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-bold">Pendente</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-orange-600" />
            Precificações por Vendedor
          </h2>
          <p className="text-stone-500">Acompanhamento e análise de métricas agrupadas por vendedor.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 flex w-full flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Vendedor</label>
            <div className="border border-stone-300 rounded-lg flex items-center px-3 bg-stone-50 focus-within:ring-2 focus-within:ring-orange-500 focus-within:bg-white transition-all">
              <UserIcon className="w-5 h-5 text-stone-400 mr-2" />
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full bg-transparent py-2.5 outline-none font-medium text-stone-700"
              >
                <option value="all">Todos os Vendedores</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Status</label>
            <select
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value as any)}
               className="w-full border border-stone-300 rounded-lg bg-stone-50 py-2.5 px-3 outline-none font-medium text-stone-700 focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all"
            >
              <option value="all">Qualquer Status</option>
              <option value="Pendente">Pendentes</option>
              <option value="Aprovada">Aprovadas</option>
              <option value="Reprovada">Reprovadas</option>
              <option value="Fechada">Fechadas (Ganhas)</option>
              <option value="Perdida">Perdidas</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Período</label>
            <select
               value={timeRange}
               onChange={(e) => setTimeRange(e.target.value as any)}
               className="w-full border border-stone-300 rounded-lg bg-stone-50 py-2.5 px-3 outline-none font-medium text-stone-700 focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all"
            >
              <option value="month">Últimos 30 dias</option>
              <option value="quarter">Último Trimestre</option>
              <option value="year">Último Ano</option>
              <option value="all">Todo o Período</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Total Precificações</p>
            <p className="text-2xl font-bold text-stone-800">{stats.totalRecords}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Aprovadas/Fechadas</p>
            <p className="text-2xl font-bold text-stone-800">{stats.approvedCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4">
            <Package className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Volume Total</p>
            <p className="text-2xl font-bold text-stone-800">{stats.totalTons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Valor Estimado</p>
            <p className="text-2xl font-bold text-stone-800">{stats.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-600 text-sm font-semibold border-b border-stone-200">
              <tr>
                <th className="py-3 px-6 text-center w-16">COD</th>
                <th className="py-3 px-6">Data</th>
                <th className="py-3 px-6">Vendedor</th>
                <th className="py-3 px-6">Cliente</th>
                <th className="py-3 px-6 text-center">Status</th>
                <th className="py-3 px-6 text-right">Toneladas</th>
                <th className="py-3 px-6 text-right">Venda Bruta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPricings.length > 0 ? filteredPricings.map((p) => {
                const totalTons = getPricingTotalTons(p);
                const totalSales = getPricingTotalSaleValue(p);

                return (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => setSelectedPricing(p)}
                        className="text-orange-600 font-bold hover:text-orange-800 hover:underline transition-all flex items-center justify-center gap-1 focus:outline-none"
                        title="Ver Detalhes"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {formatPricingCode(p.formattedCod)}
                      </button>
                    </td>
                    <td className="py-3 px-6 text-stone-600 text-sm">
                      {new Date(p.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-6 font-medium text-stone-800">
                      {p.userName || '---'}
                    </td>
                    <td className="py-3 px-6 text-stone-600 text-sm">
                       {p.factors.client?.name || '---'}
                    </td>
                    <td className="py-3 px-6 text-center">
                      {getStatusBadge(p)}
                    </td>
                    <td className="py-3 px-6 text-right text-stone-600 text-sm font-medium">
                      {totalTons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-stone-800 text-sm">
                      {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                   <td colSpan={7} className="py-12 text-center text-stone-500">
                      Nenhuma precificação encontrada para estes filtros.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPricing && (
        <PricingDetailModal
          selectedPricing={selectedPricing}
          onClose={() => setSelectedPricing(null)}
          currentUser={currentUser}
          onUpdateStatus={() => {
             loadData();
          }}
          onUpdateApproval={() => {
             loadData();
          }}
        />
      )}
    </div>
  );
}
