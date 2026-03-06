import React, { useState } from 'react';
import { PricingRecord, User, AppSettings } from '../types';
import { X, Edit3, Trash2, Info, FileDown, Download, FileSpreadsheet, Tag } from 'lucide-react';
import { generatePricingPDF, generateSimplifiedPDF } from '../utils/pdfGenerator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNPK } from '../utils/formatters';
import { updatePricingRecord, getUsers, transferPricingRecord, acceptPricingTransfer } from '../services/db';
import { useToast } from './Toast';
import { Send, UserCheck, CheckCircle2 } from 'lucide-react';

interface PricingDetailModalProps {
  selectedPricing: PricingRecord;
  currentUser: User;
  onClose: () => void;
  onEdit?: (pricing: PricingRecord) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: 'Em Andamento' | 'Fechada' | 'Perdida') => void;
  onUpdateApproval?: (id: string, status: 'Aprovada' | 'Reprovada') => void;
  onSaveObservation?: () => void;
  onTransferSuccess?: () => void;
  appSettings?: AppSettings;
}

export default function PricingDetailModal({
  selectedPricing, currentUser, onClose, onEdit, onDelete,
  onUpdateStatus, onUpdateApproval, onSaveObservation, onTransferSuccess,
  appSettings = { companyName: 'FertCalc Pro', companyLogo: '' }
}: PricingDetailModalProps) {
  const { showSuccess, showError } = useToast();
  const [commercialObservation, setCommercialObservation] = useState(selectedPricing.factors?.commercialObservation || '');
  const [showAgentInPDF, setShowAgentInPDF] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [availableSellers, setAvailableSellers] = useState<User[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isAcceptingTransfer, setIsAcceptingTransfer] = useState(false);

  React.useEffect(() => {
    if (isTransferring) {
      loadSellers();
    }
  }, [isTransferring]);

  const loadSellers = async () => {
    try {
      const users = await getUsers();
      // Filter for sellers (role: user or similar, exclude current user)
      setAvailableSellers(users.filter(u => u.id !== currentUser.id && (u.role === 'user' || u.role === 'manager')));
    } catch {
      showError('Erro ao carregar lista de vendedores.');
    }
  };

  const handleTransfer = async () => {
    if (!selectedSellerId) {
      showError('Selecione um vendedor para transferir.');
      return;
    }

    const seller = availableSellers.find(s => s.id === selectedSellerId);
    if (!seller) return;

    if (!confirm(`Deseja realmente transferir esta precificação para ${seller.name}? Você ainda poderá vê-la até que ele aceite, mas após o aceite ela sairá da sua lista.`)) return;

    setLoadingTransfer(true);
    try {
      await transferPricingRecord(selectedPricing.id, seller.id, seller.name, currentUser);
      showSuccess('Transferência iniciada com sucesso!');
      setIsTransferring(false);
      if (onTransferSuccess) onTransferSuccess();
    } catch (err) {
      showError('Erro ao processar transferência.');
    } finally {
      setLoadingTransfer(false);
    }
  };

  const handleAcceptTransfer = async () => {
    if (!confirm('Deseja aceitar esta precificação ? Ela será movida definitivamente para sua lista.')) return;

    setLoadingTransfer(true);
    try {
      await acceptPricingTransfer(selectedPricing.id, currentUser);
      showSuccess('Precificação aceita com sucesso!');
      if (onTransferSuccess) onTransferSuccess();
      onClose();
    } catch (err) {
      showError('Erro ao aceitar transferência.');
    } finally {
      setLoadingTransfer(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fechada': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Perdida': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const saveCommercialObservation = async () => {
    try {
      await updatePricingRecord(selectedPricing.id, {
        factors: { ...selectedPricing.factors, commercialObservation }
      } as any);
      showSuccess('Observação salva com sucesso!');
      if (onSaveObservation) onSaveObservation();
    } catch {
      showError('Erro ao salvar observação.');
    }
  };

  const handleUpdateApproval = async (status: 'Aprovada' | 'Reprovada') => {
    if (status === 'Reprovada' && !isRejecting) {
      setIsRejecting(true);
      return;
    }

    if (status === 'Reprovada' && !rejectionReason.trim()) {
      showError('Informe o motivo da reprovação.');
      return;
    }

    if (onUpdateApproval) {
      const historyEntry = {
        date: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        action: `Precificação ${status}${status === 'Reprovada' ? `: ${rejectionReason}` : ''}`
      };

      try {
        await updatePricingRecord(selectedPricing.id, {
          approvalStatus: status,
          history: [...(selectedPricing.history || []), historyEntry]
        } as any);

        await createNotification({
          userId: selectedPricing.userId,
          title: `Precificação ${status === 'Aprovada' ? 'Aprovada' : 'Reprovada'}`,
          message: `Sua precificação para ${selectedPricing.factors.client.name} foi ${status.toLowerCase()}.${status === 'Reprovada' ? ` Motivo: ${rejectionReason}` : ''}`,
          date: new Date().toISOString(),
          read: false,
          type: 'pricing_approval',
        });

        showSuccess(`Precificação ${status === 'Aprovada' ? 'aprovada' : 'reprovada'} com sucesso!`);
        onUpdateApproval(selectedPricing.id, status);
        setIsRejecting(false);
        setRejectionReason('');
      } catch (err) {
        showError('Erro ao atualizar status de aprovação.');
      }
    }
  };

  const exportToPDF = (pricing: PricingRecord) => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(appSettings.companyName, 14, 22);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date(pricing.date).toLocaleDateString()}`, 14, 30);

    // Client Info Table
    autoTable(doc, {
      startY: 40,
      head: [['Item', 'Detalhe']],
      body: [
        ['Cliente', pricing.factors?.client?.name || 'N/A'],
        ['Documento', pricing.factors?.client?.document || 'N/A'],
        ['Agente', pricing.factors?.agent?.name || 'N/A'],
        ['Status', pricing.status],
        ['Aprovação', pricing.approvalStatus || 'Pendente']
      ],
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Iterate over calculations
    const calcs = pricing.calculations && pricing.calculations.length > 0 ? pricing.calculations : [pricing];

    calcs.forEach((calc, idx) => {
      if (idx > 0 && currentY > 200) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Fórmula: ${calc.formula || pricing.factors.targetFormula}`, 14, currentY);
      currentY += 5;

      // Products
      const productsData = [...(calc.macros || pricing.macros), ...(calc.micros || pricing.micros)]
        .filter(p => p.quantity > 0)
        .map(p => [p.name, `${p.quantity} kg`, `R$ ${p.price}`, `R$ ${((p.quantity / 1000) * p.price).toFixed(2)}`]);

      autoTable(doc, {
        startY: currentY,
        head: [['Produto', 'Qtd', 'Preço/ton', 'Total']],
        body: productsData,
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // Totals
      autoTable(doc, {
        startY: currentY,
        head: [['Resumo Financeiro', 'Valor']],
        body: [
          ['Custo Base', `R$ ${calc.summary?.baseCost.toFixed(2) || pricing.summary.baseCost.toFixed(2)}`],
          ['Preço Final', `R$ ${calc.summary?.finalPrice.toFixed(2) || pricing.summary.finalPrice.toFixed(2)}`],
          ['N-P-K Real', formatNPK(calc.formula, calc.summary?.resultingN || 0, calc.summary?.resultingP || 0, calc.summary?.resultingK || 0)],
        ],
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save(`precificacao_${pricing.id}.pdf`);
  };

  const exportToExcel = (pricing: PricingRecord) => {
    const calcs = pricing.calculations && pricing.calculations.length > 0 ? pricing.calculations : [pricing];

    const wsData = [
      ['RELATÓRIO DE PRECIFICAÇÃO'],
      ['Empresa', appSettings.companyName],
      ['ID', pricing.id],
      ['Data', new Date(pricing.date).toLocaleString('pt-BR')],
      ['Status', pricing.status],
      [''],
      ['CLIENTE'],
      ['Nome', pricing.factors?.client?.name || 'N/A'],
      ['Documento', pricing.factors?.client?.document || 'N/A'],
      [''],
      ['AGENTE'],
      ['Nome', pricing.factors?.agent?.name || 'N/A'],
      [''],
    ];

    calcs.forEach((calc, idx) => {
      wsData.push(
        [`FÓRMULA ${idx + 1}: ${calc.formula || pricing.factors.targetFormula}`],
        ['COMPOSIÇÃO'],
        ['Produto', 'Qtd (kg)', 'Preço (R$/ton)', 'Subtotal (R$)']
      );

      const materials = [...(calc.macros || pricing.macros), ...(calc.micros || pricing.micros)].filter(p => p.quantity > 0);
      materials.forEach(p => {
        wsData.push([p.name, p.quantity, p.price, (p.quantity / 1000) * p.price]);
      });

      wsData.push(
        ['RESUMO FINANCEIRO'],
        ['Custo Base', calc.summary?.baseCost || pricing.summary.baseCost],
        ['PREÇO FINAL', calc.summary?.finalPrice || pricing.summary.finalPrice],
        ['Garantia N', calc.summary?.resultingN || pricing.summary.resultingN],
        ['Garantia P', calc.summary?.resultingP || pricing.summary.resultingP],
        ['Garantia K', calc.summary?.resultingK || pricing.summary.resultingK],
        ['']
      );
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precificação');
    XLSX.writeFile(wb, `Precificacao_${pricing.factors?.client?.name || 'Sem_Nome'}_${pricing.formattedCod}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Detalhes da Precificação</h2>
            <p className="text-sm text-stone-500">COD: <span className="font-bold text-emerald-600">{selectedPricing.formattedCod}</span> | Data: {new Date(selectedPricing.date).toLocaleString('pt-BR')}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPricing.status === 'Em Andamento' && onEdit && (
              <button
                onClick={() => {
                  onEdit(selectedPricing);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all active:scale-95"
                title="Editar na Calculadora"
              >
                <Edit3 className="w-4 h-4" /> Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta precificação?')) {
                    onDelete(selectedPricing.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition-all active:scale-95"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Accept Transfer Button */}
            {selectedPricing.transferToUserId === currentUser.id && (
              <button
                onClick={handleAcceptTransfer}
                disabled={isAcceptingTransfer}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4" /> Aceitar Transferência
              </button>
            )}

            {/* Transfer Button */}
            {selectedPricing.userId === currentUser.id && !selectedPricing.transferToUserId && (
              <button
                onClick={() => setIsTransferring(!isTransferring)}
                className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-all active:scale-95 ${isTransferring ? 'bg-amber-100 text-amber-700' : 'bg-stone-800 text-white hover:bg-stone-900'}`}
              >
                <Send className="w-4 h-4" /> Transferir
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-200 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-stone-600" />
            </button>
          </div>
        </div>

        {/* Transfer Selection Form */}
        {isTransferring && (
          <div className="bg-amber-50 p-6 border-b border-amber-200 animate-in slide-in-from-top-4 duration-300">
            <div className="max-w-xl mx-auto flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="block text-sm font-bold text-amber-800 uppercase tracking-wider">Transferir para Vendedor</label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-700"
                >
                  <option value="">Selecione um vendedor...</option>
                  {availableSellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.customCode})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTransfer}
                  disabled={isAcceptingTransfer || !selectedSellerId}
                  className="px-6 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 disabled:bg-amber-300 transition-all shadow-lg shadow-amber-200 active:scale-95"
                >
                  {isAcceptingTransfer ? 'Transferindo...' : 'Confirmar Envio'}
                </button>
                <button
                  onClick={() => setIsTransferring(false)}
                  className="px-4 py-2 bg-white text-stone-600 font-bold rounded-lg border border-amber-300 hover:bg-amber-100 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Approval Section for Managers */}
          {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.history_changeStatus !== false) &&
            onUpdateApproval &&
            selectedPricing.approvalStatus === 'Pendente' && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-sm font-bold text-amber-800 uppercase block">Aprovação do Gerente</span>
                    <p className="text-xs text-amber-600">Esta ação é definitiva e não poderá ser alterada após o clique.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isRejecting ? (
                    <>
                      <button
                        onClick={() => handleUpdateApproval('Aprovada')}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Aprovar
                      </button>
                      <button
                        onClick={() => handleUpdateApproval('Reprovada')}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Reprovar
                      </button>
                    </>
                  ) : (
                    <div className="w-full space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-red-600 uppercase tracking-widest">Motivo da Reprovação</label>
                        <button onClick={() => setIsRejecting(false)} className="text-stone-400 hover:text-stone-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual esta precificação foi rejeitada..."
                        className="w-full p-3 border-2 border-red-100 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[100px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsRejecting(false)}
                          className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 font-bold rounded-lg hover:bg-stone-200"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleUpdateApproval('Reprovada')}
                          className="flex-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                        >
                          Confirmar Reprovação
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {selectedPricing.approvalStatus !== 'Pendente' && (
            <div className={`p-4 rounded-xl border flex items-center justify-between ${selectedPricing.approvalStatus === 'Aprovada' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                <span className="text-sm font-bold uppercase">Precificação {selectedPricing.approvalStatus}</span>
              </div>
              <p className="text-xs opacity-75">A decisão de aprovação já foi registrada e não pode ser alterada.</p>
            </div>
          )}

          {/* Status Change */}
          {onUpdateStatus && ((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.history_changeStatus !== false) && (
            <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 flex items-center justify-between">
              <span className="text-sm font-bold text-stone-600 uppercase">Alterar Status</span>
              <select
                value={selectedPricing.status}
                onChange={(e) => onUpdateStatus(selectedPricing.id, e.target.value as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 focus:ring-2 focus:ring-stone-500 outline-none ${getStatusColor(selectedPricing.status)}`}
              >
                <option value="Em Andamento">Em Andamento</option>
                <option value="Fechada">Fechada</option>
                <option value="Perdida">Perdida</option>
              </select>
            </div>
          )}

          {selectedPricing.status !== 'Em Andamento' && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 text-amber-800 text-sm">
              <Info className="w-5 h-5 flex-shrink-0" />
              <p>Para editar esta precificação, altere o status para <strong>Em Andamento</strong>.</p>
            </div>
          )}
          {/* Client & Agent Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">Cliente</h3>
              <p className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <span className="text-emerald-600 font-mono text-sm">#{selectedPricing.factors?.client?.code || '---'}</span>
                {selectedPricing.factors?.client?.name || 'Cliente não identificado'}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-stone-600">Documento: {selectedPricing.factors?.client?.document || 'N/A'}</p>
                <p className="text-sm text-stone-600">IE: {selectedPricing.factors?.client?.stateRegistration || '---'}</p>
                <p className="text-sm text-stone-600 font-medium">Fazenda: {selectedPricing.factors?.client?.fazenda || '---'}</p>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Agente</h3>
              <p className="text-lg font-bold text-stone-800">{selectedPricing.factors?.agent?.name || 'Agente não identificado'}</p>
              <p className="text-sm text-stone-600">Documento: {selectedPricing.factors?.agent?.document || 'N/A'}</p>
              <p className="text-sm font-medium text-blue-600 mt-1">Comissão: {selectedPricing.factors?.commission || 0}% (R$ {(selectedPricing.summary?.commissionValue || 0).toFixed(2)})</p>
            </div>
          </div>

          {/* Calculations Sections */}
          <div className="space-y-12">
            {(selectedPricing.calculations && selectedPricing.calculations.length > 0 ? selectedPricing.calculations : [selectedPricing]).map((calc, calcIdx) => (
              <div key={calcIdx} className="space-y-6 p-6 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="flex justify-between items-center border-b border-stone-200 pb-4">
                  <h3 className="text-xl font-black text-emerald-700 uppercase tracking-tight">
                    Fórmula: {calc.formula || 'N/A'}
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Preço Final</p>
                    <p className="text-lg font-bold text-emerald-600 font-mono">R$ {calc.summary?.finalPrice.toFixed(2)} / ton</p>
                  </div>
                </div>

                {/* Products Table */}
                <div>
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" /> Composição da Batida
                  </h4>
                  <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3 text-right">Qtd (kg)</th>
                          <th className="px-4 py-3 text-right">Preço (R$/ton)</th>
                          <th className="px-4 py-3 text-right">Subtotal (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {[...(calc.macros || []), ...(calc.micros || [])].filter(p => p.quantity > 0).map(p => (
                          <tr key={p.id}>
                            <td className="px-4 py-3 font-medium text-stone-800">{p.name}</td>
                            <td className="px-4 py-3 text-right font-mono">{Number(p.quantity).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">R$ {Number(p.price).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">R$ {((Number(p.quantity) / 1000) * Number(p.price)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-stone-50 font-bold">
                        <tr>
                          <td className="px-4 py-3">TOTAL DA BATIDA</td>
                          <td className="px-4 py-3 text-right font-mono">{calc.summary?.totalWeight.toFixed(2)} kg</td>
                          <td></td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600">R$ {calc.summary?.baseCost.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-4 rounded-xl border border-stone-200">
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Detalhamento de Valores</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Valor Matéria Prima (Base)</span>
                        <span className="font-mono font-medium">R$ {Number(calc.summary?.baseCost).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Ajuste Fator ({calc.factors?.factor})</span>
                        <span className="font-mono font-medium">R$ {(Number(calc.summary?.baseCost) * (calc.factors?.factor || 1)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Margem Rentabilidade (R$/ton)</span>
                        <span className="font-mono font-medium">+ R$ {Number(calc.factors?.margin || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Desconto (R$/ton)</span>
                        <span className="font-mono font-medium text-red-500">- R$ {Number(calc.factors?.discount || 0).toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex justify-between font-bold text-stone-800">
                        <span>Preço Base de Venda</span>
                        <span className="font-mono">R$ {Number(calc.summary?.basePrice).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-stone-200">
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Acréscimos e Encargos</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Frete (R$/ton)</span>
                        <span className="font-mono font-medium">+ R$ {Number(calc.summary?.freightValue).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Juros de Vencimento</span>
                        <span className="font-mono font-medium">+ R$ {Number(calc.summary?.interestValue).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Alíquota de Impostos ({calc.factors?.taxRate}%)</span>
                        <span className="font-mono font-medium">+ R$ {Number(calc.summary?.taxValue).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Comissão do Agente ({calc.factors?.commission}%)</span>
                        <span className="font-mono font-medium">+ R$ {Number(calc.summary?.commissionValue).toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex justify-between text-xl font-black text-emerald-600">
                        <span>PREÇO FINAL</span>
                        <span className="font-mono">R$ {Number(calc.summary?.finalPrice).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guarantees Summary */}
                <div className="bg-stone-900 text-white p-6 rounded-2xl">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Garantias Finais</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">NITROGÊNIO (N)</p>
                      <p className="text-xl font-mono font-bold">{Number(calc.summary?.resultingN).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">FÓSFORO (P)</p>
                      <p className="text-xl font-mono font-bold">{Number(calc.summary?.resultingP).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">POTÁSSIO (K)</p>
                      <p className="text-xl font-mono font-bold">{Number(calc.summary?.resultingK).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">ENXOFRE (S)</p>
                      <p className="text-xl font-mono font-bold">{Number(calc.summary?.resultingS).toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">CÁLCIO (Ca)</p>
                      <p className="text-xl font-mono font-bold">{Number(calc.summary?.resultingCa).toFixed(2)}%</p>
                    </div>
                  </div>
                  {calc.summary?.resultingMicros && Object.keys(calc.summary.resultingMicros).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-stone-800 flex flex-wrap gap-4 justify-center">
                      {Object.entries(calc.summary.resultingMicros).map(([name, val]) => (
                        <div key={name} className="flex items-center gap-2 px-3 py-1 bg-stone-800 rounded-full">
                          <span className="text-[10px] font-bold text-stone-500">{name}:</span>
                          <span className="text-sm font-mono font-bold">{(val as number).toFixed(3)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Commercial Observation */}
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">Observação Comercial</h3>
            <textarea
              value={commercialObservation}
              onChange={(e) => setCommercialObservation(e.target.value)}
              className="w-full h-24 p-2 border border-stone-300 rounded-lg text-sm mb-2"
              placeholder="Adicione observações sobre a negociação, cliente, etc."
            />
            <button
              onClick={saveCommercialObservation}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all"
            >
              Salvar Observação
            </button>
          </div>

          {/* History Section */}
          {selectedPricing.history && selectedPricing.history.length > 0 && (
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">Histórico de Alterações</h3>
              <div className="space-y-4">
                {selectedPricing.history.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 text-sm border-l-2 border-stone-200 pl-4 py-1">
                    <div className="flex-1">
                      <p className="text-stone-800 font-medium">{entry.action}</p>
                      <p className="text-[10px] text-stone-500">
                        Por: {entry.userName} em {new Date(entry.date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-stone-200 bg-stone-50 flex justify-between items-center">
          <div className="flex gap-2">
            {((currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager') || (currentUser.permissions as any)?.calculator_generatePDF !== false) && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showAgentInPDF}
                    onChange={(e) => setShowAgentInPDF(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-stone-600 uppercase">Exibir Representante no PDF</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => generatePricingPDF(selectedPricing, appSettings, showAgentInPDF)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-700 text-white font-bold rounded-lg hover:bg-stone-800 transition-colors text-sm"
                  >
                    <FileDown className="w-4 h-4" /> PDF Simplificado
                  </button>
                  <button
                    onClick={() => exportToPDF(selectedPricing)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() => exportToExcel(selectedPricing)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-700 transition-colors">
            Fechar Detalhes
          </button>
        </div>
      </div >
    </div >
  );
}
