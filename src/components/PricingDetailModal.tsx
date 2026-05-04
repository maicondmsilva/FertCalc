import React, { useState, useEffect } from 'react';
import { PricingRecord, User, AppSettings, PedidoVenda } from '../types';
import {
  X,
  Edit3,
  Trash2,
  Info,
  FileDown,
  Download,
  FileSpreadsheet,
  Tag,
  FileText,
  CheckCircle as CheckCircleIcon,
} from 'lucide-react';
import { generatePricingPDF } from '../utils/pdfGenerator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNPK } from '../utils/formatters';
import {
  updatePricingRecord,
  getUsers,
  transferPricingRecord,
  acceptPricingTransfer,
  createNotification,
} from '../services/db';
import {
  getPedidoVendaByPrecificacao,
  createPedidoVenda,
  updatePedidoVenda,
} from '../services/pedidosVendaService';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { Send, UserCheck, CheckCircle2, CheckCircle, XCircle } from 'lucide-react';
import { notifyTransferInitiated, notifyTransferAccepted } from '../services/notificationService';

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
  selectedPricing,
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
  onUpdateApproval,
  onSaveObservation,
  onTransferSuccess,
  appSettings = { companyName: 'FertCalc Pro', companyLogo: '' },
}: PricingDetailModalProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [commercialObservation, setCommercialObservation] = useState(
    selectedPricing.factors?.commercialObservation || ''
  );
  const [showAgentInPDF, setShowAgentInPDF] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [availableSellers, setAvailableSellers] = useState<User[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isAcceptingTransfer, setIsAcceptingTransfer] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  // Pedido de Venda state
  const [pedidoVenda, setPedidoVenda] = useState<PedidoVenda | null>(null);
  const [showPdfImportModal, setShowPdfImportModal] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    numero_pedido: string;
    barra_pedido: string;
    data_pedido: string;
    quantidade_real: string;
    embalagem: string;
    valor_unitario_negociado: string;
    valor_total_negociado: string;
    tipo_frete: string;
    valor_frete: string;
  } | null>(null);
  const [savingPedido, setSavingPedido] = useState(false);

  React.useEffect(() => {
    if (isTransferring) {
      loadSellers();
    }
  }, [isTransferring]);

  // Load existing pedido de venda
  useEffect(() => {
    getPedidoVendaByPrecificacao(selectedPricing.id).then(setPedidoVenda);
  }, [selectedPricing.id]);

  const handleOpenManualPedido = () => {
    const freight = selectedPricing.factors?.freight ?? 0;
    const tipoFrete = selectedPricing.factors?.tipoFrete ?? (freight > 0 ? 'CIF' : 'FOB');

    setExtractedData({
      numero_pedido: pedidoVenda?.numero_pedido ?? '',
      barra_pedido: pedidoVenda?.barra_pedido ?? '',
      data_pedido: pedidoVenda?.data_pedido ?? new Date().toISOString().slice(0, 10),
      quantidade_real: pedidoVenda?.quantidade_real != null
        ? String(pedidoVenda.quantidade_real)
        : '',
      embalagem: pedidoVenda?.embalagem ?? '',
      valor_unitario_negociado: pedidoVenda?.valor_unitario_negociado != null
        ? String(pedidoVenda.valor_unitario_negociado)
        : '',
      valor_total_negociado: pedidoVenda?.valor_total_negociado != null
        ? String(pedidoVenda.valor_total_negociado)
        : '',
      tipo_frete: pedidoVenda?.tipo_frete ?? tipoFrete,
      valor_frete: pedidoVenda?.valor_frete != null
        ? String(pedidoVenda.valor_frete)
        : freight > 0 ? String(freight) : '',
    });
    setShowPdfImportModal(true);
};

  const handleSavePedido = async () => {
    if (!extractedData) return;
    setSavingPedido(true);
    try {
      const pedidoData = {
        precificacao_id: selectedPricing.id,
        numero_pedido: extractedData.numero_pedido || undefined,
        barra_pedido: extractedData.barra_pedido || undefined,
        data_pedido: extractedData.data_pedido || undefined,
        quantidade_real: extractedData.quantidade_real
          ? parseFloat(extractedData.quantidade_real)
          : undefined,
        embalagem: extractedData.embalagem || undefined,
        valor_unitario_negociado: extractedData.valor_unitario_negociado
          ? parseFloat(extractedData.valor_unitario_negociado)
          : undefined,
        valor_total_negociado: extractedData.valor_total_negociado
          ? parseFloat(extractedData.valor_total_negociado)
          : undefined,
        tipo_frete: extractedData.tipo_frete || undefined,
        valor_frete: extractedData.valor_frete ? parseFloat(extractedData.valor_frete) : undefined,
        status: 'pendente' as const,
        importado_por: currentUser.id,
        dados_extraidos: extractedData as any,
      };

      if (pedidoVenda) {
        await updatePedidoVenda(pedidoVenda.id, pedidoData);
      } else {
        const novo = await createPedidoVenda(pedidoData);
        setPedidoVenda(novo);
      }
      showSuccess('Pedido de Venda vinculado com sucesso!');
      setShowPdfImportModal(false);
      setExtractedData(null);
      // Reload pedido
      const updated = await getPedidoVendaByPrecificacao(selectedPricing.id);
      setPedidoVenda(updated);
    } catch (err) {
      showError('Erro ao salvar pedido de venda.');
    } finally {
      setSavingPedido(false);
    }
  };

  const loadSellers = async () => {
    try {
      const users = await getUsers();
      // Filter for sellers (role: user or similar, exclude current user)
      setAvailableSellers(
        users.filter((u) => u.id !== currentUser.id && (u.role === 'user' || u.role === 'manager'))
      );
    } catch {
      showError('Erro ao carregar lista de vendedores.');
    }
  };

  const handleTransfer = async () => {
    if (!selectedSellerId) {
      showError('Selecione um vendedor para transferir.');
      return;
    }

    const seller = availableSellers.find((s) => s.id === selectedSellerId);
    if (!seller) return;

    const okTransfer = await confirm({
      title: `Transferir para ${seller.name}?`,
      message:
        'Você ainda poderá ver a precificação até que seja aceita. Após o aceite ela sairá da sua lista.',
      variant: 'warning',
      confirmLabel: 'Transferir',
    });
    if (!okTransfer) return;

    setLoadingTransfer(true);
    try {
      await transferPricingRecord(selectedPricing.id, seller.id, seller.name, currentUser);

      // ✅ Notificar novo vendedor
      await notifyTransferInitiated(selectedPricing, currentUser, seller.id, seller.name);

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
    const okAccept = await confirm({
      title: 'Aceitar precificação?',
      message: 'Ela será movida definitivamente para sua lista.',
      variant: 'info',
      confirmLabel: 'Aceitar',
    });
    if (!okAccept) return;

    setLoadingTransfer(true);
    try {
      await acceptPricingTransfer(selectedPricing.id, currentUser);

      // ✅ Notificar Vendedor Original
      if (selectedPricing.userId) {
        await notifyTransferAccepted(selectedPricing.id, currentUser.name, selectedPricing.userId);
      }

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
      case 'Fechada':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Perdida':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const saveCommercialObservation = async () => {
    try {
      await updatePricingRecord(selectedPricing.id, {
        factors: { ...selectedPricing.factors, commercialObservation },
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
        action: `Precificação ${status}${status === 'Reprovada' ? `: ${rejectionReason}` : ''}`,
      };

      try {
        await updatePricingRecord(selectedPricing.id, {
          approvalStatus: status,
          history: [...(selectedPricing.history || []), historyEntry],
        } as any);

        await createNotification({
          userId: selectedPricing.userId,
          title: `Precificação ${status === 'Aprovada' ? 'Aprovada' : 'Reprovada'}`,
          message: `Sua precificação para ${selectedPricing.factors.client.name} foi ${status.toLowerCase()}.${status === 'Reprovada' ? ` Motivo: ${rejectionReason}` : ''}`,
          date: new Date().toISOString(),
          read: false,
          type: 'pricing_approval',
        });

        showSuccess(
          `Precificação ${status === 'Aprovada' ? 'aprovada' : 'reprovada'} com sucesso!`
        );
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
    const cod =
      pricing.formattedCod ||
      (pricing.cod ? String(pricing.cod).padStart(4, '0') : pricing.id.slice(-8));
    const freight = pricing.factors?.freight ?? 0;
    const tipoFrete = pricing.factors?.tipoFrete ?? (freight > 0 ? 'CIF' : 'FOB');
    const freightLabel = tipoFrete;
    const dueDate = pricing.factors?.dueDate
      ? new Date(pricing.factors.dueDate).toLocaleDateString('pt-BR')
      : '—';

    // Título compacto
    doc.setFontSize(16);
    doc.setFont(undefined as any, 'bold');
    doc.text(appSettings.companyName, 14, 15);
    doc.setFontSize(9);
    doc.setFont(undefined as any, 'normal');
    doc.text('PROPOSTA COMPLETA', 14, 20);

    // Dados gerais compactos (3 linhas com frete e vencimento)
    autoTable(doc, {
      startY: 25,
      head: [['DADOS GERAIS']],
      body: [
        [
          `COD: ${cod}  |  Data: ${new Date(pricing.date).toLocaleString('pt-BR')}  |  Cliente: ${pricing.factors?.client?.name || 'N/A'}  |  Agente: ${pricing.factors?.agent?.name || 'N/A'}`,
        ],
        [
          `Status: ${pricing.status}  |  Aprovação: ${pricing.approvalStatus || 'Pendente'}  |  Tipo de Frete: ${freightLabel}  |  Valor do Frete: ${freight > 0 ? `R$ ${freight.toFixed(2)}/ton` : '—'}  |  Vencimento: ${dueDate}`,
        ],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 46], fontSize: 8, fontStyle: 'bold' },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 6;

    // Iterate over calculations
    const calcs =
      pricing.calculations && pricing.calculations.length > 0 ? pricing.calculations : [pricing];

    calcs.forEach((calc, idx) => {
      if (idx > 0 && currentY > 230) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFontSize(11);
      doc.setFont(undefined as any, 'bold');
      doc.text(`Fórmula: ${calc.formula || pricing.factors.targetFormula}`, 14, currentY);
      currentY += 5;

      // Products - novo layout com Frete
      const productsData = [...(calc.macros || pricing.macros), ...(calc.micros || pricing.micros)]
        .filter((p) => p.quantity > 0)
        .map((p) => [
          p.name,
          freightLabel,
          (p.quantity / 1000).toFixed(2),
          `R$ ${Number(p.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          freight > 0 ? `R$ ${freight.toFixed(0)}` : 'R$ 0',
          `R$ ${((p.quantity / 1000) * Number(p.price) + (p.quantity / 1000) * freight).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Produto', 'Frete', 'Qtd(ton)', 'Preço/Ton', 'Frete/Ton', 'Total']],
        body: productsData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 46], fontSize: 8, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 18, halign: 'center' as const },
          2: { cellWidth: 22, halign: 'right' as const },
          3: { cellWidth: 30, halign: 'right' as const },
          4: { cellWidth: 28, halign: 'right' as const },
          5: { cellWidth: 32, halign: 'right' as const },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // Resumo compacto
      autoTable(doc, {
        startY: currentY,
        head: [['Resumo', 'Valor']],
        body: [
          ['Custo Base', `R$ ${(calc.summary?.baseCost || pricing.summary.baseCost).toFixed(2)}`],
          [
            'Preço Final/ton',
            `R$ ${(calc.summary?.finalPrice || pricing.summary.finalPrice).toFixed(2)}`,
          ],
          [
            'N-P-K Real',
            formatNPK(
              calc.formula,
              calc.summary?.resultingN || 0,
              calc.summary?.resultingP || 0,
              calc.summary?.resultingK || 0
            ),
          ],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 46], fontSize: 8, fontStyle: 'bold' },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // Rentabilidade (se existir)
      const pa = (calc as any).profitabilityAnalysis;
      if (pa) {
        const isPosRent = pa.profitability >= 0;
        if (currentY > 220) {
          doc.addPage();
          currentY = 15;
        }

        autoTable(doc, {
          startY: currentY,
          head: [['ANÁLISE DE RENTABILIDADE']],
          body: [
            ['Valor Unitário (Venda)', `R$ ${Number(pa.unitaryPrice).toFixed(2)}`],
            [`(-) Alíquota (${pa.taxRate}%)`, `R$ ${Number(pa.taxDeduction).toFixed(2)}`],
            ['(-) Frete', `R$ ${Number(pa.freightDeduction).toFixed(2)}`],
            [
              `(-) Comissão (${pa.commissionRate}%)`,
              `R$ ${Number(pa.commissionDeduction).toFixed(2)}`,
            ],
            [`(-) Juros (${pa.interestRate}%)`, `R$ ${Number(pa.interestDeduction).toFixed(2)}`],
            ['= Receita Líquida', `R$ ${Number(pa.netRevenue).toFixed(2)}`],
            [`(-) Custo × Fator (${pa.factor})`, `R$ ${Number(pa.baseCostAfterFactor).toFixed(2)}`],
            [
              `RENTABILIDADE (${Number(pa.profitabilityPercent).toFixed(2)}%)`,
              `${isPosRent ? '+' : ''}R$ ${Number(pa.profitability).toFixed(2)}`,
            ],
            [
              'Analisado por',
              `${pa.analyzedByName} em ${new Date(pa.analyzedAt).toLocaleString('pt-BR')}`,
            ],
          ],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: {
            fillColor: isPosRent ? [5, 150, 105] : [220, 38, 38],
            fontSize: 8,
            fontStyle: 'bold',
          },
          didParseCell: (data) => {
            if (data.row.index === 7) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = isPosRent ? [209, 250, 229] : [254, 226, 226];
              data.cell.styles.textColor = isPosRent ? [5, 150, 105] : [220, 38, 38];
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
    });

    // Observação Comercial (grande, destaque)
    const obs = pricing.factors?.commercialObservation || '';
    if (obs) {
      autoTable(doc, {
        startY: currentY,
        head: [['OBSERVAÇÃO COMERCIAL']],
        body: [[obs]],
        styles: { fontSize: 9, cellPadding: 4, halign: 'left' as const },
        headStyles: {
          fillColor: [245, 158, 11],
          textColor: [0, 0, 0],
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: { minCellHeight: 20 },
      });
    }

    doc.save(`proposta-completa-${cod}.pdf`);
  };

  const exportToExcel = (pricing: PricingRecord) => {
    const calcs =
      pricing.calculations && pricing.calculations.length > 0 ? pricing.calculations : [pricing];

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

      const materials = [
        ...(calc.macros || pricing.macros),
        ...(calc.micros || pricing.micros),
      ].filter((p) => p.quantity > 0);
      materials.forEach((p) => {
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
    XLSX.writeFile(
      wb,
      `Precificacao_${pricing.factors?.client?.name || 'Sem_Nome'}_${pricing.formattedCod}.xlsx`
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      {/* PDF Import Confirmation Modal */}
      {showPdfImportModal && extractedData && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" /> Preencher Pedido de Venda
              </h3>
              <button
                onClick={() => {
                  setShowPdfImportModal(false);
                  setExtractedData(null);
                }}
                className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-stone-500">
                Preencha ou revise os dados do pedido de venda:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Nº Pedido
                  </label>
                  <input
                    type="text"
                    value={extractedData.numero_pedido}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, numero_pedido: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Barra do Pedido
                  </label>
                  <input
                    type="text"
                    value={extractedData.barra_pedido}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, barra_pedido: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Vencimento
                  </label>
                  <input
                    type="date"
                    value={extractedData.data_pedido}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, data_pedido: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Qtd. Real (ton)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={extractedData.quantidade_real}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, quantidade_real: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Embalagem
                  </label>
                  <input
                    type="text"
                    value={extractedData.embalagem}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, embalagem: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Valor Unit. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={extractedData.valor_unitario_negociado}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        valor_unitario_negociado: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={extractedData.valor_total_negociado}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, valor_total_negociado: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    Tipo de Frete
                  </label>
                  <select
                    value={extractedData.tipo_frete}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, tipo_frete: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Selecionar...</option>
                    <option value="CIF">CIF</option>
                    <option value="FOB">FOB</option>
                  </select>
                </div>
                {extractedData.tipo_frete === 'CIF' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                      Valor do Frete (R$/ton)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={extractedData.valor_frete}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, valor_frete: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-stone-100">
              <button
                onClick={() => {
                  setShowPdfImportModal(false);
                  setExtractedData(null);
                }}
                className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePedido}
                disabled={savingPedido}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {savingPedido ? 'Salvando...' : 'Confirmar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Detalhes da Precificação</h2>
            <p className="text-sm text-stone-500">
              COD:{' '}
              <span className="font-bold text-emerald-600">{selectedPricing.formattedCod}</span> |
              Data: {new Date(selectedPricing.date).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Pedido de Venda badge in header */}
            {pedidoVenda && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-bold">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Pedido: {pedidoVenda.numero_pedido || '—'}
                {pedidoVenda.barra_pedido && ` / ${pedidoVenda.barra_pedido}`}
              </div>
            )}
            <button
              onClick={handleOpenManualPedido}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all active:scale-95 text-sm"
              title="Preencher Pedido de Venda manualmente"
            >
              <FileText className="w-4 h-4" /> Preencher Pedido
            </button>
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
                onClick={async () => {
                  const okDel = await confirm({
                    title: 'Excluir precificação?',
                    message: 'Esta ação não pode ser desfeita.',
                    variant: 'danger',
                    confirmLabel: 'Excluir',
                  });
                  if (okDel) {
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
                <label className="block text-sm font-bold text-amber-800 uppercase tracking-wider">
                  Transferir para Vendedor
                </label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-medium text-stone-700"
                >
                  <option value="">Selecione um vendedor...</option>
                  {availableSellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (@{s.nickname})
                    </option>
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
          {(currentUser.role === 'master' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'manager' ||
            (currentUser.permissions as any)?.approvals_canApprove) &&
            onUpdateApproval &&
            selectedPricing.approvalStatus === 'Pendente' && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-sm font-bold text-amber-800 uppercase block">
                      Aprovação do Gerente
                    </span>
                    <p className="text-xs text-amber-600">
                      Esta ação é definitiva e não poderá ser alterada após o clique.
                    </p>
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
                        <label className="text-xs font-bold text-red-600 uppercase tracking-widest">
                          Motivo da Reprovação
                        </label>
                        <button
                          onClick={() => setIsRejecting(false)}
                          className="text-stone-400 hover:text-stone-600"
                        >
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
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                selectedPricing.approvalStatus === 'Aprovada'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-start gap-2 flex-1">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold uppercase block">
                    Precificação {selectedPricing.approvalStatus}
                  </span>
                  {selectedPricing.approvalStatus === 'Reprovada' &&
                    (() => {
                      const rejectionEntry = [...(selectedPricing.history || [])]
                        .reverse()
                        .find((h) => h.action.startsWith('Precificação Reprovada'));
                      const reason = rejectionEntry?.action.replace('Precificação Reprovada: ', '');
                      return reason ? (
                        <p className="text-xs mt-1 font-medium">
                          <span className="font-bold">Motivo:</span> {reason}
                        </p>
                      ) : null;
                    })()}
                </div>
              </div>
              {selectedPricing.approvalStatus === 'Reprovada' && (
                <span className="text-xs opacity-75 text-right">
                  Você deve contatar o responsável.
                </span>
              )}
            </div>
          )}

          {/* Status Change */}
          {selectedPricing.status !== 'Excluída' &&
            onUpdateStatus &&
            (currentUser.role === 'master' ||
              currentUser.role === 'admin' ||
              currentUser.role === 'manager' ||
              (currentUser.permissions as any)?.history_changeStatus !== false) && (
              <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-stone-600 uppercase">Alterar Status</span>
                  {selectedPricing.approvalStatus !== 'Aprovada' && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Requer aprovação para fechar
                    </span>
                  )}
                </div>
                <select
                  value={selectedPricing.status}
                  onChange={(e) => onUpdateStatus(selectedPricing.id, e.target.value as any)}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-bold border-2 focus:ring-2 focus:ring-stone-500 outline-none ${getStatusColor(selectedPricing.status)}`}
                >
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Fechada" disabled={selectedPricing.approvalStatus !== 'Aprovada'}>
                    {selectedPricing.approvalStatus !== 'Aprovada'
                      ? 'Fechada (requer aprovação)'
                      : 'Fechada'}
                  </option>
                  <option value="Perdida">Perdida</option>
                </select>
              </div>
            )}

          {selectedPricing.status !== 'Em Andamento' && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 text-amber-800 text-sm">
              <Info className="w-5 h-5 flex-shrink-0" />
              <p>
                Para editar esta precificação, altere o status para <strong>Em Andamento</strong>.
              </p>
            </div>
          )}
          {/* Client & Agent Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">
                Cliente
              </h3>
              <p className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <span className="text-emerald-600 font-mono text-sm">
                  #{selectedPricing.factors?.client?.code || '---'}
                </span>
                {selectedPricing.factors?.client?.name || 'Cliente não identificado'}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-stone-600">
                  Documento: {selectedPricing.factors?.client?.document || 'N/A'}
                </p>
                <p className="text-sm text-stone-600">
                  IE: {selectedPricing.factors?.client?.stateRegistration || '---'}
                </p>
                <p className="text-sm text-stone-600 font-medium">
                  Fazenda: {selectedPricing.factors?.client?.fazenda || '---'}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">
                Agente
              </h3>
              <p className="text-lg font-bold text-stone-800">
                {selectedPricing.factors?.agent?.name || 'Agente não identificado'}
              </p>
              <p className="text-sm text-stone-600">
                Documento: {selectedPricing.factors?.agent?.document || 'N/A'}
              </p>
              <p className="text-sm font-medium text-blue-600 mt-1">
                Comissão: {selectedPricing.factors?.commission || 0}% (R${' '}
                {(selectedPricing.summary?.commissionValue || 0).toFixed(2)})
              </p>
            </div>
          </div>

          {/* Calculations Sections */}
          <div className="space-y-12">
            {(selectedPricing.calculations && selectedPricing.calculations.length > 0
              ? selectedPricing.calculations
              : [selectedPricing]
            ).map((calc, calcIdx) => (
              <div
                key={calcIdx}
                className="space-y-6 p-6 bg-stone-50 rounded-2xl border border-stone-200"
              >
                <div className="flex justify-between items-center border-b border-stone-200 pb-4">
                  <h3 className="text-xl font-black text-emerald-700 uppercase tracking-tight">
                    Fórmula: {calc.formula || 'N/A'}
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Preço Final</p>
                    <p className="text-lg font-bold text-emerald-600 font-mono">
                      R$ {calc.summary?.finalPrice.toFixed(2)} / ton
                    </p>
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
                        {[...(calc.macros || []), ...(calc.micros || [])]
                          .filter((p) => p.quantity > 0)
                          .map((p) => (
                            <tr key={p.id}>
                              <td className="px-4 py-3 font-medium text-stone-800">{p.name}</td>
                              <td className="px-4 py-3 text-right font-mono">
                                {Number(p.quantity).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                R$ {Number(p.price).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                R$ {((Number(p.quantity) / 1000) * Number(p.price)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot className="bg-stone-50 font-bold">
                        <tr>
                          <td className="px-4 py-3">TOTAL DA BATIDA</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {calc.summary?.totalWeight.toFixed(2)} kg
                          </td>
                          <td></td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600">
                            R$ {calc.summary?.baseCost.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-4 rounded-xl border border-stone-200">
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">
                      Detalhamento de Valores
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Valor Matéria Prima (Base)</span>
                        <span className="font-mono font-medium">
                          R$ {Number(calc.summary?.baseCost).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          Ajuste Fator ({calc.factors?.factor})
                        </span>
                        <span className="font-mono font-medium">
                          R${' '}
                          {(Number(calc.summary?.baseCost) * (calc.factors?.factor || 1)).toFixed(
                            2
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Margem Rentabilidade (R$/ton)</span>
                        <span className="font-mono font-medium">
                          + R$ {Number(calc.factors?.margin || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Desconto (R$/ton)</span>
                        <span className="font-mono font-medium text-red-500">
                          - R$ {Number(calc.factors?.discount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex justify-between font-bold text-stone-800">
                        <span>Preço Base de Venda</span>
                        <span className="font-mono">
                          R$ {Number(calc.summary?.basePrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-stone-200">
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">
                      Acréscimos e Encargos
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Frete (R$/ton)</span>
                        <span className="font-mono font-medium">
                          + R$ {Number(calc.summary?.freightValue).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Juros de Vencimento</span>
                        <span className="font-mono font-medium">
                          + R$ {Number(calc.summary?.interestValue).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          Alíquota de Impostos ({calc.factors?.taxRate}%)
                        </span>
                        <span className="font-mono font-medium">
                          + R$ {Number(calc.summary?.taxValue).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">
                          Comissão do Agente ({calc.factors?.commission}%)
                        </span>
                        <span className="font-mono font-medium">
                          + R$ {Number(calc.summary?.commissionValue).toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex justify-between text-xl font-black text-emerald-600">
                        <span>PREÇO FINAL</span>
                        <span className="font-mono">
                          R$ {Number(calc.summary?.finalPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guarantees Summary */}
                <div className="bg-stone-900 text-white p-6 rounded-2xl">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">
                    Garantias Finais
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">NITROGÊNIO (N)</p>
                      <p className="text-xl font-mono font-bold">
                        {Number(calc.summary?.resultingN).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">FÓSFORO (P)</p>
                      <p className="text-xl font-mono font-bold">
                        {Number(calc.summary?.resultingP).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">POTÁSSIO (K)</p>
                      <p className="text-xl font-mono font-bold">
                        {Number(calc.summary?.resultingK).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">ENXOFRE (S)</p>
                      <p className="text-xl font-mono font-bold">
                        {Number(calc.summary?.resultingS).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 bg-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 font-bold mb-1">CÁLCIO (Ca)</p>
                      <p className="text-xl font-mono font-bold">
                        {Number(calc.summary?.resultingCa).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  {calc.summary?.resultingMicros &&
                    Object.keys(calc.summary.resultingMicros).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-stone-800 flex flex-wrap gap-4 justify-center">
                        {Object.entries(calc.summary.resultingMicros).map(([name, val]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 px-3 py-1 bg-stone-800 rounded-full"
                          >
                            <span className="text-[10px] font-bold text-stone-500">{name}:</span>
                            <span className="text-sm font-mono font-bold">
                              {(val as number).toFixed(3)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Análise de Rentabilidade (se existir) */}
                {(calc as any).profitabilityAnalysis &&
                  (() => {
                    const pa = (calc as any).profitabilityAnalysis;
                    const isPaPositive = pa.profitability >= 0;
                    return (
                      <div
                        className={`p-4 rounded-xl border ${isPaPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                      >
                        <h4
                          className="text-xs font-bold uppercase tracking-widest mb-3"
                          style={{ color: isPaPositive ? '#065f46' : '#991b1b' }}
                        >
                          📊 Análise de Rentabilidade
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-stone-500">Valor Unitário (Venda)</span>
                            <span className="font-mono">
                              R$ {Number(pa.unitaryPrice).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">Custo × Fator ({pa.factor})</span>
                            <span className="font-mono">
                              R$ {Number(pa.baseCostAfterFactor).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>(-) Frete</span>
                            <span className="font-mono">
                              - R$ {Number(pa.freightDeduction).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>(-) Comissão ({pa.commissionRate}%)</span>
                            <span className="font-mono">
                              - R$ {Number(pa.commissionDeduction).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>(-) Juros ({pa.interestRate}%)</span>
                            <span className="font-mono">
                              - R$ {Number(pa.interestDeduction).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>(-) Alíquota ({pa.taxRate}%)</span>
                            <span className="font-mono">
                              - R$ {Number(pa.taxDeduction).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-stone-200 pt-2">
                            <span>= Receita Líquida</span>
                            <span className="font-mono">R$ {Number(pa.netRevenue).toFixed(2)}</span>
                          </div>
                          <div
                            className={`flex justify-between text-lg font-black pt-1 ${isPaPositive ? 'text-emerald-700' : 'text-red-700'}`}
                          >
                            <span>
                              RENTABILIDADE ({Number(pa.profitabilityPercent).toFixed(2)}%)
                            </span>
                            <span className="font-mono">
                              {isPaPositive ? '+' : ''}R$ {Number(pa.profitability).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-400 mt-2">
                            Analisado por {pa.analyzedByName} em{' '}
                            {new Date(pa.analyzedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            ))}
          </div>

          {/* Pedido de Venda Section */}
          {pedidoVenda && (
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Pedido de Venda Vinculado
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Nº Pedido</p>
                  <p className="font-mono font-black text-emerald-900 text-lg">
                    {pedidoVenda.numero_pedido || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Barra</p>
                  <p className="font-mono font-black text-emerald-900 text-lg">
                    {pedidoVenda.barra_pedido || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Vencimento</p>
                  <p className="text-stone-800">
                    {pedidoVenda.data_pedido
                      ? new Date(pedidoVenda.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">
                    Qtd. Real (ton)
                  </p>
                  <p className="font-bold text-stone-800">
                    {pedidoVenda.quantidade_real?.toLocaleString('pt-BR') ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Embalagem</p>
                  <p className="text-stone-800">{pedidoVenda.embalagem || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">
                    Tipo de Frete
                  </p>
                  <p className="text-stone-800">
                    {pedidoVenda.tipo_frete ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${pedidoVenda.tipo_frete === 'CIF' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {pedidoVenda.tipo_frete}
                      </span>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">
                    Valor Unit. Negociado
                  </p>
                  <p className="font-bold text-stone-800">
                    {pedidoVenda.valor_unitario_negociado != null
                      ? pedidoVenda.valor_unitario_negociado.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">Valor Total</p>
                  <p className="font-black text-emerald-800 text-lg">
                    {pedidoVenda.valor_total_negociado != null
                      ? pedidoVenda.valor_total_negociado.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '—'}
                  </p>
                </div>
                {pedidoVenda.tipo_frete === 'CIF' && pedidoVenda.valor_frete != null && (
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-0.5">
                      Valor do Frete (R$/ton)
                    </p>
                    <p className="font-bold text-stone-800">
                      {pedidoVenda.valor_frete.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commercial Observation */}
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">
              Observação Comercial
            </h3>
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
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">
                Histórico de Alterações
              </h3>
              <div className="space-y-4">
                {selectedPricing.history.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 text-sm border-l-2 border-stone-200 pl-4 py-1"
                  >
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
            {(currentUser.role === 'master' ||
              currentUser.role === 'admin' ||
              currentUser.role === 'manager' ||
              (currentUser.permissions as any)?.calculator_generatePDF !== false) && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={showAgentInPDF}
                    onChange={(e) => setShowAgentInPDF(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-stone-600 uppercase">
                    Exibir Representante no PDF
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => generatePricingPDF(selectedPricing, appSettings, showAgentInPDF)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-700 text-white font-bold rounded-lg hover:bg-stone-800 transition-colors text-sm"
                  >
                    <FileDown className="w-4 h-4" /> Proposta Comercial
                  </button>
                  <button
                    onClick={() => exportToPDF(selectedPricing)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" /> Proposta Completa
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
          <button
            onClick={onClose}
            className="px-6 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-700 transition-colors"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
