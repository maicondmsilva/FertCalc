import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSavedFormulas, getPriceLists, getAppSettings, getBrands } from '../services/db';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { getProdutosFormulados } from '../services/produtosFormuladosService';
import { setSavedFormulaArchived } from '../services/savedFormulaService';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import {
  SavedFormula,
  User,
  PriceList,
  PriceListCurrency,
  AppSettings,
  Brand,
  PricingFactors as SavedFormulaFactors,
} from '../types';
import { LocalCarregamento } from '../types/carregamento';
import { formatId } from '../utils/formatId';
import {
  Beaker,
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
  ClipboardList,
} from 'lucide-react';
import PropostasPanel from './propostas/PropostasPanel';
import NovaPropostaModal from './propostas/NovaPropostaModal';
import { permissoesProposta } from './propostas/propostaPermissions';
import { converterProposta } from '../services/propostaService';
import type { CalculatorProposalDraft } from '../hooks/useCalculator';
import type { Proposta } from '../types/proposta';
import { formatNumeroProposta } from '../utils/propostaModel';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import {
  getFormulaUpdateProtection,
  getPriceListsForLoadingLocation,
} from '../utils/savedFormulaWorkflow';
import SimplifiedCalculatorBeta from './calculatorBeta/SimplifiedCalculatorBeta';
import { formatPricingMoney } from '../utils/pricingCurrency';
import { listHasCurrency, projectPriceList } from '../utils/priceListCurrency';

interface SavedFormulasProps {
  currentUser: User;
}

const getListCurrency = (list?: PriceList): PriceListCurrency => list?.currency ?? 'BRL';

export default function SavedFormulas({ currentUser }: SavedFormulasProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [formulas, setFormulas] = useState<SavedFormula[]>([]);
  const [archivedFormulas, setArchivedFormulas] = useState<SavedFormula[]>([]);
  const [view, setView] = useState<'ativas' | 'arquivadas'>('ativas');
  // Aviso clicado (?aba=propostas&proposta=<id>): abre a aba e a proposta.
  const location = useLocation();
  const linkParams = new URLSearchParams(location.search);
  const propostaDoLink = linkParams.get('proposta');
  const [pagina, setPagina] = useState<'batidas' | 'propostas'>(
    linkParams.get('aba') === 'propostas' ? 'propostas' : 'batidas'
  );
  useEffect(() => {
    if (new URLSearchParams(location.search).get('aba') === 'propostas') setPagina('propostas');
  }, [location.search]);
  const [propostasReloadKey, setPropostasReloadKey] = useState(0);
  const podeVerPropostas = permissoesProposta(currentUser).ver;
  // Precificação a partir de uma proposta aceita pelo cliente.
  const [propostaEmPrecificacao, setPropostaEmPrecificacao] = useState<{
    proposta: Proposta;
    draft: CalculatorProposalDraft;
  } | null>(null);
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

  const abrirPrecificacaoDaProposta = (proposta: Proposta) => {
    const aceitos = proposta.resposta?.tipo === 'aceite' ? proposta.resposta.itens : [];
    const todas = [...formulas, ...archivedFormulas];
    const montados = aceitos
      .filter((aceito) => aceito.quantidade > 0)
      .map((aceito) => {
        const item = (proposta.itens || []).find((entry) => entry.id === aceito.id);
        const fotografia = item?.formula;
        // A batida como fechou na proposta; propostas antigas usam a batida atual.
        const formula: SavedFormula | undefined = fotografia
          ? {
              id: item?.savedFormulaId || aceito.savedFormulaId || aceito.id,
              userId: currentUser.id,
              userName: currentUser.name,
              name: item?.formulaNome || aceito.nome,
              date: proposta.createdAt,
              targetFormula: fotografia.targetFormula,
              category: fotografia.category as SavedFormula['category'],
              targetCa: fotografia.targetCa,
              targetS: fotografia.targetS,
              targetMicros: fotografia.targetMicros,
              macros: fotografia.macros,
              micros: fotografia.micros,
            }
          : todas.find((entry) => entry.id === aceito.savedFormulaId);
        const { totalTons: _ignorado, ...condicoes } = (item?.fatores || {}) as Record<
          string,
          unknown
        >;
        return {
          nome: aceito.nome,
          formula,
          tons: aceito.quantidade,
          factors: condicoes as Partial<SavedFormulaFactors>,
          expectedPrice: item?.precoTonelada ?? aceito.precoTonelada,
        };
      });
    const faltando = montados.filter((item) => !item.formula).map((item) => item.nome);
    const validos = montados.filter(
      (item): item is (typeof montados)[number] & { formula: SavedFormula } => Boolean(item.formula)
    );
    if (validos.length === 0) {
      showError('As batidas desta proposta não estão mais disponíveis para precificar.');
      return;
    }
    if (faltando.length > 0) {
      showError(`Sem a batida cadastrada (ficaram de fora): ${faltando.join(', ')}.`);
    }
    setFormulaInEditor(null);
    setPropostaEmPrecificacao({
      proposta,
      draft: {
        key: `${proposta.id}-${Date.now()}`,
        formulas: validos.map(({ formula, tons, factors, expectedPrice }) => ({
          formula,
          tons,
          factors,
          expectedPrice,
        })),
        clientId: proposta.clientId,
        regionId: proposta.regionId,
        loadingLocationId: proposta.localCarregamentoId,
        priceListId: proposta.priceListId,
        priceListCurrency: proposta.moeda,
        appliedExchangeRate: proposta.moeda === 'USD' ? proposta.taxaCambio : undefined,
      },
    });
    setPagina('batidas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            onGerarPrecificacao={abrirPrecificacaoDaProposta}
            abrirPropostaId={propostaDoLink}
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

            {propostaEmPrecificacao && (
              <section className="rounded-2xl border-2 border-blue-300 bg-stone-50 p-3 shadow-lg sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                      Precificação a partir do aceite
                    </p>
                    <h3 className="text-lg font-bold text-stone-900">
                      {formatNumeroProposta(propostaEmPrecificacao.proposta.numero)} ·{' '}
                      {propostaEmPrecificacao.proposta.clienteNome}
                    </h3>
                    <p className="text-sm text-stone-600">
                      Produtos e quantidades que o cliente aceitou. Calcule, confira e salve a
                      precificação; ela fica ligada à proposta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPropostaEmPrecificacao(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100"
                  >
                    <X className="h-4 w-4" /> Fechar calculadora
                  </button>
                </div>
                <SimplifiedCalculatorBeta
                  key={propostaEmPrecificacao.draft.key}
                  currentUser={currentUser}
                  embedded
                  initialProposal={propostaEmPrecificacao.draft}
                  onSaveSuccess={(record) => {
                    const { proposta } = propostaEmPrecificacao;
                    void converterProposta(proposta.id, record.id)
                      .then(() => {
                        showSuccess(
                          `Precificação salva e ligada à ${formatNumeroProposta(proposta.numero)}.`
                        );
                        setPropostaEmPrecificacao(null);
                        setPropostasReloadKey((value) => value + 1);
                      })
                      .catch((error: unknown) =>
                        showError(
                          error instanceof Error
                            ? error.message
                            : 'Precificação salva, mas não foi possível ligar à proposta.'
                        )
                      );
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

      <NovaPropostaModal
        isOpen={isReportModalOpen}
        formulas={formulas.filter((formula) => selectedFormulas.includes(formula.id))}
        selectedList={selectedList}
        selectedLocal={locais.find((local) => local.id === selectedLocalId)}
        currentUser={currentUser}
        getFormulaCost={getFormulaCost}
        settings={appSettings}
        onClose={() => setIsReportModalOpen(false)}
        onPropostaCriada={() => setPropostasReloadKey((value) => value + 1)}
        onVerPropostas={() => {
          setIsReportModalOpen(false);
          setPagina('propostas');
        }}
      />
    </React.Fragment>
  );
}
