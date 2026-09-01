import React, { useState, useEffect } from 'react';
import {
  getSavedFormulas,
  deleteSavedFormula,
  getPriceLists,
  getAppSettings,
  getClients,
} from '../services/db';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { getProdutoFormuladoBySavedFormulaId } from '../services/produtosFormuladosService';
import { SavedFormula, User, PriceList, AppSettings, Client, Embalagem } from '../types';
import { getEmbalagens } from '../services/embalagensService';
import { LocalCarregamento } from '../types/carregamento';
import { formatId } from '../utils/formatId';
import {
  Beaker,
  Trash2,
  Save,
  Calendar,
  Database,
  User as UserIcon,
  MapPin,
  Package,
  Zap,
  AlertTriangle,
  CheckSquare,
  Square,
  FileText,
  Star,
  Search,
  X,
} from 'lucide-react';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import {
  calculateReportPrice,
  DEFAULT_REPORT_COMMERCIAL_FACTORS,
  getFormulaUpdateProtection,
  getPriceListsForLoadingLocation,
  ReportCommercialFactors,
} from '../utils/savedFormulaWorkflow';
import Calculator from './Calculator';

interface SavedFormulasProps {
  currentUser: User;
}

interface ModalGerarRelatorioProps {
  isOpen: boolean;
  formulas: SavedFormula[];
  selectedIds: string[];
  selectedList: PriceList | undefined;
  getFormulaCost: (
    f: SavedFormula,
    list: PriceList | undefined
  ) => { total: number; missingItems: string[] };
  companyName: string;
  onClose: () => void;
}

const addDaysToReportDate = (date: string, days: number) => {
  if (!date) return '';
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + Number(days || 0));
  return result.toISOString().split('T')[0];
};

interface ReportFactorsFormProps {
  id: string;
  factors: ReportCommercialFactors;
  embalagens: Embalagem[];
  onChange: <K extends keyof ReportCommercialFactors>(
    field: K,
    value: ReportCommercialFactors[K]
  ) => void;
}

function ReportFactorsForm({ id, factors, embalagens, onChange }: ReportFactorsFormProps) {
  const selectedPackage = embalagens.find((item) => item.id === factors.embalagem_id);
  const packageAdjustment = factors.embalagem_ajuste || 'nenhum';

  const setPackageAdjustment = (adjustment: 'nenhum' | 'cobrar' | 'descontar') => {
    onChange('embalagem_ajuste', adjustment);
    if (!selectedPackage || adjustment === 'nenhum') {
      onChange('embalagem_valor', 0);
      return;
    }
    const value =
      adjustment === 'cobrar'
        ? Number(selectedPackage.valor_cobrar ?? selectedPackage.valor ?? 0)
        : -Number(selectedPackage.valor_descontar ?? selectedPackage.valor ?? 0);
    onChange('embalagem_valor', value);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-medium text-stone-600">
        Fator (×)
        <input
          type="number"
          step="0.01"
          value={factors.factor}
          onChange={(event) => onChange('factor', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Desconto (R$/t)
        <input
          type="number"
          step="0.01"
          value={factors.discount || ''}
          onChange={(event) => onChange('discount', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Alíquota (%)
        <input
          type="number"
          step="0.01"
          value={factors.taxRate || ''}
          onChange={(event) => onChange('taxRate', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Comissão (%)
        <input
          type="number"
          step="0.01"
          value={factors.commission || ''}
          onChange={(event) => onChange('commission', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <div className="text-xs font-medium text-stone-600">
        Tipo de frete
        <div className="mt-1 flex gap-2">
          {(['CIF', 'FOB'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange('tipoFrete', type)}
              className={`flex-1 rounded-lg px-3 py-2 font-bold ${factors.tipoFrete === type ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <label className="text-xs font-medium text-stone-600">
        Frete (R$/t)
        <input
          type="number"
          step="0.01"
          value={factors.freight || ''}
          onChange={(event) => onChange('freight', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Embalagem
        <select
          value={factors.embalagem_id || ''}
          onChange={(event) => {
            const embalagem = embalagens.find((item) => item.id === event.target.value);
            onChange('embalagem_id', embalagem?.id || '');
            onChange('embalagem_nome', embalagem?.nome || '');
            onChange('embalagem_ajuste', 'nenhum');
            onChange('embalagem_valor', 0);
          }}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        >
          <option value="">— Sem embalagem —</option>
          {embalagens.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-stone-600">
        Ajuste da embalagem
        <select
          value={packageAdjustment}
          disabled={!selectedPackage}
          onChange={(event) =>
            setPackageAdjustment(event.target.value as 'nenhum' | 'cobrar' | 'descontar')
          }
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 disabled:bg-stone-100"
        >
          <option value="nenhum">Sem ajuste</option>
          <option value="cobrar" disabled={!selectedPackage?.cobrar}>
            Cobrar
          </option>
          <option
            value="descontar"
            disabled={!(selectedPackage?.descontar ?? selectedPackage?.desconto)}
          >
            Descontar
          </option>
        </select>
      </label>
      <label className="text-xs font-medium text-stone-600">
        Juros mensal (%)
        <input
          type="number"
          step="0.01"
          value={factors.monthlyInterestRate || ''}
          onChange={(event) => onChange('monthlyInterestRate', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Quantidade total (t)
        <input
          type="number"
          step="0.01"
          min="0"
          value={factors.totalTons || ''}
          onChange={(event) => onChange('totalTons', Number(event.target.value || 0))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <span className="text-xs font-medium text-stone-600">Condição de pagamento</span>
        <div className="mt-1 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name={`payment-${id}`}
              checked={(factors.paymentCondition || 'vencimento') === 'vencimento'}
              onChange={() => onChange('paymentCondition', 'vencimento')}
            />
            Vencimento direto
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name={`payment-${id}`}
              checked={factors.paymentCondition === 'ddf'}
              onChange={() => onChange('paymentCondition', 'ddf')}
            />
            DDF
          </label>
        </div>
      </div>
      {(factors.paymentCondition || 'vencimento') === 'vencimento' ? (
        <label className="text-xs font-medium text-stone-600">
          Vencimento
          <input
            type="date"
            value={factors.dueDate || ''}
            onChange={(event) => onChange('dueDate', event.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>
      ) : (
        <>
          <label className="text-xs font-medium text-stone-600">
            Data de carregamento
            <input
              type="date"
              value={factors.dataCarregamento || ''}
              onChange={(event) => {
                onChange('dataCarregamento', event.target.value);
                onChange('dueDate', addDaysToReportDate(event.target.value, factors.ddfDias || 0));
              }}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="text-xs font-medium text-stone-600">
            Dias DDF
            <input
              type="number"
              min="0"
              value={factors.ddfDias || ''}
              onChange={(event) => {
                const days = Number(event.target.value || 0);
                onChange('ddfDias', days);
                onChange('dueDate', addDaysToReportDate(factors.dataCarregamento || '', days));
              }}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
        </>
      )}
      <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
        <input
          type="checkbox"
          checked={factors.exemptCurrentMonth}
          onChange={(event) => onChange('exemptCurrentMonth', event.target.checked)}
        />
        Isentar juros do mês atual
      </label>
    </div>
  );
}

function ModalGerarRelatorio({
  isOpen,
  formulas,
  selectedIds,
  selectedList,
  getFormulaCost,
  companyName,
  onClose,
}: ModalGerarRelatorioProps) {
  const { showError } = useToast();
  const selectedFormulas = formulas.filter((f) => selectedIds.includes(f.id));
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [includeComposicao, setIncludeComposicao] = useState(false);
  const [globalFactors, setGlobalFactors] = useState<ReportCommercialFactors>({
    ...DEFAULT_REPORT_COMMERCIAL_FACTORS,
  });
  const [perFormulaFactors, setPerFormulaFactors] = useState<
    Record<string, ReportCommercialFactors>
  >({});

  const [clients, setClients] = useState<Client[]>([]);
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void Promise.all([getClients(), getEmbalagens(true)])
        .then(([nextClients, nextEmbalagens]) => {
          setClients(nextClients);
          setEmbalagens(nextEmbalagens);
        })
        .catch(() => {});
      setSelectedClient(null);
      setClientSearch('');
      setApplyToAll(true);
      setGlobalFactors({ ...DEFAULT_REPORT_COMMERCIAL_FACTORS });
      setPerFormulaFactors(
        Object.fromEntries(
          formulas
            .filter((formula) => selectedIds.includes(formula.id))
            .map((formula) => [formula.id, { ...DEFAULT_REPORT_COMMERCIAL_FACTORS }])
        )
      );
    }
  }, [isOpen, formulas, selectedIds]);

  if (!isOpen) return null;

  const getFactors = (formulaId: string) =>
    applyToAll ? globalFactors : perFormulaFactors[formulaId] || DEFAULT_REPORT_COMMERCIAL_FACTORS;

  const calcPrecoFinal = (formula: SavedFormula): number => {
    const { total } = getFormulaCost(formula, selectedList);
    return calculateReportPrice(total, getFactors(formula.id));
  };

  const handleGeneratePDF = async () => {
    setGeneratingPdf(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF();
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');

      // Header Design (Premium Theme)
      doc.setFillColor(16, 124, 65); // Forest green primary header accent bar
      doc.rect(0, 0, 210, 8, 'F');

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 124, 65);
      doc.text(companyName, 14, 22);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text(`RELATÓRIO DE PREÇOS — EMITIDO EM ${dateStr}`, 14, 28);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(14, 31, 196, 31);

      let currentY = 36;

      // Optional Client Details Card
      if (selectedClient) {
        // Draw background
        doc.setFillColor(248, 250, 248);
        doc.setDrawColor(220, 230, 220);
        doc.roundedRect(14, currentY, 182, 30, 3, 3, 'FD');

        // Client Title
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 124, 65);
        doc.text('DADOS DO CLIENTE', 19, currentY + 6);

        // Client Data columns
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);

        doc.text(`Razão Social / Nome: ${selectedClient.name}`, 19, currentY + 12);
        doc.text(`CPF / CNPJ: ${selectedClient.document}`, 19, currentY + 18);
        doc.text(`IE: ${selectedClient.stateRegistration || 'Isento'}`, 19, currentY + 24);

        doc.text(`Fazenda: ${selectedClient.fazenda || '—'}`, 110, currentY + 12);
        doc.text(
          `Cidade / UF: ${selectedClient.address?.city || ''} / ${selectedClient.address?.state || ''}`,
          110,
          currentY + 18
        );

        currentY += 36;
      }

      // Main table
      const tableBody: (string | number)[][] = selectedFormulas.map((formula) => {
        const idFormatado = formatId(formula.id_numeric, 'BAT-');
        const precoFinal = calcPrecoFinal(formula);
        const reportFactors = getFactors(formula.id);
        const totalSale = precoFinal * Number(reportFactors.totalTons || 0);
        return [
          idFormatado,
          formula.name,
          formula.targetFormula,
          Number(reportFactors.totalTons || 0).toLocaleString('pt-BR'),
          precoFinal > 0
            ? precoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—',
          totalSale > 0
            ? totalSale.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—',
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['ID', 'Produto / Fórmula', 'NPK', 'Ton.', 'Preço R$/t', 'Total']],
        body: tableBody,
        styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
        headStyles: { fillColor: [16, 124, 65], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 248] },
        margin: { left: 14, right: 14 },
      });

      // If include composition
      if (includeComposicao) {
        selectedFormulas.forEach((formula) => {
          const activeMacros = formula.macros.filter((m) => m.quantity > 0);
          const activeMicros = formula.micros.filter((m) => m.quantity > 0);
          if (activeMacros.length === 0 && activeMicros.length === 0) return;

          const lastY = (doc as any).lastAutoTable?.finalY ?? currentY + 20;

          // Page break if composition section is too low
          if (lastY > 240) {
            doc.addPage();
            doc.setFillColor(16, 124, 65);
            doc.rect(0, 0, 210, 8, 'F');
          }

          const compY = lastY > 240 ? 20 : lastY + 10;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(
            `Detalhamento da Composição: ${formula.name} (${formula.targetFormula})`,
            14,
            compY
          );

          const composicaoBody = [
            ...activeMacros.map((m) => [m.name, `${m.quantity.toFixed(0)} kg`, 'Macro']),
            ...activeMicros.map((m) => [m.name, `${m.quantity.toFixed(0)} kg`, 'Micro']),
          ];

          autoTable(doc, {
            startY: compY + 4,
            head: [['Matéria-Prima Utilizada', 'Quantidade', 'Tipo de Nutriente']],
            body: composicaoBody,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [80, 90, 80], textColor: 255 },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { left: 14, right: 14 },
          });
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.height;

        // Footer line separator
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.5);
        doc.line(14, pageHeight - 15, 196, pageHeight - 15);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);

        doc.text(
          'Este documento é um relatório comercial confidencial emitido por FertCalc.',
          doc.internal.pageSize.width / 2,
          pageHeight - 9,
          {
            align: 'center',
          }
        );
        doc.text(`Pág. ${i}/${pageCount}`, doc.internal.pageSize.width - 14, pageHeight - 9, {
          align: 'right',
        });
      }

      doc.save(`relatorio-precos-${dateStr.replace(/\//g, '-')}.pdf`);
      onClose();
    } catch {
      showError('Não foi possível gerar o relatório em PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Gerar Relatório de Preços</h2>
            <p className="text-sm text-stone-500 mt-1">
              {selectedFormulas.length} fórmula(s) selecionada(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Client Search Autocomplete */}
          <div className="relative border border-stone-200 rounded-xl p-4 bg-stone-50">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
              <span>👤</span> Buscar Cliente (Opcional - sairá no relatório)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientResults(true);
                }}
                onFocus={() => setShowClientResults(true)}
                onBlur={() => {
                  setTimeout(() => setShowClientResults(false), 250);
                }}
                placeholder="Pesquisar cliente por nome ou CPF/CNPJ..."
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
            {showClientResults && clientSearch.trim() && (
              <div className="absolute z-50 left-4 right-4 mt-1 bg-white border border-stone-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {(() => {
                  const term = clientSearch.toLowerCase().trim();
                  const filtered = clients.filter(
                    (c) => c.name.toLowerCase().includes(term) || c.document.includes(term)
                  );
                  if (filtered.length === 0) {
                    return <p className="p-2 text-xs text-stone-400">Nenhum cliente encontrado</p>;
                  }
                  return filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setClientSearch(c.name);
                        setShowClientResults(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0 text-xs flex flex-col"
                    >
                      <span className="font-bold text-stone-800">{c.name}</span>
                      <span className="text-[10px] text-stone-500">
                        Doc: {c.document} IE: {c.stateRegistration || 'Isento'} | Fazenda:{' '}
                        {c.fazenda || '—'}
                      </span>
                    </button>
                  ));
                })()}
              </div>
            )}
            {selectedClient && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-xs text-emerald-800 flex justify-between items-center">
                <div>
                  <p className="font-bold">✓ {selectedClient.name}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Doc: {selectedClient.document} IE:{' '}
                    {selectedClient.stateRegistration || 'Isento'} | Fazenda:{' '}
                    {selectedClient.fazenda || '—'}
                  </p>
                  <p className="text-[10px] text-emerald-600">
                    Cidade/UF: {selectedClient.address?.city || ''} /{' '}
                    {selectedClient.address?.state || ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch('');
                  }}
                  className="text-red-500 hover:text-red-700 font-bold ml-2 text-xs shrink-0"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(event) => setApplyToAll(event.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-sm font-medium text-stone-700">
                Aplicar os mesmos fatores a todas as formulações
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeComposicao}
                onChange={(e) => setIncludeComposicao(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-sm font-medium text-stone-700">
                Incluir composição de matérias-primas no relatório
              </span>
            </label>
          </div>

          {applyToAll ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-stone-700">
                Fatores comerciais
              </h3>
              <ReportFactorsForm
                id="all"
                factors={globalFactors}
                embalagens={embalagens}
                onChange={(field, value) =>
                  setGlobalFactors((current) => ({ ...current, [field]: value }))
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {selectedFormulas.map((formula) => (
                <div
                  key={formula.id}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                >
                  <h3 className="mb-3 text-sm font-bold text-stone-700">
                    {formatId(formula.id_numeric, 'BAT-')} — {formula.name}
                  </h3>
                  <ReportFactorsForm
                    id={formula.id}
                    factors={perFormulaFactors[formula.id] || DEFAULT_REPORT_COMMERCIAL_FACTORS}
                    embalagens={embalagens}
                    onChange={(field, value) =>
                      setPerFormulaFactors((current) => ({
                        ...current,
                        [formula.id]: {
                          ...(current[formula.id] || DEFAULT_REPORT_COMMERCIAL_FACTORS),
                          [field]: value,
                        },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <h3 className="text-sm font-bold text-emerald-700 mb-2 uppercase tracking-wider">
              Prévia de custos da composição
            </h3>
            <div className="space-y-1">
              {selectedFormulas.map((formula) => {
                const precoFinal = calcPrecoFinal(formula);
                return (
                  <div key={formula.id} className="flex justify-between text-sm">
                    <span className="text-stone-700">
                      {formatId(formula.id_numeric, 'BAT-')} — {formula.name}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {precoFinal > 0
                        ? precoFinal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-stone-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleGeneratePDF()}
            disabled={generatingPdf}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {generatingPdf ? 'Preparando…' : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SavedFormulas({ currentUser }: SavedFormulasProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [formulas, setFormulas] = useState<SavedFormula[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
  const [selectedFormulas, setSelectedFormulas] = useState<string[]>([]);
  const [formulaToUpdateId, setFormulaToUpdateId] = useState<string>('');
  const [formulaInEditor, setFormulaInEditor] = useState<SavedFormula | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [linhasDiferenciadas, setLinhasDiferenciadas] = useState<Record<string, boolean>>({});
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setFormulas([]);
    setLoading(true);
    try {
      const [allFormulas, allLists, allLocais, settings] = await Promise.all([
        getSavedFormulas(),
        getPriceLists(),
        getLocaisAtivos(),
        getAppSettings(),
      ]);

      // All users with permission see all batidas (remove userId restriction)
      setFormulas(allFormulas);
      setPriceLists(allLists);
      setLocais(allLocais);
      if (settings) setAppSettings(settings);

      setSelectedPriceListId('');

      // Load linha_diferenciada for each formula
      const ldMap: Record<string, boolean> = {};
      await Promise.all(
        allFormulas.map(async (f) => {
          try {
            const produto = await getProdutoFormuladoBySavedFormulaId(f.id);
            if (produto) ldMap[f.id] = produto.linha_diferenciada;
          } catch {
            // ignore
          }
        })
      );
      setLinhasDiferenciadas(ldMap);
    } catch (error) {
      console.error('Error loading formulas data:', error);
      showError('Erro ao carregar fórmulas salvas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir Fórmula',
      message: `Tem certeza que deseja excluir a fórmula "${name}"?`,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deleteSavedFormula(id);
      showSuccess('Fórmula excluída com sucesso!');
      setSelectedFormulas((prev) => prev.filter((sid) => sid !== id));
      await loadData();
    } catch {
      showError('Erro ao excluir fórmula');
    }
  };

  const getFormulaCost = (formula: SavedFormula, priceList: PriceList | undefined) => {
    if (!priceList) return { total: 0, missingItems: [] };

    let totalCustoMat = 0;
    const missingItems: string[] = [];

    formula.macros.forEach((macro) => {
      if (!macro.quantity || macro.quantity <= 0) return;
      const priceListItem = priceList.macros.find(
        (m) => m.id === macro.id || m.name.trim().toLowerCase() === macro.name.trim().toLowerCase()
      );
      if (priceListItem && priceListItem.price) {
        totalCustoMat += (macro.quantity / 1000) * Number(priceListItem.price);
      } else {
        missingItems.push(macro.name);
      }
    });

    formula.micros.forEach((micro) => {
      if (!micro.quantity || micro.quantity <= 0) return;
      const priceListItem = priceList.micros.find(
        (m) => m.id === micro.id || m.name.trim().toLowerCase() === micro.name.trim().toLowerCase()
      );
      if (priceListItem && priceListItem.price) {
        totalCustoMat += (micro.quantity / 1000) * Number(priceListItem.price);
      } else {
        missingItems.push(micro.name);
      }
    });

    return { total: totalCustoMat, missingItems };
  };

  const toggleSelectFormula = (id: string) => {
    setSelectedFormulas((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFormulas.length === filteredFormulas.length) {
      setSelectedFormulas([]);
    } else {
      setSelectedFormulas(filteredFormulas.map((f) => f.id));
    }
  };

  const compatiblePriceLists = getPriceListsForLoadingLocation(priceLists, selectedLocalId);

  useEffect(() => {
    const firstCompatibleList = compatiblePriceLists[0];
    setSelectedPriceListId((current) =>
      compatiblePriceLists.some((list) => list.id === current)
        ? current
        : firstCompatibleList?.id || ''
    );
  }, [selectedLocalId, priceLists]);

  useEffect(() => {
    setSelectedFormulas((current) =>
      current.filter((id) => formulas.some((formula) => formula.id === id))
    );
  }, [formulas]);

  useEffect(() => {
    const updateableIds = selectedFormulas.filter((id) => linhasDiferenciadas[id] !== true);
    setFormulaToUpdateId((current) =>
      updateableIds.includes(current) ? current : updateableIds[0] || ''
    );
  }, [selectedFormulas, linhasDiferenciadas]);

  const openFormulaEditor = (formula: SavedFormula) => {
    if (!selectedLocalId) {
      showError('Selecione o local de carregamento antes de abrir a calculadora.');
      return;
    }
    if (!selectedPriceListId) {
      showError('Este local não possui uma lista de preços disponível.');
      return;
    }

    const protection = getFormulaUpdateProtection(
      formula,
      linhasDiferenciadas[formula.id] === true
    );
    if (!protection.canUpdate) {
      showError(protection.reason || 'Esta batida não pode ser alterada.');
      return;
    }

    setFormulaInEditor({
      ...formula,
      protectedMaterialIds: protection.protectedMaterialIds,
      isRevisionFromSavedFormula: true,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const selectedList = compatiblePriceLists.find((l) => l.id === selectedPriceListId);

  // Batidas belong to the organization and can be priced at every loading location.
  const filteredFormulas = formulas;

  const allSelected =
    filteredFormulas.length > 0 && selectedFormulas.length === filteredFormulas.length;

  return (
    <React.Fragment>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-emerald-600" />
              Fórmulas Salvas (Batidas)
            </h2>
            <p className="text-stone-500">
              Gerencie suas batidas e gere relatórios de preços para clientes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Local de Carregamento filter */}
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-stone-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Local de Carregamento
                </span>
                <select
                  value={selectedLocalId}
                  onChange={(e) => setSelectedLocalId(e.target.value)}
                  className="bg-transparent text-stone-700 font-medium outline-none text-sm cursor-pointer max-w-[160px]"
                >
                  <option value="">Selecione o local</option>
                  {locais.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price List filter */}
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
              <Database className="w-5 h-5 text-stone-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Tabela de Preços
                </span>
                <select
                  value={selectedPriceListId}
                  onChange={(e) => setSelectedPriceListId(e.target.value)}
                  className="bg-transparent text-stone-700 font-medium outline-none text-sm cursor-pointer max-w-[160px]"
                >
                  {compatiblePriceLists.length > 0 ? (
                    compatiblePriceLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {selectedLocalId
                        ? 'Sem tabela para este local'
                        : 'Selecione o local primeiro'}
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Generate report button */}
            {selectedFormulas.length > 0 && (
              <button
                onClick={() => {
                  if (!selectedLocalId) {
                    showError('Selecione o local de carregamento para gerar o relatório.');
                    return;
                  }
                  if (!selectedList) {
                    showError('Selecione uma lista de preços vinculada ao local.');
                    return;
                  }
                  setIsReportModalOpen(true);
                }}
                disabled={!selectedLocalId || !selectedList}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Gerar Relatório de Preços ({selectedFormulas.length})
              </button>
            )}
          </div>
        </div>

        {formulaInEditor && (
          <section className="rounded-2xl border-2 border-emerald-300 bg-stone-50 p-3 shadow-lg sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                  Atualização rápida da batida
                </p>
                <h3 className="text-lg font-bold text-stone-900">{formulaInEditor.name}</h3>
                <p className="text-sm text-stone-600">
                  A calculadora foi aberta aqui com o local e a tabela de preços selecionados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormulaInEditor(null)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100"
              >
                <X className="h-4 w-4" /> Fechar calculadora
              </button>
            </div>
            <Calculator
              key={`${formulaInEditor.id}-${selectedLocalId}-${selectedPriceListId}`}
              currentUser={currentUser}
              isSimplified
              disableConditions
              initialFormulaToLoad={formulaInEditor}
              initialBranchId={locais.find((local) => local.id === selectedLocalId)?.filial_id}
              initialLoadingLocationId={selectedLocalId}
              initialPriceListId={selectedPriceListId}
              onSavedFormulaSuccess={() => {
                setFormulaInEditor(null);
                void loadData();
              }}
            />
          </section>
        )}

        {filteredFormulas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Save className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">Nenhuma fórmula salva</h3>
            <p className="text-stone-500 max-w-md mx-auto">
              {selectedLocalId
                ? 'Nenhuma batida salva está disponível para esta organização.'
                : 'Acesse a Calculadora, faça uma batida e clique em "Salvar Batida".'}
            </p>
          </div>
        ) : (
          <>
            {/* Select all row */}
            <div className="flex items-center gap-3 px-1">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-stone-600 hover:text-emerald-600 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              {selectedFormulas.length > 0 && (
                <span className="text-xs text-stone-400">
                  {selectedFormulas.length} selecionada(s)
                </span>
              )}
            </div>

            {selectedFormulas.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="font-bold text-emerald-900">
                      Revisar uma batida antes do relatório
                    </p>
                    <p className="text-sm text-emerald-800">
                      Escolha a fórmula que precisa ser recalculada. Micros são preservados e
                      produtos de linha diferenciada não podem ser alterados.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex min-w-64 flex-col gap-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                      Batida para atualizar
                      <select
                        value={formulaToUpdateId}
                        onChange={(event) => setFormulaToUpdateId(event.target.value)}
                        className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-700"
                      >
                        {selectedFormulas.map((id) => {
                          const formula = formulas.find((item) => item.id === id);
                          if (!formula) return null;
                          const blocked = linhasDiferenciadas[formula.id] === true;
                          return (
                            <option key={formula.id} value={formula.id} disabled={blocked}>
                              {formula.name}
                              {blocked ? ' — linha diferenciada' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const formula = formulas.find((item) => item.id === formulaToUpdateId);
                        if (formula) openFormulaEditor(formula);
                      }}
                      disabled={!formulaToUpdateId}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Atualizar nesta página
                      <Beaker className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFormulas.map((formula) => {
                const results = getFormulaCost(formula, selectedList);
                const isSelected = selectedFormulas.includes(formula.id);
                const isLinhaDiferenciada = linhasDiferenciadas[formula.id] === true;
                return (
                  <div
                    key={formula.id}
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all flex flex-col ${
                      isSelected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-stone-200'
                    }`}
                  >
                    <div className="p-5 border-b border-stone-100 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSelectFormula(formula.id)}
                            className="flex-shrink-0 text-stone-400 hover:text-emerald-600 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg text-stone-800 truncate">
                              {formula.name}
                            </h3>
                            {formula.id_numeric != null && (
                              <span className="text-xs font-mono text-emerald-600 font-bold">
                                {formatId(formula.id_numeric, 'BAT-')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          {isLinhaDiferenciada && (
                            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3" />
                              Linha Dif.
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(formula.id, formula.name)}
                            className="text-stone-400 hover:text-red-500 transition-colors p-1"
                            title="Excluir fórmula"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center text-xs text-stone-500 mb-4 gap-2">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" /> {formula.userName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{' '}
                          {new Date(formula.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-lg border border-stone-100 mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                            Fórmula Alvo
                          </p>
                        </div>
                        <p className="font-mono text-emerald-700 font-bold text-lg mb-3">
                          {formula.targetFormula}
                        </p>

                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 border-t border-stone-200 pt-2">
                          Composição (kg)
                        </p>
                        <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                          {formula.macros
                            .filter((m) => m.quantity > 0)
                            .map((m) => (
                              <div
                                key={m.id}
                                className="flex justify-between items-center text-[11px]"
                              >
                                <span className="text-stone-600 flex items-center gap-1 pr-2">
                                  <Package className="w-3 h-3 text-stone-400 flex-shrink-0" />
                                  {m.name}
                                </span>
                                <span className="font-mono font-bold text-stone-800">
                                  {m.quantity.toFixed(0)}
                                </span>
                              </div>
                            ))}
                          {formula.micros
                            .filter((m) => m.quantity > 0)
                            .map((m) => (
                              <div
                                key={m.id}
                                className="flex justify-between items-center text-[11px]"
                              >
                                <span className="text-emerald-700 flex items-center gap-1 pr-2">
                                  <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                  {m.name}
                                </span>
                                <span className="font-mono font-bold text-emerald-800">
                                  {m.quantity.toFixed(0)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {results.missingItems.length > 0 && selectedList && (
                        <div className="mb-4 p-2 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">
                              Itens Não Disponíveis
                            </p>
                            <p className="text-[10px] text-red-500 leading-tight">
                              {results.missingItems.join(', ')} não encontrado(s) nesta tabela.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <p className="text-xs text-stone-500">Custo Total (por Ton)</p>
                          <p className="text-lg font-black text-stone-800">
                            {selectedList
                              ? results.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : 'Selecione uma tabela'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-3 border-t border-stone-100">
                      <button
                        onClick={() => openFormulaEditor(formula)}
                        disabled={isLinhaDiferenciada || !selectedLocalId || !selectedList}
                        className="w-full flex justify-center items-center gap-2 bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-600 text-stone-700 font-medium py-2 rounded-lg transition-colors text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                        title={
                          isLinhaDiferenciada
                            ? 'A composição de produtos de linha diferenciada é protegida'
                            : !selectedLocalId
                              ? 'Selecione o local de carregamento'
                              : !selectedList
                                ? 'Não existe lista de preços vinculada ao local'
                                : 'Atualizar esta batida nesta página'
                        }
                      >
                        {isLinhaDiferenciada ? 'Composição protegida' : 'Atualizar nesta página'}
                        <Beaker className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      <ModalGerarRelatorio
        isOpen={isReportModalOpen}
        formulas={formulas}
        selectedIds={selectedFormulas}
        selectedList={selectedList}
        getFormulaCost={getFormulaCost}
        companyName={appSettings.companyName}
        onClose={() => setIsReportModalOpen(false)}
      />
    </React.Fragment>
  );
}
