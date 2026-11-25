import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  Box,
  Database,
  FlaskConical,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import { Brand, CompatibilityCategory, Embalagem, NutrientType, UnifiedProduct } from '../types';
import {
  deleteUnifiedProduct,
  getBrands,
  getCompatibilityCategories,
  getProductUsage,
  getUnifiedProducts,
  saveUnifiedProduct,
  updateProductActiveStatus,
} from '../services/db';
import {
  createEmbalagem,
  deleteEmbalagem,
  getEmbalagens,
  updateEmbalagem,
} from '../services/embalagensService';
import { getNutrientes, type Nutriente } from '../services/nutrientesService';
import { getLocaisAtivos } from '../services/locaisCarregamentoService';
import { LocalCarregamento } from '../types/carregamento';
import { useToast } from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ui/ConfirmDialog';
import BrandManager from './BrandManager';
import IncompatibilityManager from './IncompatibilityManager';
import CompatibilityCategoryManager from './CompatibilityCategoryManager';
import NutrientManager from './products/NutrientManager';
import ProductFormModal from './products/ProductFormModal';
import EmbalagemFormModal from './products/EmbalagemFormModal';
import { EmbalagemTable, ProductTable } from './products/CatalogTables';
import { CatalogModal, fieldClass } from './products/catalogUi';
import { summarizeProducts } from './products/productManagerModel';

type Tab = NutrientType | 'embalagem' | 'marca' | 'nutriente' | 'incompatibilidade';

function nextCode(items: { code: string }[]): string {
  if (items.length === 0) return '1';
  const nums = items.map((i) => parseInt(i.code, 10)).filter((n) => !isNaN(n));
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
}

function getSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const databaseError = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [databaseError.message, databaseError.details, databaseError.hint].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (parts.length > 0) return [...new Set(parts)].join(' ');
  }
  return 'Não foi possível salvar o produto. Verifique os dados e tente novamente.';
}

const emptyProduct = (type: NutrientType): Partial<UnifiedProduct> => ({
  type,
  name: '',
  code: '',
  minQuantity: 0,
  maxQuantity: 0,
  categories: [],
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  brandId: '',
  description: '',
  price: undefined,
  availableInCalculatorWithoutPriceList: false,
  extraLoadingLocationIds: [],
});

/**
 * Cadastro de Matéria-Prima: orquestra as abas (macros, micros, produto acabado,
 * embalagens, marcas, nutrientes e incompatibilidade), os dados e os modais.
 */
export default function ProductManager({
  canManage = true,
  initialTab = 'macro',
}: {
  canManage?: boolean;
  initialTab?: Tab;
}) {
  const { showSuccess, showError } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [nutrientes, setNutrientes] = useState<Nutriente[]>([]);
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<CompatibilityCategory[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<LocalCarregamento[]>([]);

  const [tableLoading, setTableLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  const [form, setForm] = useState<Partial<UnifiedProduct>>(emptyProduct('macro'));
  const [editingId, setEditingId] = useState<string | null>(null);

  // ─── Embalagem state ─────────────────────────────────────────
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [isEmbalagemModalOpen, setIsEmbalagemModalOpen] = useState(false);
  const [embalagemForm, setEmbalagemForm] = useState<Partial<Embalagem>>({
    nome: '',
    cobrar: false,
    descontar: false,
    valor_cobrar: null,
    valor_descontar: null,
    ativo: true,
  });
  const [editingEmbalagemId, setEditingEmbalagemId] = useState<string | null>(null);
  const [savingEmbalagem, setSavingEmbalagem] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setTableLoading(true);
    const [p, b, c, embs, locations] = await Promise.all([
      getUnifiedProducts(),
      getBrands(),
      getCompatibilityCategories(),
      getEmbalagens(),
      getLocaisAtivos(),
    ]);
    setProducts(p);
    setBrands(b);
    setCategories(c);
    setEmbalagens(embs);
    setLoadingLocations(locations);
    setTableLoading(false);
    // Uso em listas/batidas/precificações: só informativo, a tela funciona sem ele.
    getProductUsage()
      .then(setUsage)
      .catch((error) => console.error('[produtos] uso:', error));
    loadNutrientes();
  };

  const loadNutrientes = () => {
    getNutrientes()
      .then(setNutrientes)
      .catch((error) => console.error('[produtos] nutrientes:', error));
  };

  const currentItems = products.filter((p) => p.type === (tab as NutrientType));
  const filtered = currentItems.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.ativo !== false) ||
      (statusFilter === 'inactive' && p.ativo === false);
    return matchesSearch && matchesStatus;
  });
  const filteredEmbalagens = embalagens.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    if (tab === 'embalagem') {
      setEditingEmbalagemId(null);
      setEmbalagemForm({
        nome: '',
        cobrar: false,
        descontar: false,
        valor_cobrar: null,
        valor_descontar: null,
        ativo: true,
      });
      setIsEmbalagemModalOpen(true);
      return;
    }
    setEditingId(null);
    setViewMode(false);
    setForm(emptyProduct(tab as NutrientType));
    setIsModalOpen(true);
  };

  const openEdit = (item: UnifiedProduct, readOnly = false) => {
    setEditingId(item.id);
    setViewMode(readOnly);
    setForm({
      ...item,
      microGuarantees: item.microGuarantees || [],
      categories: item.categories || [],
    });
    setIsModalOpen(true);
  };

  const openEmbalagemEdit = (emb: Embalagem) => {
    const descontar = emb.descontar ?? emb.desconto ?? false;
    const valorCobrar = emb.valor_cobrar ?? (emb.cobrar ? emb.valor || 0 : null);
    const valorDescontar = emb.valor_descontar ?? (descontar ? emb.valor || 0 : null);

    setEditingEmbalagemId(emb.id);
    setEmbalagemForm({
      ...emb,
      descontar,
      valor_cobrar: valorCobrar,
      valor_descontar: valorDescontar,
    });
    setIsEmbalagemModalOpen(true);
  };

  const handleSaveEmbalagem = async () => {
    if (!embalagemForm.nome?.trim()) {
      showError('Nome é obrigatório.');
      return;
    }
    setSavingEmbalagem(true);
    try {
      const payload: Partial<Embalagem> = {
        nome: embalagemForm.nome,
        cobrar: embalagemForm.cobrar ?? false,
        descontar: embalagemForm.descontar ?? false,
        valor_cobrar: embalagemForm.cobrar ? (embalagemForm.valor_cobrar ?? 0) : null,
        valor_descontar: embalagemForm.descontar ? (embalagemForm.valor_descontar ?? 0) : null,
        ativo: embalagemForm.ativo ?? true,
      };
      if (editingEmbalagemId) {
        await updateEmbalagem(editingEmbalagemId, payload);
      } else {
        await createEmbalagem(payload);
      }
      showSuccess('Embalagem salva com sucesso!');
      const embs = await getEmbalagens();
      setEmbalagens(embs);
      setIsEmbalagemModalOpen(false);
    } catch (err) {
      showError(`Erro ao salvar: ${err instanceof Error ? err.message : 'Tente novamente.'}`);
    } finally {
      setSavingEmbalagem(false);
    }
  };

  const handleToggleEmbalagemAtivo = async (emb: Embalagem) => {
    try {
      await updateEmbalagem(emb.id, { ativo: !emb.ativo });
      setEmbalagens((prev) => prev.map((e) => (e.id === emb.id ? { ...e, ativo: !e.ativo } : e)));
      showSuccess(`Embalagem ${!emb.ativo ? 'ativada' : 'desativada'} com sucesso!`);
    } catch {
      showError('Erro ao alterar status da embalagem.');
    }
  };

  const handleDeleteEmbalagem = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Embalagem',
      message: 'Tem certeza que deseja excluir esta embalagem?',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEmbalagem(id);
      setEmbalagens((prev) => prev.filter((e) => e.id !== id));
      showSuccess('Embalagem excluída com sucesso!');
    } catch {
      showError('Erro ao excluir embalagem.');
    }
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!form.name?.trim()) {
        showError('Nome é obrigatório.');
        return;
      }
      if (Number(form.minQuantity) < 0 || Number(form.maxQuantity) < 0) {
        showError('As quantidades mínima e máxima não podem ser negativas.');
        return;
      }
      if (
        form.type !== 'finished' &&
        Number(form.maxQuantity) > 0 &&
        Number(form.minQuantity) > Number(form.maxQuantity)
      ) {
        showError('A quantidade mínima não pode ser maior que a quantidade máxima.');
        return;
      }
      if (
        form.availableInCalculatorWithoutPriceList &&
        (form.extraLoadingLocationIds || []).length === 0
      ) {
        showError('Selecione ao menos um local para disponibilizar o produto extra.');
        return;
      }

      const payload = {
        ...form,
        code: editingId
          ? products.find((p) => p.id === editingId)?.code || '1'
          : nextCode(products.filter((p) => p.type === form.type)),
        microGuarantees: (form.microGuarantees || []).filter((g) => g.name.trim()),
      };

      await saveUnifiedProduct(payload, editingId || undefined);
      showSuccess('Produto salvo com sucesso!');
      await loadAll();
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      showError(`Erro ao salvar: ${getSaveErrorMessage(err)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, type: NutrientType) => {
    const ok = await confirm({
      title: 'Excluir produto?',
      message:
        'Se o produto nunca foi usado em lista de preço, batida ou precificação, ele será ' +
        'excluído. Se já foi usado, será desativado: some das calculadoras e continua nos ' +
        'registros antigos (pode ser reativado depois).',
      variant: 'danger',
      confirmLabel: 'Continuar',
    });
    if (!ok) return;
    try {
      const result = await deleteUnifiedProduct(id, type);
      showSuccess(
        result === 'desativado'
          ? 'O produto já foi usado e foi desativado. Para usar de novo, reative-o.'
          : 'Produto excluído.'
      );
      await loadAll();
    } catch (error) {
      showError(
        `Erro ao excluir produto: ${error instanceof Error ? error.message : (error as { message?: string })?.message || 'tente novamente.'}`
      );
    }
  };

  const handleToggleProductActive = async (item: UnifiedProduct) => {
    if (item.type !== 'macro' && item.type !== 'micro') return;
    try {
      await updateProductActiveStatus(item.id, item.type, item.ativo === false);
      setProducts((current) =>
        current.map((product) =>
          product.id === item.id ? { ...product, ativo: item.ativo === false } : product
        )
      );
      showSuccess(`Produto ${item.ativo === false ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      showError(
        `Erro ao alterar status: ${error instanceof Error ? error.message : 'Tente novamente.'}`
      );
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'macro', label: 'Macros', icon: <Database className="h-4 w-4" /> },
    { key: 'micro', label: 'Micros', icon: <FlaskConical className="h-4 w-4" /> },
    { key: 'finished', label: 'Produto Acabado', icon: <Box className="h-4 w-4" /> },
    { key: 'embalagem', label: 'Embalagens', icon: <ShoppingBag className="h-4 w-4" /> },
    { key: 'marca', label: 'Marcas', icon: <Tag className="h-4 w-4" /> },
    { key: 'nutriente', label: 'Nutrientes', icon: <Atom className="h-4 w-4" /> },
    {
      key: 'incompatibilidade',
      label: 'Incompatibilidade',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ];
  const isProductTab = tab === 'macro' || tab === 'micro' || tab === 'finished';
  const hasListTools = isProductTab || tab === 'embalagem';
  const summary = summarizeProducts(products, embalagens, new Set(brands.map((b) => b.id)));
  const kpis = [
    { label: 'Matérias-primas ativas', value: summary.ativos, tone: 'text-emerald-700' },
    { label: 'Inativas', value: summary.inativos, tone: 'text-stone-500' },
    {
      label: 'Macros sem marca',
      value: summary.macrosSemMarca,
      tone: summary.macrosSemMarca > 0 ? 'text-amber-700' : 'text-stone-500',
    },
    { label: 'Embalagens ativas', value: summary.embalagensAtivas, tone: 'text-blue-700' },
  ];
  const tabCount = (key: Tab) =>
    key === 'embalagem'
      ? embalagens.length
      : key === 'macro' || key === 'micro' || key === 'finished'
        ? products.filter((product) => product.type === key).length
        : key === 'nutriente'
          ? nutrientes.length
          : key === 'marca'
            ? brands.length
            : undefined;

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    void loadAll();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-stone-900">
            <Package className="h-7 w-7 text-emerald-600" />
            Cadastro de Matéria-Prima
          </h1>
          <p className="text-sm text-stone-500">
            Matérias-primas, produto acabado, embalagens, marcas, nutrientes e incompatibilidades
            usados nas calculadoras.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!canManage && (
            <span className="self-center rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
              Somente leitura
            </span>
          )}
          {canManage && isProductTab && tab !== 'finished' && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              <Settings className="h-4 w-4" /> Categorias
            </button>
          )}
          {canManage && hasListTools && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {tab === 'embalagem' ? 'Nova embalagem' : 'Novo produto'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <span className="block text-xs font-bold uppercase tracking-wide text-stone-500">
              {kpi.label}
            </span>
            <span className={`mt-1 block text-3xl font-black ${kpi.tone}`}>{kpi.value}</span>
          </div>
        ))}
      </div>

      <nav
        aria-label="Seções do cadastro"
        className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1"
      >
        {tabs.map((item) => {
          const count = tabCount(item.key);
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                active ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.icon}
              {item.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[11px] ${
                    active ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {hasListTools && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder={tab === 'embalagem' ? 'Buscar embalagem…' : 'Buscar por nome ou código…'}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar"
              className={`${fieldClass} pl-9`}
            />
          </div>
          {(tab === 'macro' || tab === 'micro') && (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              aria-label="Filtrar por status"
              className={`${fieldClass} sm:w-48`}
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          )}
        </div>
      )}

      {tab === 'incompatibilidade' ? (
        <IncompatibilityManager canManage={canManage} />
      ) : tab === 'nutriente' ? (
        <NutrientManager nutrientes={nutrientes} canManage={canManage} onChanged={loadNutrientes} />
      ) : tab === 'marca' ? (
        <BrandManager canManage={canManage} />
      ) : tab === 'embalagem' ? (
        <EmbalagemTable
          items={filteredEmbalagens}
          loading={tableLoading}
          canManage={canManage}
          onEdit={openEmbalagemEdit}
          onToggle={(item) => void handleToggleEmbalagemAtivo(item)}
          onDelete={(item) => void handleDeleteEmbalagem(item.id)}
        />
      ) : (
        <ProductTable
          type={tab as NutrientType}
          items={filtered}
          loading={tableLoading}
          brands={brands}
          categories={categories}
          usage={usage}
          canManage={canManage}
          onView={(item) => openEdit(item, true)}
          onEdit={(item) => openEdit(item, false)}
          onToggle={(item) => void handleToggleProductActive(item)}
          onDelete={(item) => void handleDelete(item.id, item.type!)}
        />
      )}

      <ProductFormModal
        isOpen={isModalOpen}
        type={(form.type || 'macro') as NutrientType}
        form={form}
        onChange={setForm}
        viewMode={viewMode}
        isEditing={!!editingId}
        saving={saving}
        brands={brands}
        categories={categories}
        nutrientes={nutrientes}
        loadingLocations={loadingLocations}
        onSave={() => void handleSave()}
        onClose={() => setIsModalOpen(false)}
      />

      <EmbalagemFormModal
        isOpen={isEmbalagemModalOpen}
        form={embalagemForm}
        onChange={setEmbalagemForm}
        isEditing={!!editingEmbalagemId}
        saving={savingEmbalagem}
        onSave={() => void handleSaveEmbalagem()}
        onClose={() => setIsEmbalagemModalOpen(false)}
      />

      <CatalogModal
        isOpen={isCategoryModalOpen}
        size="xl"
        title="Categorias de matéria-prima"
        subtitle="Agrupam produtos que podem substituir uns aos outros na calculadora."
        icon={<Settings className="h-5 w-5" />}
        onClose={closeCategoryModal}
      >
        <CompatibilityCategoryManager />
      </CatalogModal>

      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
