import React, { useState, useEffect } from 'react';
import { PricingRecord, User as AppUser, AppSettings } from '../types';
import { Search, FileText, Calendar, User, Tag, ChevronRight, Trash2, Edit3, Info, Truck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PricingDetailModal from './PricingDetailModal';
import { generatePricingPDF } from '../utils/pdfGenerator';
import { getPricingRecords, deletePricingRecord, updatePricingRecord, getAppSettings } from '../services/db';
import { useToast } from './Toast';

interface HistoryProps {
  onEdit?: (pricing: PricingRecord) => void;
  currentUser: AppUser;
}

export default function History({ onEdit, currentUser }: HistoryProps) {
  const { showSuccess, showError } = useToast();
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ companyName: 'FertCalc Pro', companyLogo: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    const [data, savedSettings] = await Promise.all([getPricingRecords(), getAppSettings()]);
    // Filter by user unless master/admin/manager
    if (currentUser.role === 'master' || currentUser.role === 'admin') {
      setPricings(data);
    } else if (currentUser.role === 'manager') {
      const managedIds = currentUser.managedUserIds || [];
      setPricings(data.filter((p: PricingRecord) => p.userId === currentUser.id || p.transferToUserId === currentUser.id || managedIds.includes(p.userId)));
    } else {
      setPricings(data.filter((p: PricingRecord) => p.userId === currentUser.id || p.transferToUserId === currentUser.id));
    }
    if (savedSettings?.companyName) setAppSettings(savedSettings);
    setLoading(false);
  };
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPricing, setSelectedPricing] = useState<PricingRecord | null>(null);
  // New states for deletion request
  const [isDeleting, setIsDeleting] = useState(false);
  const [pricingToDelete, setPricingToDelete] = useState<PricingRecord | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  // New state for showing deleted pricings
  const [showDeleted, setShowDeleted] = useState(false);

  const filteredPricings = pricings.filter(p => {
    const clientName = p.factors?.client?.name || '';
    const agentName = p.factors?.agent?.name || '';
    const matchesName = clientName.toLowerCase().includes(filter.toLowerCase()) ||
      agentName.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter ? p.status === statusFilter : true;

    // Date filter
    const pricingDate = new Date(p.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999); // Include the whole end day

    const matchesDate = (!start || pricingDate >= start) && (!end || pricingDate <= end);

    return matchesName && matchesStatus && matchesDate;
  });

  const stats = {
    total: pricings.length,
    inProgress: pricings.filter(p => p.status === 'Em Andamento').length,
    closed: pricings.filter(p => p.status === 'Fechada').length,
    lost: pricings.filter(p => p.status === 'Perdida').length,
    deleted: pricings.filter(p => p.status === 'Excluída').length,
    totalValue: pricings.filter(p => p.status === 'Fechada').reduce((sum, p) => sum + (p.summary.totalSaleValue || 0), 0),
    totalValueInProgress: pricings.filter(p => p.status === 'Em Andamento').reduce((sum, p) => sum + (p.summary.totalSaleValue || 0), 0),
    totalTonsClosed: pricings.filter(p => p.status === 'Fechada').reduce((sum, p) => sum + (p.factors?.totalTons || 0), 0),
    totalTonsInProgress: pricings.filter(p => p.status === 'Em Andamento').reduce((sum, p) => sum + (p.factors?.totalTons || 0), 0)
  };

  const exportConsolidatedReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    if (appSettings.companyLogo) {
      doc.addImage(appSettings.companyLogo, 'PNG', 10, 10, 20, 20);
    }
    doc.setFontSize(16);
    doc.text(appSettings.companyName, appSettings.companyLogo ? 35 : 10, 20);
    doc.setFontSize(12);
    doc.text('Relatório Consolidado de Precificações', 10, 35);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} `, 10, 40);
    doc.text(`Usuário: ${currentUser.name} (${currentUser.customCode})`, 10, 45);
    doc.line(10, 48, pageWidth - 10, 48);

    const tableBody = filteredPricings.map(p => [
      new Date(p.date).toLocaleDateString('pt-BR'),
      p.factors?.client?.name || 'N/A',
      p.status,
      p.factors?.targetFormula || '---',
      `R$ ${p.summary?.finalPrice?.toFixed(2) || '0.00'}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Data', 'Cliente', 'Status', 'Ref', 'Preço Final']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [41, 37, 36] }
    });

    const totalValue = filteredPricings.filter(p => p.status === 'Fechada').reduce((sum, p) => sum + (p.summary?.finalPrice || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total em Vendas Fechadas: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, 10, finalY);

    doc.save(`Relatorio_Consolidado_${new Date().getTime()}.pdf`);
  };

  const handleDelete = async (id: string) => {
    const pricing = pricings.find(p => p.id === id);
    if (!pricing) return;

    if (pricing.approvalStatus === 'Aprovada') {
      setPricingToDelete(pricing);
      setIsDeleting(true);
      return;
    }

    if (confirm('Deseja realmente excluir esta precificação?')) {
      try {
        await deletePricingRecord(id);
        setPricings(pricings.filter(p => p.id !== id));
        showSuccess('Precificação excluída com sucesso!');
      } catch (err) {
        showError('Erro ao excluir precificação.');
      }
    }
  };

  const handleRequestDeletion = async () => {
    if (!pricingToDelete || !deletionReason.trim()) return;

    try {
      const historyEntry = {
        date: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        action: `Solicitada exclusão: ${deletionReason}`
      };

      await updatePricingRecord(pricingToDelete.id, {
        deletionRequest: {
          reason: deletionReason,
          requestedBy: currentUser.id,
          userName: currentUser.name,
          date: new Date().toISOString(),
          status: 'Pendente'
        },
        history: [...(pricingToDelete.history || []), historyEntry]
      } as any);

      // Notify managers
      await createNotification({
        userId: '', // Broad
        title: 'Solicitação de Exclusão de Precificação',
        message: `${currentUser.name} solicitou a exclusão da precificação ${pricingToDelete.formattedCod}. Motivo: ${deletionReason}`,
        date: new Date().toISOString(),
        read: false,
        type: 'pricing_deletion_request',
        dataId: pricingToDelete.id
      });

      showSuccess('Solicitação de exclusão enviada para aprovação!');
      setIsDeleting(false);
      setDeletionReason('');
      setPricingToDelete(null);
      // Refresh local state to show pending deletion if needed
      setPricings(pricings.map(p => p.id === pricingToDelete.id ? {
        ...p,
        deletionRequest: {
          reason: deletionReason,
          requestedBy: currentUser.id,
          userName: currentUser.name,
          date: new Date().toISOString(),
          status: 'Pendente'
        }
      } as any : p));
    } catch (err) {
      showError('Erro ao enviar solicitação de exclusão.');
    }
  };

  const updateStatus = async (id: string, newStatus: PricingRecord['status']) => {
    const historyEntry = { date: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name, action: `Status alterado para: ${newStatus} ` };
    try {
      const record = pricings.find(p => p.id === id);
      await updatePricingRecord(id, { status: newStatus, history: [...(record?.history || []), historyEntry] });
      await loadData();
      if (selectedPricing?.id === id) {
        const updated = pricings.find(p => p.id === id);
        if (updated) setSelectedPricing({ ...updated, status: newStatus });
      }
    } catch {
      showError('Erro ao atualizar status.');
    }
  };

  const updateApprovalStatus = async (id: string, newStatus: PricingRecord['approvalStatus']) => {
    if (!confirm(`Deseja realmente ${newStatus?.toLowerCase()} esta precificação ? `)) return;
    const historyEntry = { date: new Date().toISOString(), userId: currentUser.id, userName: currentUser.name, action: `Aprovação alterada para: ${newStatus} ` };
    try {
      const record = pricings.find(p => p.id === id);
      await updatePricingRecord(id, { approvalStatus: newStatus, history: [...(record?.history || []), historyEntry] });
      await loadData();
      if (selectedPricing?.id === id) {
        const updated = pricings.find(p => p.id === id);
        if (updated) setSelectedPricing({ ...updated, approvalStatus: newStatus });
      }
    } catch {
      showError('Erro ao atualizar aprovação.');
    }
  };

  const refreshPricings = () => { loadData(); };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fechada': return 'bg-emerald-100 text-emerald-800';
      case 'Perdida': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-black text-stone-800">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Em Aberto (Tons)</p>
          <p className="text-2xl font-black text-blue-600">{stats.totalTonsInProgress.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Fechadas (Tons)</p>
          <p className="text-2xl font-black text-emerald-600">{stats.totalTonsClosed.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Perdidas</p>
          <p className="text-2xl font-black text-red-600">{stats.lost}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Valor Em Aberto</p>
          <p className="text-xl font-black text-blue-600">R$ {stats.totalValueInProgress.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Faturamento (Fechada)</p>
          <p className="text-xl font-black text-emerald-700">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-stone-800">Situação das Precificações</h2>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-500 uppercase">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-500 uppercase">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => exportConsolidatedReport()}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-900 transition-colors text-sm whitespace-nowrap"
            >
              <FileText className="w-4 h-4" /> Relatório Consolidado
            </button>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar cliente ou agente..."
                value={filter || ''}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Todos os Status</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Fechada">Fechada</option>
              <option value="Perdida">Perdida</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPricings
          .filter(p => showDeleted ? p.status === 'Excluída' : p.status !== 'Excluída')
          .map(p => (
            <div key={p.id} id={`pricing-card-${p.id}`} className={`bg-white rounded-xl shadow-sm border ${p.status === 'Excluída' ? 'border-red-100 opacity-75' : 'border-stone-200 hover:shadow-md'} transition-shadow cursor-pointer relative`} onClick={() => setSelectedPricing(p)}>
              {p.transferToUserId && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-tighter rounded-bl-lg shadow-sm z-10 animate-pulse">
                  {p.transferToUserId === currentUser.id ? 'PENDENTE ACEITE' : 'TRANSFERÊNCIA ENVIADA'}
                </div>
              )}
              {p.deletionRequest?.status === 'Pendente' && (
                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold py-1 px-3 flex items-center justify-center gap-2 z-10">
                  <AlertTriangle className="w-3 h-3" /> Exclusão Pendente de Aprovação
                </div>
              )}
              <div className="p-5 border-b border-stone-100">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-stone-800 flex items-center flex-wrap gap-1">
                      <User className="w-4 h-4 text-stone-400" />
                      <span className="text-emerald-600 font-mono text-sm mr-1">#{p.factors?.client?.code || '---'}</span>
                      {p.factors?.client?.name || 'Cliente não identificado'}
                    </h3>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] font-bold text-stone-400 uppercase">IE: {p.factors?.client?.stateRegistration || '---'}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Precificação: {p.formattedCod}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>
                    {p.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-stone-600 mt-4">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-stone-400" />
                    Geração: {new Date(p.date).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-emerald-500" />
                    Vencimento: <span className="ml-1 font-medium">{p.factors?.dueDate ? new Date(p.factors.dueDate).toLocaleDateString('pt-BR') : '---'}</span>
                  </div>
                  <div className="flex items-center">
                    <Truck className="w-4 h-4 mr-2 text-stone-400" />
                    Frete: <span className="ml-1 font-medium">{(p.factors?.freight || 0) > 0 ? `CIF (R$ ${p.factors?.freight?.toFixed(2)})` : 'FOB'}</span>
                  </div>
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 mr-2 text-stone-400" />
                    Aprovação: <span className={`ml-1 font-bold ${p.approvalStatus === 'Aprovada' ? 'text-emerald-600' :
                      p.approvalStatus === 'Reprovada' ? 'text-red-600' :
                        'text-amber-600'
                      }`}>{p.approvalStatus || 'Pendente'}</span>
                  </div>
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 mr-2 text-stone-400" />
                    Fórmulas: <span className="ml-1 font-bold text-emerald-600">
                      {p.calculations?.length || 0} precificadas
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {p.calculations?.map((calc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-stone-50 px-2 py-1 rounded text-[10px] border border-stone-100">
                        <span className="font-bold text-stone-600">{calc.formula}</span>
                        <span className="text-emerald-600 font-mono">R$ {calc.summary?.finalPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {p.factors?.commercialObservation && (
                    <div className="flex items-start mt-2 p-2 bg-stone-50 rounded border border-stone-100 italic text-stone-500 text-[10px] line-clamp-2">
                      <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                      {p.factors.commercialObservation}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-stone-50 p-5 flex justify-between items-center">
                <div>
                  <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">Venda Total ({p.factors?.totalTons || 0} tons)</p>
                  <p className="text-xl font-bold text-emerald-600">
                    R$ {(Number(p.summary?.totalSaleValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-stone-400">Tonnage: {(p.factors?.totalTons || 0).toFixed(1)} t | R$ {Number(p.summary?.finalPrice || 0).toFixed(2)} / ton</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.status !== 'Excluída' && (p.status === 'Em Andamento' && (currentUser.permissions as any)?.history_editPricing !== false && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEdit) onEdit(p);
                      }}
                      className="p-2.5 hover:bg-blue-100 text-blue-600 rounded-full transition-all active:scale-95 bg-blue-50/50"
                      title="Editar"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  ))}
                  {(p.status !== 'Excluída' && (currentUser.role === 'master' || currentUser.role === 'admin' || (currentUser.permissions as any)?.history_changeStatus !== false)) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="p-2.5 hover:bg-red-100 text-red-600 rounded-full transition-all active:scale-95 bg-red-50/50"
                      title={p.approvalStatus === 'Aprovada' ? "Solicitar Exclusão" : "Excluir"}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <ChevronRight className="w-6 h-6 text-stone-300 ml-1" />
                </div>
              </div>
            </div>
          ))}

        {filteredPricings.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-stone-200 border-dashed">
            <FileText className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-900 mb-1">Nenhuma precificação encontrada</h3>
            <p className="text-stone-500">Ajuste os filtros ou crie uma nova precificação na calculadora.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPricing && (
        <PricingDetailModal
          selectedPricing={selectedPricing}
          currentUser={currentUser}
          onClose={() => setSelectedPricing(null)}
          onEdit={onEdit}
          onDelete={handleDelete}
          onUpdateStatus={updateStatus}
          onUpdateApproval={async (id, status) => {
            await updateApprovalStatus(id, status);
            setPricings(pricings.map(p => p.id === id ? { ...p, approvalStatus: status } : p));
          }}
          onSaveObservation={loadData}
          onTransferSuccess={loadData}
          appSettings={appSettings}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Solicitar Exclusão
              </h3>
              <button onClick={() => setIsDeleting(false)} className="text-stone-400 hover:text-stone-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-stone-600 mb-4 font-medium italic">
                A precificação "{pricingToDelete?.formattedCod}" já está aprovada. Para excluí-la, você deve fornecer uma justificativa que será enviada para aprovação gerencial.
              </p>
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">Justificativa da Exclusão</label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Explique o motivo da exclusão desta precificação aprovada..."
                className="w-full p-4 bg-stone-50 border-2 border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[120px] transition-all"
                autoFocus
              />
            </div>
            <div className="p-6 bg-stone-50 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setIsDeleting(false)}
                className="flex-1 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!deletionReason.trim()}
                onClick={handleRequestDeletion}
                className="flex-1 px-4 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-red-200"
              >
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
