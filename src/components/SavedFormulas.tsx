import React, { useState, useEffect } from 'react';
import {
  getSavedFormulas,
  getPriceLists,
  getAppSettings,
  getClients,
  getBrands,
} from '../services/db';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import {
  getProdutoFormuladoBySavedFormulaId,
  getProdutosFormulados,
} from '../services/produtosFormuladosService';
import { setSavedFormulaArchived } from '../services/savedFormulaService';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { addHistoricoPrecos } from '../services/historicoPrecoService';
import {
  SavedFormula,
  User,
  PriceList,
  PriceListCurrency,
  AppSettings,
  Client,
  Embalagem,
  Brand,
} from '../types';
import { getEmbalagens } from '../services/embalagensService';
import { LocalCarregamento } from '../types/carregamento';
import { formatId } from '../utils/formatId';
import { closeModalOnBackdrop } from '../utils/modalUtils';
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
  Archive,
  ArchiveRestore,
  FileSpreadsheet,
  ClipboardList,
} from 'lucide-react';
import PropostasPanel from './propostas/PropostasPanel';
import { canCreatePropostas, permissoesProposta } from './propostas/propostaPermissions';
import {
  criarProposta,
  getProposta,
  registrarDocumentoProposta,
} from '../services/propostaService';
import type { NovaProposta, Proposta } from '../types/proposta';
import {
  VALIDADE_PADRAO_DIAS,
  formatNumeroProposta,
  hojeIso,
  problemaNovaProposta,
  somarDias,
} from '../utils/propostaModel';
import { baixarExcelProposta, createPropostaPdf } from '../utils/propostaDocumento';
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
import SimplifiedCalculatorBeta from './calculatorBeta/SimplifiedCalculatorBeta';
import { formatPricingMoney } from '../utils/pricingCurrency';
import { listHasCurrency, projectPriceList } from '../utils/priceListCurrency';
import { saveOrSharePdf } from '../utils/pdfDelivery';

interface SavedFormulasProps {
  currentUser: User;
}

interface ModalGerarRelatorioProps {
  isOpen: boolean;
  formulas: SavedFormula[];
  selectedIds: string[];
  selectedList: PriceList | undefined;
  selectedLocal?: LocalCarregamento;
  currentUser: User;
  getFormulaCost: (
    f: SavedFormula,
    list: PriceList | undefined
  ) => { total: number; missingItems: string[] };
  settings: AppSettings;
  onClose: () => void;
  /** Avisa a página para recarregar a aba Propostas. */
  onPropostaCriada?: () => void;
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
  currency: PriceListCurrency;
  exchangeRate?: number;
  onChange: <K extends keyof ReportCommercialFactors>(
    field: K,
    value: ReportCommercialFactors[K]
  ) => void;
}

const getListCurrency = (list?: PriceList): PriceListCurrency => list?.currency ?? 'BRL';

function ReportFactorsForm({
  id,
  factors,
  embalagens,
  currency,
  onChange,
}: ReportFactorsFormProps) {
  const selectedPackage = embalagens.find((item) => item.id === factors.embalagem_id);
  const packageAdjustment = factors.embalagem_ajuste || 'nenhum';

  const setPackageAdjustment = (adjustment: 'nenhum' | 'cobrar' | 'descontar') => {
    onChange('embalagem_ajuste', adjustment);
    if (!selectedPackage || adjustment === 'nenhum') {
      onChange('embalagem_valor', 0);
      return;
    }
    const registeredValue =
      adjustment === 'cobrar'
        ? Number(selectedPackage.valor_cobrar ?? selectedPackage.valor ?? 0)
        : -Number(selectedPackage.valor_descontar ?? selectedPackage.valor ?? 0);
    // Embalagem fica em reais por tonelada, também em listas em dólar.
    onChange('embalagem_valor', registeredValue);
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
        Desconto ({currency}/t)
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
  selectedLocal,
  currentUser,
  getFormulaCost,
  settings,
  onClose,
  onPropostaCriada,
}: ModalGerarRelatorioProps) {
  const { showError, showSuccess } = useToast();
  const selectedFormulas = formulas.filter((f) => selectedIds.includes(f.id));
  const [generating, setGenerating] = useState<'pdf' | 'excel' | null>(null);
  const generatingPdf = generating !== null;
  const [validaAte, setValidaAte] = useState(() => somarDias(hojeIso(), VALIDADE_PADRAO_DIAS));
  const [observacoes, setObservacoes] = useState('');
  const [createdProposal, setCreatedProposal] = useState<Proposta | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const [includeComposicao, setIncludeComposicao] = useState(false);
  const [globalFactors, setGlobalFactors] = useState<ReportCommercialFactors>({
    ...DEFAULT_REPORT_COMMERCIAL_FACTORS,
  });
  const [perFormulaFactors, setPerFormulaFactors] = useState<
    Record<string, ReportCommercialFactors>
  >({});
  // Quantidade (t) de cada produto do relatório. Opcional: sem quantidade, o
  // relatório mostra só o preço por tonelada.
  const [quantities, setQuantities] = useState<Record<string, string>>({});

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
      setValidaAte(somarDias(hojeIso(), VALIDADE_PADRAO_DIAS));
      setObservacoes('');
      setCreatedProposal(null);
      setGlobalFactors({ ...DEFAULT_REPORT_COMMERCIAL_FACTORS });
      setQuantities({});
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

  const getQuantity = (formulaId: string) =>
    Number((quantities[formulaId] || '').replace(',', '.')) || 0;
  const getFactors = (formulaId: string): ReportCommercialFactors => ({
    ...(applyToAll
      ? globalFactors
      : perFormulaFactors[formulaId] || DEFAULT_REPORT_COMMERCIAL_FACTORS),
    totalTons: getQuantity(formulaId),
  });
  const reportCurrency = getListCurrency(selectedList);

  const calcPrecoFinal = (formula: SavedFormula): number => {
    const { total } = getFormulaCost(formula, selectedList);
    return calculateReportPrice(total, getFactors(formula.id), new Date(), {
      currency: reportCurrency,
      exchangeRate: selectedList?.exchangeRate,
    });
  };

  const canCreateProposal = canCreatePropostas(currentUser);
  const validityProblem = problemaNovaProposta({
    validaAte,
    quantidadeItens: selectedFormulas.length,
    itensSemPreco: selectedFormulas
      .filter((formula) => !(calcPrecoFinal(formula) > 0))
      .map((formula) => formula.name),
  });

  /** Monta a fotografia dos preços que vira a proposta. */
  const buildNovaProposta = (): NovaProposta => ({
    clientId: selectedClient?.id,
    clienteNome: selectedClient?.name || 'Cliente não informado',
    clienteDocumento: selectedClient?.document || undefined,
    clienteDados: {
      documento: selectedClient?.document,
      inscricaoEstadual: selectedClient?.stateRegistration || undefined,
      fazenda: selectedClient?.fazenda || undefined,
      cidade: selectedClient?.address?.city || undefined,
      estado: selectedClient?.address?.state || undefined,
    },
    priceListId: selectedList?.id,
    priceListNome: selectedList?.name,
    localCarregamentoId: selectedLocal?.id,
    localNome: selectedLocal?.nome,
    moeda: reportCurrency,
    taxaCambio: reportCurrency === 'USD' ? selectedList?.exchangeRate : undefined,
    validaAte,
    incluirComposicao: includeComposicao,
    observacoes: observacoes.trim() || undefined,
    itens: selectedFormulas.map((formula) => {
      const reportFactors = getFactors(formula.id);
      return {
        savedFormulaId: formula.id,
        codigo: formatId(formula.id_numeric, 'BAT-'),
        formulaNome: formula.name,
        npk: formula.targetFormula,
        embalagem: reportFactors.embalagem_nome || undefined,
        precoTonelada: Math.round(calcPrecoFinal(formula) * 100) / 100,
        quantidadeSugerida:
          Number(reportFactors.totalTons) > 0 ? Number(reportFactors.totalTons) : undefined,
        composicao: [
          ...formula.macros
            .filter((material) => material.quantity > 0)
            .map((material) => ({
              nome: material.name,
              kg: material.quantity,
              tipo: 'Macro' as const,
            })),
          ...formula.micros
            .filter((material) => material.quantity > 0)
            .map((material) => ({
              nome: material.name,
              kg: material.quantity,
              tipo: 'Micro' as const,
            })),
        ],
        fatores: { ...reportFactors, priceListCurrency: reportCurrency },
      };
    }),
  });

  /** Mantém o histórico de preços dos produtos formulados (como antes). */
  const registerPriceHistory = async () => {
    const historyEntries = (
      await Promise.all(
        selectedFormulas.map(async (formula) => {
          const product = await getProdutoFormuladoBySavedFormulaId(formula.id);
          if (!product) return null;
          const reportFactors = getFactors(formula.id);
          const { total: baseCost } = getFormulaCost(formula, selectedList);
          const finalPrice = calcPrecoFinal(formula);
          return {
            produto_formulado_id: product.id,
            saved_formula_id: formula.id,
            organization_id: formula.organizationId || currentUser.organizationId,
            local_carregamento_id: selectedLocal?.id,
            local_carregamento_nome: selectedLocal?.nome,
            price_list_id: selectedList?.id,
            price_list_name: selectedList?.name,
            formula_nome: formula.name,
            preco_base: baseCost,
            preco_final: finalPrice,
            moeda: reportCurrency,
            taxa_cambio: reportCurrency === 'USD' ? selectedList?.exchangeRate : undefined,
            preco_final_brl:
              reportCurrency === 'USD'
                ? finalPrice * Number(selectedList?.exchangeRate || 0)
                : finalPrice,
            quantidade_tons: reportFactors.totalTons,
            valor_total: finalPrice * Number(reportFactors.totalTons || 0),
            fatores_comerciais: {
              ...reportFactors,
              priceListCurrency: reportCurrency,
              priceListExchangeRate: selectedList?.exchangeRate,
            },
            origem: 'relatorio_precos' as const,
            registrado_por: currentUser.name,
          };
        })
      )
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    await addHistoricoPrecos(historyEntries);
  };

  const handleGenerate = async (format: 'pdf' | 'excel') => {
    if (validityProblem) {
      showError(validityProblem);
      return;
    }
    setGenerating(format);
    try {
      // A proposta é criada uma vez; gerar o outro formato reaproveita a mesma.
      let proposta = createdProposal;
      if (!proposta) {
        const id = await criarProposta(buildNovaProposta());
        proposta = await getProposta(id);
        setCreatedProposal(proposta);
        void registerPriceHistory().catch(() => {});
        showSuccess(`Proposta ${formatNumeroProposta(proposta.numero)} criada.`);
        onPropostaCriada?.();
      }
      if (format === 'pdf') {
        const doc = createPropostaPdf({ proposta, itens: proposta.itens || [], settings });
        await saveOrSharePdf(
          doc,
          `${formatNumeroProposta(proposta.numero)}.pdf`,
          'Proposta de preços'
        );
      } else {
        await baixarExcelProposta(proposta, proposta.itens || [], settings);
      }
      void registrarDocumentoProposta(proposta.id, format).catch(() => {});
    } catch (error) {
      showError(
        error instanceof Error && error.message
          ? error.message
          : format === 'pdf'
            ? 'Não foi possível gerar o PDF.'
            : 'Não foi possível gerar o Excel.'
      );
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, generatingPdf)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-stone-800">Gerar proposta de preços</h2>
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

          {/* Proposta: validade e observações */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <label className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Válida até
              <input
                type="date"
                value={validaAte}
                min={hojeIso()}
                disabled={Boolean(createdProposal)}
                onChange={(event) => setValidaAte(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-stone-300 px-3 text-sm font-semibold normal-case tracking-normal text-stone-800 disabled:bg-stone-100"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Observações para o cliente (opcional)
              <textarea
                value={observacoes}
                disabled={Boolean(createdProposal)}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Ex.: preços FOB, condição de pagamento, frete sob consulta…"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm normal-case tracking-normal text-stone-800 disabled:bg-stone-100"
              />
            </label>
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
                Mostrar os produtos da batida (composição) no PDF e no Excel
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
                currency={reportCurrency}
                exchangeRate={selectedList?.exchangeRate}
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
                    currency={reportCurrency}
                    exchangeRate={selectedList?.exchangeRate}
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

          {/* Produtos do relatório: quantidade por produto e prévia */}
          <div className="overflow-hidden rounded-xl border border-emerald-200">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                Produtos do relatório
              </h3>
              <span className="text-xs text-emerald-700">
                Quantidade opcional: sem ela, o relatório mostra só o preço por tonelada.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs font-bold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2 text-left">Produto</th>
                    <th className="px-4 py-2 text-left">Quantidade (t)</th>
                    <th className="px-4 py-2 text-right">Preço {reportCurrency}/t</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFormulas.map((formula) => {
                    const precoFinal = calcPrecoFinal(formula);
                    const quantity = getQuantity(formula.id);
                    return (
                      <tr key={formula.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2">
                          <span className="block font-semibold text-stone-800">{formula.name}</span>
                          <span className="font-mono text-xs text-emerald-700">
                            {formatId(formula.id_numeric, 'BAT-')} · {formula.targetFormula}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={quantities[formula.id] || ''}
                            onChange={(event) => {
                              const raw = event.target.value;
                              if (!/^\d*(?:[.,]\d{0,3})?$/.test(raw)) return;
                              setQuantities((current) => ({ ...current, [formula.id]: raw }));
                            }}
                            placeholder="—"
                            aria-label={`Quantidade em toneladas de ${formula.name}`}
                            className="h-10 w-28 rounded-lg border border-stone-300 px-3 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-700">
                          {precoFinal > 0 ? formatPricingMoney(precoFinal, reportCurrency) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-700">
                          {precoFinal > 0 && quantity > 0
                            ? formatPricingMoney(precoFinal * quantity, reportCurrency)
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 font-bold">
                    <td className="px-4 py-2 text-stone-700">Total</td>
                    <td className="px-4 py-2 tabular-nums text-stone-700">
                      {selectedFormulas
                        .reduce((total, formula) => total + getQuantity(formula.id), 0)
                        .toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                      t
                    </td>
                    <td />
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-800">
                      {formatPricingMoney(
                        selectedFormulas.reduce(
                          (total, formula) =>
                            total + calcPrecoFinal(formula) * getQuantity(formula.id),
                          0
                        ),
                        reportCurrency
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-stone-100 flex flex-wrap items-center justify-end gap-3">
          {createdProposal ? (
            <p className="mr-auto text-sm font-semibold text-emerald-700">
              Proposta {formatNumeroProposta(createdProposal.numero)} criada. Ela fica na aba
              Propostas.
            </p>
          ) : !canCreateProposal ? (
            <p className="mr-auto text-sm font-semibold text-red-700" role="alert">
              Seu usuário não tem a permissão “Propostas — criar”.
            </p>
          ) : validityProblem ? (
            <p className="mr-auto text-sm font-semibold text-amber-700">{validityProblem}</p>
          ) : null}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate('excel')}
            disabled={generatingPdf || !canCreateProposal || Boolean(validityProblem)}
            className="px-5 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {generating === 'excel' ? 'Preparando…' : 'Gerar Excel'}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate('pdf')}
            disabled={generatingPdf || !canCreateProposal || Boolean(validityProblem)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {generating === 'pdf' ? 'Preparando…' : 'Gerar PDF'}
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
  const [archivedFormulas, setArchivedFormulas] = useState<SavedFormula[]>([]);
  const [view, setView] = useState<'ativas' | 'arquivadas'>('ativas');
  const [pagina, setPagina] = useState<'batidas' | 'propostas'>('batidas');
  const [propostasReloadKey, setPropostasReloadKey] = useState(0);
  const podeVerPropostas = permissoesProposta(currentUser).ver;
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
  // A mesma lista pode ter preços em reais e em dólar: o usuário escolhe a moeda.
  const [listCurrency, setListCurrency] = useState<PriceListCurrency>('BRL');
  const [selectedFormulas, setSelectedFormulas] = useState<string[]>([]);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
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
      const [savedFormulas, allLists, allLocais, settings, allBrands, products] = await Promise.all(
        [
          getSavedFormulas({ includeArchived: true }),
          getPriceLists(),
          getLocaisAtivos(),
          getAppSettings(),
          getBrands(),
          getProdutosFormulados().catch(() => []),
        ]
      );
      const allFormulas = savedFormulas.filter((formula) => !formula.arquivadaEm);
      setArchivedFormulas(savedFormulas.filter((formula) => formula.arquivadaEm));

      // All users with permission see all batidas (remove userId restriction)
      setFormulas(allFormulas);
      setPriceLists(allLists);
      setLocais(allLocais);
      setBrands(allBrands);
      if (settings) setAppSettings(settings);
      setSelectedLocalId((current) => {
        if (allLocais.some((local) => local.id === current)) return current;
        return (
          allLocais.find((local) => local.nome.toLocaleLowerCase('pt-BR').includes('uberaba'))
            ?.id ||
          allLocais[0]?.id ||
          ''
        );
      });

      // Uma única consulta (antes era uma por batida).
      const ldMap: Record<string, boolean> = {};
      products.forEach((product) => {
        if (product.saved_formula_id) ldMap[product.saved_formula_id] = product.linha_diferenciada;
      });
      setLinhasDiferenciadas(ldMap);
    } catch (error) {
      console.error('Error loading formulas data:', error);
      showError('Erro ao carregar fórmulas salvas');
    } finally {
      setLoading(false);
    }
  };

  const permissions = (currentUser.permissions || {}) as Record<string, unknown>;
  const canArchive =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    permissions.savedFormulas_delete !== false;

  const handleArchive = async (formula: SavedFormula) => {
    const ok = await confirm({
      title: 'Arquivar batida?',
      message: `"${formula.name}" sai da lista e da calculadora, junto com o produto formulado ligado a ela. A composição e o histórico de preços ficam guardados, e você pode restaurar em "Arquivadas".`,
      variant: 'warning',
      confirmLabel: 'Arquivar',
    });
    if (!ok) return;
    setArchivingId(formula.id);
    try {
      await setSavedFormulaArchived(formula.id, true);
      showSuccess('Batida arquivada. Você pode restaurá-la em "Arquivadas".');
      setSelectedFormulas((prev) => prev.filter((sid) => sid !== formula.id));
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erro ao arquivar a batida.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (formula: SavedFormula) => {
    setArchivingId(formula.id);
    try {
      await setSavedFormulaArchived(formula.id, false);
      showSuccess(`Batida "${formula.name}" restaurada, com o produto formulado.`);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erro ao restaurar a batida.');
    } finally {
      setArchivingId(null);
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
    const visibleIds = filteredFormulas.map((formula) => formula.id);
    const allVisibleSelected = visibleIds.every((id) => selectedFormulas.includes(id));
    if (allVisibleSelected) {
      setSelectedFormulas((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedFormulas((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  };

  const compatiblePriceLists = getPriceListsForLoadingLocation(priceLists, selectedLocalId)
    .filter((list) => listHasCurrency(list, listCurrency))
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => {
    const firstCompatibleList = compatiblePriceLists[0];
    setSelectedPriceListId((current) =>
      compatiblePriceLists.some((list) => list.id === current)
        ? current
        : firstCompatibleList?.id || ''
    );
  }, [selectedLocalId, priceLists, listCurrency]);

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

  const selectedRawList = compatiblePriceLists.find((l) => l.id === selectedPriceListId);
  // Lista vista na moeda escolhida: preços e produtos daquela moeda.
  const selectedList = selectedRawList
    ? projectPriceList(selectedRawList, listCurrency)
    : undefined;
  const selectedCurrency = getListCurrency(selectedList);
  const sourceFormulas = view === 'ativas' ? formulas : archivedFormulas;

  // Batidas pertencem à organização e podem ser precificadas em qualquer local.
  const normalizedSearch = formulaSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredFormulas = sourceFormulas.filter((formula) => {
    if (!normalizedSearch) return true;
    const materialBrandNames = [...formula.macros, ...formula.micros]
      .map((material) => brands.find((brand) => brand.id === material.brandId)?.name || '')
      .join(' ');
    return [
      formula.name,
      formula.targetFormula,
      formatId(formula.id_numeric, 'BAT-'),
      materialBrandNames,
      ...formula.macros.map((material) => material.name),
      ...formula.micros.map((material) => material.name),
    ]
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedSearch);
  });
  const pagination = usePagination(filteredFormulas, 12);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const allSelected =
    view === 'ativas' &&
    filteredFormulas.length > 0 &&
    filteredFormulas.every((formula) => selectedFormulas.includes(formula.id));

  const openReport = () => {
    if (!selectedLocalId) {
      showError('Selecione o local de carregamento para gerar a proposta.');
      return;
    }
    if (!selectedList) {
      showError('Selecione uma lista de preços vinculada ao local.');
      return;
    }
    setIsReportModalOpen(true);
  };

  const selectClass =
    'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <React.Fragment>
      <div className="space-y-5 pb-12">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-2xl font-black text-stone-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
              <Beaker className="h-5 w-5" />
            </span>
            Batidas Salvas
          </h2>
          <p className="text-[15px] text-stone-500">
            Consulte as batidas, atualize a composição e gere propostas de preços para clientes.
          </p>
        </div>

        {podeVerPropostas && (
          <div
            role="tablist"
            aria-label="Seções de Batidas Salvas"
            className="inline-flex rounded-xl bg-stone-200/70 p-1"
          >
            {(
              [
                ['batidas', 'Batidas', Beaker],
                ['propostas', 'Propostas', ClipboardList],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={pagina === value}
                onClick={() => setPagina(value)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  pagina === value
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {pagina === 'propostas' && podeVerPropostas ? (
          <PropostasPanel
            currentUser={currentUser}
            settings={appSettings}
            reloadKey={propostasReloadKey}
          />
        ) : (
          <>
            {/* Filtros */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.6fr]">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
                    <MapPin className="h-4 w-4" /> Local de carregamento
                  </span>
                  <select
                    value={selectedLocalId}
                    onChange={(e) => setSelectedLocalId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione o local</option>
                    {locais.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor="saved-formulas-price-list"
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500"
                    >
                      <Database className="h-4 w-4" /> Tabela de preços
                    </label>
                    <div
                      role="radiogroup"
                      aria-label="Moeda da tabela de preços"
                      className="inline-flex rounded-lg bg-stone-100 p-0.5"
                    >
                      {(
                        [
                          { value: 'BRL', label: 'R$' },
                          { value: 'USD', label: 'US$' },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={listCurrency === option.value}
                          onClick={() => setListCurrency(option.value)}
                          className={`rounded-md px-2.5 py-0.5 text-xs font-bold transition-colors ${
                            listCurrency === option.value
                              ? option.value === 'USD'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-emerald-600 text-white shadow-sm'
                              : 'text-stone-600 hover:bg-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <select
                    id="saved-formulas-price-list"
                    value={selectedPriceListId}
                    onChange={(e) => setSelectedPriceListId(e.target.value)}
                    className={selectClass}
                  >
                    {compatiblePriceLists.length > 0 ? (
                      compatiblePriceLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {!selectedLocalId
                          ? 'Selecione o local primeiro'
                          : listCurrency === 'USD'
                            ? 'Sem tabela em dólar para este local'
                            : 'Sem tabela para este local'}
                      </option>
                    )}
                  </select>
                </div>
                <label className="block md:col-span-2 xl:col-span-1">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
                    <Search className="h-4 w-4" /> Pesquisar
                  </span>
                  <input
                    type="search"
                    value={formulaSearch}
                    onChange={(event) => setFormulaSearch(event.target.value)}
                    placeholder="Nome, NPK, código BAT, produto ou marca…"
                    className={selectClass}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
                <div
                  role="tablist"
                  aria-label="Situação das batidas"
                  className="inline-flex rounded-xl bg-stone-100 p-1"
                >
                  {(
                    [
                      ['ativas', `Ativas (${formulas.length})`],
                      ['arquivadas', `Arquivadas (${archivedFormulas.length})`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={view === value}
                      onClick={() => setView(value)}
                      className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                        view === value
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {view === 'ativas' && filteredFormulas.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {allSelected
                      ? 'Desmarcar todas'
                      : `Selecionar todas${normalizedSearch ? ' da busca' : ''} (${filteredFormulas.length})`}
                  </button>
                )}
              </div>
            </section>

            {/* Barra de seleção */}
            {view === 'ativas' && selectedFormulas.length > 0 && (
              <section className="sticky top-2 z-20 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 p-4 shadow-md backdrop-blur lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[15px] font-black text-emerald-950">
                    {selectedFormulas.length} batida(s) selecionada(s)
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedFormulas([])}
                    className="text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
                  >
                    Limpar seleção
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex min-w-64 flex-col gap-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    Revisar uma batida antes do relatório
                    <select
                      value={formulaToUpdateId}
                      onChange={(event) => setFormulaToUpdateId(event.target.value)}
                      className="h-10 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-stone-700"
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
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Beaker className="h-4 w-4" /> Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={openReport}
                    disabled={!selectedLocalId || !selectedList}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    <FileText className="h-4 w-4" /> Gerar proposta de preços
                  </button>
                </div>
              </section>
            )}

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
                <SimplifiedCalculatorBeta
                  key={`${formulaInEditor.id}-${selectedLocalId}-${selectedPriceListId}-${listCurrency}`}
                  currentUser={currentUser}
                  embedded
                  initialFormulaToLoad={formulaInEditor}
                  initialBranchId={locais.find((local) => local.id === selectedLocalId)?.filial_id}
                  initialLoadingLocationId={selectedLocalId}
                  initialPriceListId={selectedPriceListId}
                  initialPriceListCurrency={listCurrency}
                  onSavedFormulaSuccess={() => {
                    setFormulaInEditor(null);
                    void loadData();
                  }}
                />
              </section>
            )}

            {filteredFormulas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-stone-100">
                  {view === 'ativas' ? (
                    <Save className="h-7 w-7 text-stone-400" />
                  ) : (
                    <Archive className="h-7 w-7 text-stone-400" />
                  )}
                </div>
                <h3 className="mb-1 text-lg font-bold text-stone-800">
                  {normalizedSearch
                    ? 'Nenhuma batida encontrada para esta busca'
                    : view === 'ativas'
                      ? 'Nenhuma batida salva'
                      : 'Nenhuma batida arquivada'}
                </h3>
                <p className="mx-auto max-w-md text-[15px] text-stone-500">
                  {view === 'ativas'
                    ? 'Na Calculadora, faça uma batida e clique em "Salvar nova batida".'
                    : 'Batidas arquivadas aparecem aqui e podem ser restauradas a qualquer momento.'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pagination.pageItems.map((formula) => {
                    const results = getFormulaCost(formula, selectedList);
                    const isArchived = view === 'arquivadas';
                    const isSelected = !isArchived && selectedFormulas.includes(formula.id);
                    const isLinhaDiferenciada = linhasDiferenciadas[formula.id] === true;
                    const usedMaterials = [
                      ...formula.macros
                        .filter((m) => m.quantity > 0)
                        .map((m) => ({ ...m, kind: 'macro' as const })),
                      ...formula.micros
                        .filter((m) => m.quantity > 0)
                        .map((m) => ({ ...m, kind: 'micro' as const })),
                    ];
                    const microTargets = Object.entries(formula.targetMicros || {}).filter(
                      ([, value]) => Number(value) > 0
                    );
                    return (
                      <article
                        key={formula.id}
                        className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-200'
                            : isArchived
                              ? 'border-stone-200 bg-stone-50/60'
                              : 'border-stone-200'
                        }`}
                      >
                        <header className="flex items-start gap-3 p-4 pb-3">
                          {!isArchived && (
                            <button
                              type="button"
                              onClick={() => toggleSelectFormula(formula.id)}
                              aria-pressed={isSelected}
                              aria-label={`Selecionar ${formula.name}`}
                              className="mt-0.5 shrink-0 text-stone-400 hover:text-emerald-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {formula.id_numeric != null && (
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-700">
                                  {formatId(formula.id_numeric, 'BAT-')}
                                </span>
                              )}
                              {isLinhaDiferenciada && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                                  <Star className="h-3 w-3" /> Linha diferenciada
                                </span>
                              )}
                              {isArchived && formula.arquivadaEm && (
                                <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-xs font-bold text-stone-700">
                                  Arquivada em{' '}
                                  {new Date(formula.arquivadaEm).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <h3 className="text-[15px] font-bold leading-snug text-stone-900">
                              {formula.name}
                            </h3>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="h-3 w-3" /> {formula.userName}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(formula.date).toLocaleDateString('pt-BR')}
                              </span>
                            </p>
                          </div>
                          {canArchive && !isArchived && (
                            <button
                              type="button"
                              onClick={() => void handleArchive(formula)}
                              disabled={archivingId === formula.id}
                              className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
                              title="Arquivar batida"
                              aria-label={`Arquivar ${formula.name}`}
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                        </header>

                        <div className="space-y-3 px-4 pb-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg bg-stone-900 px-2.5 py-1 font-mono text-[15px] font-bold text-white">
                              {formula.targetFormula || '—'}
                            </span>
                            {microTargets.map(([name, value]) => (
                              <span
                                key={name}
                                className="rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-xs font-bold text-cyan-800"
                              >
                                {name} {Number(value).toFixed(2)}%
                              </span>
                            ))}
                          </div>

                          <div className="rounded-xl border border-stone-100 bg-stone-50">
                            <p className="flex justify-between border-b border-stone-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">
                              <span>Composição</span>
                              <span>{usedMaterials.length} produto(s)</span>
                            </p>
                            <ul className="max-h-52 divide-y divide-stone-100 overflow-y-auto">
                              {usedMaterials.map((material) => (
                                <li
                                  key={material.id}
                                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                                >
                                  <span className="flex min-w-0 items-center gap-1.5 text-stone-700">
                                    {material.kind === 'macro' ? (
                                      <Package className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                                    ) : (
                                      <Zap className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                                    )}
                                    <span className="truncate">{material.name}</span>
                                  </span>
                                  <span className="shrink-0 font-mono font-bold tabular-nums text-stone-900">
                                    {Number(material.quantity).toLocaleString('pt-BR', {
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    kg
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {results.missingItems.length > 0 && selectedList && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                <strong>Sem preço nesta tabela:</strong>{' '}
                                {results.missingItems.join(', ')}.
                              </span>
                            </div>
                          )}
                        </div>

                        <footer className="mt-auto flex items-end justify-between gap-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3">
                          <div>
                            <p className="text-xs font-semibold text-stone-500">
                              Custo por tonelada
                            </p>
                            <p className="text-lg font-black tabular-nums text-stone-900">
                              {selectedList
                                ? formatPricingMoney(results.total, selectedCurrency)
                                : 'Selecione uma tabela'}
                            </p>
                          </div>
                          {isArchived ? (
                            canArchive && (
                              <button
                                type="button"
                                onClick={() => void handleRestore(formula)}
                                disabled={archivingId === formula.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <ArchiveRestore className="h-4 w-4" /> Restaurar
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => openFormulaEditor(formula)}
                              disabled={isLinhaDiferenciada || !selectedLocalId || !selectedList}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
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
                              <Beaker className="h-4 w-4" />
                              {isLinhaDiferenciada ? 'Protegida' : 'Atualizar'}
                            </button>
                          )}
                        </footer>
                      </article>
                    );
                  })}
                </div>
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  firstItemNumber={pagination.firstItemNumber}
                  lastItemNumber={pagination.lastItemNumber}
                  pageSize={pagination.pageSize}
                  itemLabel="batidas"
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      <ModalGerarRelatorio
        isOpen={isReportModalOpen}
        formulas={formulas}
        selectedIds={selectedFormulas}
        selectedList={selectedList}
        selectedLocal={locais.find((local) => local.id === selectedLocalId)}
        currentUser={currentUser}
        getFormulaCost={getFormulaCost}
        settings={appSettings}
        onClose={() => setIsReportModalOpen(false)}
        onPropostaCriada={() => setPropostasReloadKey((value) => value + 1)}
      />
    </React.Fragment>
  );
}
