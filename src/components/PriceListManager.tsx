import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, FileText, Plus } from 'lucide-react';
import type { MacroMaterial, MicroMaterial, PriceList, User } from '../types';
import type { LocalCarregamento } from '../types/carregamento';
import {
  countArchivedPriceLists,
  createPriceList,
  deleteOrArchivePriceList,
  getAppSettings,
  getMacroMaterials,
  getMicroMaterials,
  getPriceListsByIds,
  getPriceListsForPdfSelection,
  getPriceListsPage,
  restorePriceList,
  updatePriceList,
} from '../services/db';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { getPriceListPublications } from '../services/priceListPublicationService';
import { buildPriceListPdfGroups, type PriceListPdfGroup } from '../utils/priceListPdfSelection';
import type { PriceListPdfSource } from '../utils/priceListPdfSelection';
import { downloadPriceListPdf } from '../utils/priceListPdfGenerator';
import { listHasCurrency, projectPriceList } from '../utils/priceListCurrency';
import { useToast } from './Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { PriceListPdfSelectionDialog } from './PriceListPdfSelectionDialog';
import { PriceListSidebar } from './priceLists/PriceListSidebar';
import { PriceListEditor } from './priceLists/PriceListEditor';
import {
  buildPriceListSheetRows,
  canManagePriceLists,
  draftFromList,
  emptyDraft,
  findZeroPriceItems,
  getDraftSaveProblem,
  isDraftDirty,
  type PriceListDraft,
} from './priceLists/priceListEditorModel';

interface PriceListManagerProps {
  currentUser: User;
}

const PAGE_SIZE = 8;

const errorMessage = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : fallback;

export default function PriceListManager({ currentUser }: PriceListManagerProps) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const canManage = canManagePriceLists(currentUser);

  // Cadastros
  const [catalogMacros, setCatalogMacros] = useState<MacroMaterial[]>([]);
  const [catalogMicros, setCatalogMicros] = useState<MicroMaterial[]>([]);
  const [locais, setLocais] = useState<LocalCarregamento[]>([]);

  // Coluna das listas
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [listsError, setListsError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [archivedTab, setArchivedTab] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  // Resumo (listas ativas) para os indicadores e o PDF
  const [activeSummary, setActiveSummary] = useState<PriceListPdfSource[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);

  // Editor
  const [selectedList, setSelectedList] = useState<PriceList | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<PriceListDraft | null>(null);
  // Lista salva abre em visualização; o botão Editar libera a edição.
  const [editing, setEditing] = useState(false);
  const [savedDraft, setSavedDraft] = useState<PriceListDraft | undefined>();
  const [saving, setSaving] = useState(false);

  // PDF
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfInitialListId, setPdfInitialListId] = useState<string | undefined>();
  const [pdfGroups, setPdfGroups] = useState<PriceListPdfGroup[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const localName = useCallback(
    (id?: string) => locais.find((local) => local.id === id)?.nome ?? 'Sem local',
    [locais]
  );
  const dirty = draft ? isDraftDirty(draft, isNew ? undefined : savedDraft) : false;

  useEffect(() => {
    Promise.all([getMacroMaterials(), getMicroMaterials()])
      .then(([macros, micros]) => {
        setCatalogMacros(macros);
        setCatalogMicros(micros);
      })
      .catch(() => showError('Não foi possível carregar o cadastro de matérias-primas.'));
    getLocaisAtivos()
      .then(setLocais)
      .catch(() => setLocais([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoadingLists(true);
    setListsError('');
    getPriceListsPage({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      localId: localFilter || undefined,
      archived: archivedTab,
    })
      .then((result) => {
        if (cancelled) return;
        if (page > result.totalPages) {
          setPage(result.totalPages);
          return;
        }
        setLists(result.items);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        if (!cancelled) setListsError('Não foi possível carregar as listas de preço.');
      })
      .finally(() => {
        if (!cancelled) setLoadingLists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, localFilter, archivedTab, reloadToken]);

  useEffect(() => {
    getPriceListsForPdfSelection()
      .then(setActiveSummary)
      .catch(() => setActiveSummary([]));
    countArchivedPriceLists()
      .then(setArchivedCount)
      .catch(() => setArchivedCount(0));
  }, [reloadToken]);

  const kpis = useMemo(() => {
    const latest = activeSummary.reduce<string | undefined>(
      (current, item) => (!current || item.date > current ? item.date : current),
      undefined
    );
    const locaisComLista = new Set(activeSummary.map((item) => item.localId).filter(Boolean));
    return {
      active: activeSummary.length,
      latest: latest ? new Date(latest).toLocaleDateString('pt-BR') : '—',
      locaisComLista: locaisComLista.size,
    };
  }, [activeSummary]);

  /** Pergunta antes de trocar de lista quando há alterações não salvas. */
  const confirmLeave = async () => {
    if (!dirty) return true;
    return confirm({
      title: 'Descartar alterações?',
      message: 'A lista aberta tem alterações que ainda não foram salvas.',
      variant: 'warning',
      confirmLabel: 'Descartar',
    });
  };

  const openList = async (list: PriceList) => {
    if (list.id === selectedList?.id && !isNew) return;
    if (!(await confirmLeave())) return;
    const opened = draftFromList(list);
    setSelectedList(list);
    setIsNew(false);
    setEditing(false);
    setDraft(opened);
    setSavedDraft(draftFromList(list));
  };

  const startNewList = async () => {
    if (!(await confirmLeave())) return;
    setSelectedList(null);
    setIsNew(true);
    setDraft({ ...emptyDraft(), localId: localFilter });
    setSavedDraft(undefined);
  };

  const duplicateList = async () => {
    if (!selectedList || !(await confirmLeave())) return;
    setIsNew(true);
    setDraft(draftFromList(selectedList, true));
    setSavedDraft(undefined);
    showSuccess('Cópia aberta. Ajuste o nome, o local e os preços e clique em "Criar lista".');
  };

  const discard = () => {
    setEditing(false);
    if (isNew) {
      if (selectedList) {
        setIsNew(false);
        setDraft(draftFromList(selectedList));
      } else {
        setDraft(null);
        setIsNew(false);
      }
      return;
    }
    if (selectedList) setDraft(draftFromList(selectedList));
  };

  const save = async () => {
    if (!draft || !canManage) return;
    const problem = getDraftSaveProblem(draft);
    if (problem) {
      showError(problem);
      return;
    }
    const zero = findZeroPriceItems(draft);
    if (zero.length > 0) {
      const proceed = await confirm({
        title: 'Salvar com preço zerado?',
        message:
          zero.length === 1
            ? `"${zero[0].name}" está sem preço e não terá valor nas calculadoras.`
            : `${zero.length} matérias-primas estão sem preço e não terão valor nas calculadoras.`,
        variant: 'warning',
        confirmLabel: 'Salvar mesmo assim',
      });
      if (!proceed) return;
    }
    // A lista guarda os preços em reais (`price`) e em dólar (`priceUSD`) e um
    // único câmbio (R$ por US$).
    const payload = {
      name: draft.name.trim(),
      local_carregamento_id: draft.localId || undefined,
      currency: 'BRL' as const,
      dollarRate: draft.exchangeRate > 0 ? draft.exchangeRate : undefined,
      macros: draft.macros,
      micros: draft.micros,
    };
    setSaving(true);
    try {
      if (isNew || !draft.id) {
        const created = await createPriceList({ ...payload, date: new Date().toISOString() });
        setSelectedList(created);
        setIsNew(false);
        setDraft(draftFromList(created));
        setSavedDraft(draftFromList(created));
        setEditing(false);
        setArchivedTab(false);
        showSuccess('Lista de preço criada.');
      } else {
        await updatePriceList(draft.id, payload);
        const updated: PriceList = {
          ...(selectedList as PriceList),
          ...payload,
          id: draft.id,
        };
        setSelectedList(updated);
        setSavedDraft(draftFromList(updated));
        setEditing(false);
        showSuccess('Lista de preço salva.');
      }
      setReloadToken((value) => value + 1);
    } catch (error) {
      showError(`Erro ao salvar: ${errorMessage(error, 'tente novamente.')}`);
    } finally {
      setSaving(false);
    }
  };

  const removeList = async () => {
    if (!selectedList || !canManage) return;
    const proceed = await confirm({
      title: 'Excluir ou arquivar a lista?',
      message:
        'Se a lista nunca foi usada em uma precificação salva, ela será excluída. ' +
        'Se já foi usada, será arquivada: some das calculadoras, mas continua disponível ' +
        'na aba Arquivadas e nas precificações antigas.',
      variant: 'danger',
      confirmLabel: 'Continuar',
    });
    if (!proceed) return;
    try {
      const result = await deleteOrArchivePriceList(selectedList.id);
      showSuccess(
        result === 'arquivada'
          ? 'A lista já tem precificações salvas e foi arquivada.'
          : 'Lista excluída.'
      );
      setSelectedList(null);
      setDraft(null);
      setSavedDraft(undefined);
      setReloadToken((value) => value + 1);
    } catch (error) {
      showError(errorMessage(error, 'Não foi possível excluir ou arquivar a lista.'));
    }
  };

  const restoreList = async () => {
    if (!selectedList || !canManage) return;
    try {
      await restorePriceList(selectedList.id);
      const restored = { ...selectedList, arquivadoEm: undefined };
      setSelectedList(restored);
      setDraft(draftFromList(restored));
      setSavedDraft(draftFromList(restored));
      setArchivedTab(false);
      setReloadToken((value) => value + 1);
      showSuccess('Lista restaurada. Ela volta a aparecer nas calculadoras.');
    } catch (error) {
      showError(errorMessage(error, 'Não foi possível restaurar a lista.'));
    }
  };

  const exportExcel = async () => {
    if (!draft) return;
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(
        buildPriceListSheetRows(draft, draft.localId ? localName(draft.localId) : 'Sem local')
      );
      sheet['!cols'] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 7 },
        { wch: 9 },
        { wch: 32 },
        { wch: 8 },
        { wch: 13 },
        { wch: 30 },
        { wch: 14 },
      ];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Lista de preço');
      const safeName = draft.name.replace(/[^a-zA-Z0-9À-ÿ]+/g, '-').replace(/^-|-$/g, '');
      XLSX.writeFile(book, `lista-precos-${safeName || 'lista'}.xlsx`);
    } catch {
      showError('Não foi possível gerar a planilha.');
    }
  };

  const openPdf = async (listId?: string) => {
    setPdfInitialListId(listId);
    setPdfOpen(true);
    setPdfLoading(true);
    setPdfError('');
    try {
      const [sources, publications] = await Promise.all([
        getPriceListsForPdfSelection(),
        getPriceListPublications(),
      ]);
      const names = new Map(locais.map((local) => [local.id, local.nome] as const));
      setPdfGroups(buildPriceListPdfGroups(sources, publications, names));
    } catch {
      setPdfError('Não foi possível carregar as listas e os locais disponíveis.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      {pdfOpen && (
        <PriceListPdfSelectionDialog
          groups={pdfGroups}
          loading={pdfLoading}
          error={pdfError}
          initialListId={pdfInitialListId}
          onClose={() => setPdfOpen(false)}
          onConfirm={async (selection) => {
            try {
              const [selectedLists, settings] = await Promise.all([
                getPriceListsByIds(selection.listIds),
                getAppSettings(),
              ]);
              if (selectedLists.length !== selection.listIds.length) {
                throw new Error('Uma ou mais listas selecionadas não estão mais disponíveis.');
              }
              if (!selectedLists.some((list) => listHasCurrency(list, selection.currency))) {
                throw new Error(
                  selection.currency === 'USD'
                    ? 'Nenhuma lista selecionada tem preços em dólar.'
                    : 'Nenhuma lista selecionada tem preços em reais.'
                );
              }
              const projected = selectedLists.map((list) =>
                projectPriceList(list, selection.currency)
              );
              downloadPriceListPdf({
                group: {
                  ...selection.group,
                  notes: selection.notes,
                  currency: selection.currency,
                  exchangeRate:
                    selection.currency === 'USD'
                      ? projected.find((list) => list.exchangeRate)?.exchangeRate
                      : undefined,
                },
                lists: projected,
                locationNames: new Map(locais.map((local) => [local.id, local.nome] as const)),
                settings,
              });
              setPdfOpen(false);
              showSuccess('PDF da lista de preços gerado.');
            } catch (error) {
              showError(errorMessage(error, 'Não foi possível gerar o PDF da lista de preços.'));
            }
          }}
        />
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            Precificação
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight text-stone-900">
            <Database className="h-7 w-7 text-emerald-600" aria-hidden="true" />
            Listas de Preço
          </h1>
          <p className="mt-1 text-[15px] text-stone-500">
            Escolha uma lista para ver e editar os preços ao lado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openPdf(selectedList?.arquivadoEm ? undefined : selectedList?.id)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
          >
            <FileText className="h-4 w-4" /> Preparar PDF
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => void startNewList()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Nova lista
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Listas ativas</p>
          <p className="mt-1 text-2xl font-black text-stone-900">{kpis.active}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            Última atualização
          </p>
          <p className="mt-1 text-2xl font-black text-stone-900">{kpis.latest}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            Locais com lista
          </p>
          <p className="mt-1 text-2xl font-black text-stone-900">
            {kpis.locaisComLista}{' '}
            <span className="text-sm font-bold text-stone-400">de {locais.length}</span>
          </p>
        </div>
        {(() => {
          const zero = draft ? findZeroPriceItems(draft).length : 0;
          return (
            <div
              className={`rounded-2xl border p-4 shadow-sm ${
                zero > 0 ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wide ${
                  zero > 0 ? 'text-amber-600' : 'text-stone-400'
                }`}
              >
                Preços zerados
              </p>
              <p
                className={`mt-1 text-2xl font-black ${zero > 0 ? 'text-amber-700' : 'text-stone-900'}`}
              >
                {draft ? zero : '—'}{' '}
                <span className="text-sm font-bold">{draft ? 'na lista aberta' : ''}</span>
              </p>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <PriceListSidebar
          lists={lists}
          loading={loadingLists}
          error={listsError}
          selectedId={isNew ? undefined : selectedList?.id}
          search={search}
          onSearchChange={setSearch}
          localId={localFilter}
          onLocalChange={(value) => {
            setLocalFilter(value);
            setPage(1);
          }}
          archived={archivedTab}
          onArchivedChange={(value) => {
            setArchivedTab(value);
            setPage(1);
          }}
          activeCount={kpis.active}
          archivedCount={archivedCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          locais={locais}
          localName={localName}
          onSelect={(list) => void openList(list)}
        />

        {draft ? (
          <PriceListEditor
            draft={draft}
            onChange={setDraft}
            isNew={isNew}
            archivedAt={isNew ? undefined : selectedList?.arquivadoEm}
            createdAt={isNew ? undefined : selectedList?.date}
            idNumeric={isNew ? undefined : selectedList?.idNumeric}
            canManage={canManage}
            editing={editing}
            onEdit={() => setEditing(true)}
            dirty={dirty}
            saving={saving}
            catalogMacros={catalogMacros}
            catalogMicros={catalogMicros}
            locais={locais}
            onSave={() => void save()}
            onDiscard={discard}
            onDuplicate={() => void duplicateList()}
            onExportExcel={() => void exportExcel()}
            onPdf={() => void openPdf(selectedList?.id)}
            onRemove={() => void removeList()}
            onRestore={() => void restoreList()}
          />
        ) : (
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <Database className="h-10 w-10 text-stone-300" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-stone-800">Nenhuma lista aberta</h2>
            <p className="mt-1 max-w-sm text-[15px] text-stone-500">
              Escolha uma lista à esquerda para ver os preços
              {canManage ? ' ou crie uma nova.' : '.'}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => void startNewList()}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> Nova lista
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
