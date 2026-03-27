import React, { useState, useEffect } from 'react';
import { PricingRecord, User, AppSettings, Branch } from '../types';
import { getPricingRecords, getAppSettings, getBranches, getUsers } from '../services/db';
import { BarChart3, FileText, Search, Filter, TrendingUp, TrendingDown, DollarSign, Package, CheckCircle, XCircle, Clock, Trash2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getPricingTotalTons, getPricingTotalSaleValue, getPricingAverageCommissionRate } from '../utils/pricingMetrics';
import PricingDetailModal from './PricingDetailModal';
import { formatPricingCode } from './CommissionReport';

interface PricingReportProps {
  currentUser: User;
}

type ViewMode = 'cards' | 'table';

export default function PricingReport({ currentUser }: PricingReportProps) {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ companyName: 'FertCalc Pro', companyLogo: '' });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [rawPricings, settings, allBranches, allUsers] = await Promise.all([
        getPricingRecords(), getAppSettings(), getBranches(), getUsers()
      ]);

      if (settings) setAppSettings(settings);
      setBranches(allBranches);
      setUsers(allUsers.filter(u => u.role === 'user' || u.role === 'manager'));

      // Filter pricings by user role
      let filtered = rawPricings;
      if (currentUser.role === 'manager') {
        const managedIds = currentUser.managedUserIds || [];
        filtered = rawPricings.filter(p => p.userId === currentUser.id || managedIds.includes(p.userId));
      } else if (currentUser.role === 'user') {
        filtered = rawPricings.filter(p => p.userId === currentUser.id || p.transferToUserId === currentUser.id);
      }
      setPricings(filtered);
      setLoading(false);
    };
    loadData();
  }, [currentUser]);

  const filteredPricings = pricings.filter(p => {
    const clientName = p.factors?.client?.name || '';
    const agentName = p.factors?.agent?.name || '';
    const userName = p.userName || '';
    const matchesSearch = !search ||
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      agentName.toLowerCase().includes(search.toLowerCase()) ||
      userName.toLowerCase().includes(search.toLowerCase()) ||
      (p.formattedCod || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesApproval = !approvalFilter || p.approvalStatus === approvalFilter;
    const matchesBranch = !branchFilter || p.factors?.branchId === branchFilter;
    const matchesUser = !userFilter || p.userId === userFilter;
    const pDate = new Date(p.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;
    const matchesDate = (!start || pDate >= start) && (!end || pDate <= end);
    return matchesSearch && matchesStatus && matchesApproval && matchesBranch && matchesUser && matchesDate;
  });

  // Estatísticas
  const stats = {
    total: filteredPricings.length,
    emAndamento: filteredPricings.filter(p => p.status === 'Em Andamento').length,
    fechadas: filteredPricings.filter(p => p.status === 'Fechada').length,
    perdidas: filteredPricings.filter(p => p.status === 'Perdida').length,
    excluidas: filteredPricings.filter(p => p.status === 'Excluída').length,
    aprovadas: filteredPricings.filter(p => p.approvalStatus === 'Aprovada').length,
    reprovadas: filteredPricings.filter(p => p.approvalStatus === 'Reprovada').length,
    pendentes: filteredPricings.filter(p => p.approvalStatus === 'Pendente').length,
    ticketMedioFechadas: filteredPricings.filter(p => p.status === 'Fechada').length > 0
      ? filteredPricings.filter(p => p.status === 'Fechada').reduce((s, p) => s + getPricingTotalSaleValue(p), 0) /
        filteredPricings.filter(p => p.status === 'Fechada').reduce((s, p) => s + getPricingTotalTons(p), 0)
      : 0,
    totalFaturamentoFechado: filteredPricings.filter(p => p.status === 'Fechada').reduce((s, p) => s + getPricingTotalSaleValue(p), 0),
    totalTonsFechadas: filteredPricings.filter(p => p.status === 'Fechada').reduce((s, p) => s + getPricingTotalTons(p), 0),
    taxaConversao: filteredPricings.filter(p => p.status !== 'Excluída').length > 0
      ? ((filteredPricings.filter(p => p.status === 'Fechada').length / filteredPricings.filter(p => p.status !== 'Excluída').length) * 100).toFixed(1)
      : '0.0',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fechada': return 'bg-emerald-100 text-emerald-700';
      case 'Perdida': return 'bg-red-100 text-red-700';
      case 'Excluída': return 'bg-stone-100 text-stone-500';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getApprovalColor = (status: string) => {
    switch (status) {
      case 'Aprovada': return 'bg-emerald-100 text-emerald-700';
      case 'Reprovada': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    if (appSettings.companyLogo) {
      doc.addImage(appSettings.companyLogo, 'PNG', 10, 8, 18, 18);
    }
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(appSettings.companyName, appSettings.companyLogo ? 32 : 10, 16);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Relatório de Precificação', appSettings.companyLogo ? 32 : 10, 22);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Por: ${currentUser.name}`, 10, 30);
    doc.line(10, 33, pageWidth - 10, 33);

    // Stats
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text([
      `Total: ${stats.total}`,
      `Fechadas: ${stats.fechadas}`,
      `Em Andamento: ${stats.emAndamento}`,
      `Perdidas: ${stats.perdidas}`,
      `Aprovadas: ${stats.aprovadas}`,
      `Reprovadas: ${stats.reprovadas}`,
      `Taxa de Conversão: ${stats.taxaConversao}%`,
      `Faturamento Fechado: R$ ${stats.totalFaturamentoFechado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ].join('   |   '), 10, 40, { maxWidth: pageWidth - 20 });

    autoTable(doc, {
      startY: 48,
      head: [['COD', 'Data', 'Vendedor', 'Cliente', 'Agent', '% Age', 'Fórmulas', 'Tons', 'Preço Médio/Ton', 'Valor Total', 'Status', 'Aprovação']],
      body: filteredPricings.map(p => [
        formatPricingCode(p.formattedCod),
        new Date(p.date).toLocaleDateString('pt-BR'),
        p.userName || '---',
        p.factors?.client?.name || '---',
        p.factors?.agent?.name || '---',
        getPricingAverageCommissionRate(p).toFixed(1) + '%',
        (p.calculations?.length || 0) + ' f.',
        getPricingTotalTons(p).toFixed(1) + ' t',
        `R$ ${(getPricingTotalTons(p) > 0 ? getPricingTotalSaleValue(p) / getPricingTotalTons(p) : 0).toFixed(2)}`,
        `R$ ${getPricingTotalSaleValue(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        p.status,
        p.approvalStatus || 'Pendente',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [28, 25, 23], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: 15 } }
    });

    doc.save(`Relatorio_Precificacao_${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    const wsData = [
      ['RELATÓRIO DE PRECIFICAÇÃO', appSettings.companyName],
      ['Gerado em', new Date().toLocaleString('pt-BR'), 'Por', currentUser.name],
      [],
      ['COD', 'Data', 'Vendedor', 'Cliente', 'Agente', '% Comissao Agent', 'Filial', 'Total Fórmulas', 'Toneladas', 'Preço Médio/Ton', 'Valor Total', 'Status', 'Aprovação'],
      ...filteredPricings.map(p => [
        formatPricingCode(p.formattedCod),
        new Date(p.date).toLocaleDateString('pt-BR'),
        p.userName || '---',
        p.factors?.client?.name || '---',
        p.factors?.agent?.name || '---',
        getPricingAverageCommissionRate(p),
        branches.find(b => b.id === p.factors?.branchId)?.name || '---',
        p.calculations?.length || 0,
        getPricingTotalTons(p),
        getPricingTotalTons(p) > 0 ? getPricingTotalSaleValue(p) / getPricingTotalTons(p) : 0,
        getPricingTotalSaleValue(p),
        p.status,
        p.approvalStatus || 'Pendente',
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precificações');
    XLSX.writeFile(wb, `Relatorio_Precificacao_${new Date().getTime()}.xlsx`);
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setApprovalFilter('');
    setBranchFilter(''); setUserFilter(''); setStartDate(''); setEndDate('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-emerald-600" />
            Relatório de Precificação
          </h1>
          <p className="text-stone-500 mt-1 text-sm">Análise completa de todas as precificações do sistema</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-900 transition-colors text-sm"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Total</p>
          <p className="text-3xl font-black text-stone-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Fechadas</p>
          </div>
          <p className="text-3xl font-black text-emerald-700">{stats.fechadas}</p>
          <p className="text-[10px] text-emerald-500 mt-1 font-medium">{stats.taxaConversao}% conversão</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-blue-500" />
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Em Andamento</p>
          </div>
          <p className="text-3xl font-black text-blue-700">{stats.emAndamento}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
          <div className="flex items-center gap-1 mb-1">
            <XCircle className="w-3 h-3 text-red-500" />
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Perdidas</p>
          </div>
          <p className="text-3xl font-black text-red-700">{stats.perdidas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200">
          <div className="flex items-center gap-1 mb-1">
            <Trash2 className="w-3 h-3 text-stone-400" />
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">Excluídas</p>
          </div>
          <p className="text-3xl font-black text-stone-500">{stats.excluidas}</p>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 text-white shadow-lg shadow-emerald-200">
          <p className="text-xs font-bold text-emerald-200 uppercase tracking-wide mb-1">Faturamento Fechado</p>
          <p className="text-2xl font-black">R$ {stats.totalFaturamentoFechado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Toneladas Fechadas</p>
          <p className="text-2xl font-black text-stone-800">{stats.totalTonsFechadas.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Ticket Médio/Ton (Fechadas)</p>
          <p className="text-2xl font-black text-stone-800">R$ {stats.ticketMedioFechadas.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Aprovações</p>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-lg font-black text-emerald-600">{stats.aprovadas}</span>
              <span className="text-stone-300 mx-1">/</span>
              <span className="text-lg font-black text-red-500">{stats.reprovadas}</span>
              <span className="text-stone-300 mx-1">/</span>
              <span className="text-lg font-black text-amber-500">{stats.pendentes}</span>
            </div>
            <div className="text-[9px] text-stone-400 text-right leading-tight">
              <div className="text-emerald-600 font-bold">Aprovadas</div>
              <div className="text-red-500 font-bold">Reprovadas</div>
              <div className="text-amber-500 font-bold">Pendentes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar cliente, vendedor, cod..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">Todos os Status</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Fechada">Fechada</option>
            <option value="Perdida">Perdida</option>
            <option value="Excluída">Excluída</option>
          </select>
          <select value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">Todas Aprovações</option>
            <option value="Pendente">Pendente</option>
            <option value="Aprovada">Aprovada</option>
            <option value="Reprovada">Reprovada</option>
          </select>
          {(currentUser.role === 'admin' || currentUser.role === 'master' || currentUser.role === 'manager') && (
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">Todos Vendedores</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.nickname})</option>)}
            </select>
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs font-bold text-stone-400 uppercase">De:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs font-bold text-stone-400 uppercase">Até:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <button onClick={clearFilters} className="px-3 py-2 bg-stone-100 text-stone-600 text-sm font-bold rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Limpar
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2 font-medium">{filteredPricings.length} precificações encontradas</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3 text-center">COD</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Agente</th>
                  <th className="px-4 py-3 text-center">% Age</th>
                  <th className="px-4 py-3 text-center">Fórm.</th>
                  <th className="px-4 py-3 text-right">Tons</th>
                  <th className="px-4 py-3 text-right">Preço Médio</th>
                  <th className="px-4 py-3 text-right">Total Venda</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aprov.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {filteredPricings.map(p => {
                  const avgPrice = getPricingTotalTons(p) > 0 ? getPricingTotalSaleValue(p) / getPricingTotalTons(p) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedPricing(p)}
                          className="text-emerald-600 font-bold hover:text-emerald-800 hover:underline transition-all flex items-center justify-center gap-1 focus:outline-none"
                          title="Ver Detalhes"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {formatPricingCode(p.formattedCod)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-sm whitespace-nowrap">
                        {new Date(p.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-stone-800 font-medium text-sm">
                        {p.factors?.client?.name || '---'}
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-sm">
                        {p.userName || '---'}
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-sm">
                        {p.factors?.agent?.name || '---'}
                      </td>
                      <td className="px-4 py-3 text-center text-purple-600 font-bold text-sm">
                        {getPricingAverageCommissionRate(p).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center text-stone-600 text-sm font-medium">
                        {p.calculations?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-bold text-sm text-right">
                        {getPricingTotalTons(p).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-3 text-stone-600 font-bold text-sm text-right whitespace-nowrap">
                        R$ {avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 font-black text-sm text-right whitespace-nowrap">
                        R$ {getPricingTotalSaleValue(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getApprovalColor(p.approvalStatus || 'Pendente')}`}>
                          {p.approvalStatus || 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredPricings.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-stone-500">
                      Nenhuma precificação encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-stone-500">
            Modo de visualização em cards em construção...
          </div>
        )}
      </div>

      {selectedPricing && (
        <PricingDetailModal
          selectedPricing={selectedPricing}
          currentUser={currentUser}
          onClose={() => setSelectedPricing(null)}
          onUpdateStatus={() => {}}
        />
      )}
    </div>
  );
}
