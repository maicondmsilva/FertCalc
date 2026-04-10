import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Plus,
  Save,
  Trash2,
  Edit2,
  HelpCircle,
  Target,
  Settings,
  BarChart3,
  Calendar as CalendarIcon,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type {
  Unidade,
  Indicador,
  MetaMensal,
  ConfiguracaoIndicador,
  DiasUteisMes,
  Categoria,
} from '../../types';
import { gerarIdsVisuais, cn } from '../../utils/managementUtils';
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  SortableIndicadorRow,
  SortableCategoryRow,
} from './ManagementUI';
import { PromptDialog } from '../ui/PromptDialog';

const MotionDiv = motion.div as any;
const AnimatePresenceComponent = AnimatePresence as any;

interface ManagementCadastrosProps {
  unidades: Unidade[];
  indicadores: Indicador[];
  categorias: Categoria[];
  metas: MetaMensal[];
  configs: ConfiguracaoIndicador[];
  diasUteis: DiasUteisMes[];
  onSaveUnidade: (u: Unidade) => Promise<void>;
  onSaveIndicador: (i: Indicador) => Promise<void>;
  onSaveCategoria: (c: Categoria) => Promise<void>;
  onSaveMeta: (m: MetaMensal) => Promise<void>;
  onSaveConfig: (c: ConfiguracaoIndicador) => Promise<void>;
  onSaveDiasUteis: (d: DiasUteisMes) => Promise<void>;
  onDeleteUnidade: (id: string) => Promise<void>;
  onDeleteIndicador: (id: string) => Promise<void>;
  onDeleteCategoria: (id: string) => Promise<void>;
  onDeleteMeta: (id: string) => Promise<void>;
  onDeleteConfig: (unidade_id: string, indicador_id: string) => Promise<void>;
  onDeleteDiasUteis: (unidade_id: string, ano: number, mes: number) => Promise<void>;
}

export default function ManagementCadastros({
  unidades,
  indicadores,
  categorias,
  metas,
  configs,
  diasUteis,
  onSaveUnidade,
  onSaveIndicador,
  onSaveCategoria,
  onSaveMeta,
  onSaveConfig,
  onSaveDiasUteis,
  onDeleteUnidade,
  onDeleteIndicador,
  onDeleteCategoria,
  onDeleteMeta,
  onDeleteConfig,
  onDeleteDiasUteis,
}: ManagementCadastrosProps) {
  const [activeTab, setActiveTab] = useState<
    'indicadores' | 'categorias' | 'metas' | 'config-unidades' | 'dias-uteis' | 'guia' | 'unidades'
  >('categorias');
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [diasUteisPrompt, setDiasUteisPrompt] = useState<{
    isOpen: boolean;
    defaultValue: string;
    onConfirm: (v: string) => void;
  }>({ isOpen: false, defaultValue: '', onConfirm: () => {} });
  const [localNomes, setLocalNomes] = useState<Record<string, string>>({});
  const [localVisiveis, setLocalVisiveis] = useState<Record<string, boolean>>({});
  const [localCores, setLocalCores] = useState<Record<string, string>>({});
  const [savingConfigs, setSavingConfigs] = useState<Record<string, boolean>>({});
  const [deletingConfigs, setDeletingConfigs] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'unidade' | 'indicador' | 'categoria' | 'meta' | null>(
    null
  );
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDigitavel, setIsDigitavel] = useState(true);

  useEffect(() => {
    if (!selectedUnidade) return;
    const nomesInit: Record<string, string> = {};
    const visiveisInit: Record<string, boolean> = {};
    const coresInit: Record<string, string> = {};
    indicadores.forEach((i) => {
      const config = configs.find(
        (c) => c.unidade_id === selectedUnidade && c.indicador_id === i.id
      );
      nomesInit[i.id] = config?.nome_personalizado || '';
      visiveisInit[i.id] = config?.visivel ?? true;
      coresInit[i.id] = config?.cor_fundo || '#ffffff';
    });
    setLocalNomes(nomesInit);
    setLocalVisiveis(visiveisInit);
    setLocalCores(coresInit);
  }, [selectedUnidade, configs, indicadores]);

  const { visualIdMap } = useMemo(
    () => gerarIdsVisuais(indicadores, categorias),
    [indicadores, categorias]
  );

  const handleOpenModal = (
    type: 'unidade' | 'indicador' | 'categoria' | 'meta',
    item: Unidade | Indicador | Categoria | MetaMensal | null = null
  ) => {
    setModalType(type);
    setEditingItem(item);
    setIsDigitavel(type === 'indicador' ? (item ? (item as Indicador).digitavel : true) : true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setEditingItem(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent, category: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const categoryIndicadores = indicadores
        .filter((i) => i.categoria === category)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const oldIndex = categoryIndicadores.findIndex((i) => i.id === active.id);
      const newIndex = categoryIndicadores.findIndex((i) => i.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(categoryIndicadores, oldIndex, newIndex);
        // Update order for all indicators in this category
        await Promise.all(newOrder.map((ind, idx) => onSaveIndicador({ ...ind, ordem: idx + 1 })));
      }
    }
  };

  const handleDragEndCategories = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sortedCategories = [...categorias].sort((a, b) => a.ordem - b.ordem);
      const oldIndex = sortedCategories.findIndex((c) => c.id === active.id);
      const newIndex = sortedCategories.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await Promise.all(newOrder.map((cat, idx) => onSaveCategoria({ ...cat, ordem: idx + 1 })));
      }
    }
  };

  const handleToggleCategoriaVisibilidadeCapa = async (cat: Categoria) => {
    const updated = { ...cat, visivel_capa: !(cat.visivel_capa ?? true) };
    try {
      await onSaveCategoria(updated);
    } catch (error) {
      console.error('Erro ao alterar visibilidade da categoria na capa:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações e Cadastros</h1>
        <p className="text-slate-500">Gerencie a estrutura do sistema</p>
      </div>

      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        {[
          { id: 'categorias', label: 'Categorias', icon: LayoutDashboard },
          { id: 'indicadores', label: 'Indicadores', icon: BarChart3 },
          { id: 'metas', label: 'Metas Mensais', icon: Target },
          { id: 'config-unidades', label: 'Personalização', icon: Settings },
          { id: 'dias-uteis', label: 'Dias Úteis', icon: CalendarIcon },
          { id: 'guia', label: 'Guia de Cálculos', icon: HelpCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 py-4 px-1 border-b-2 transition-colors text-sm font-medium whitespace-nowrap',
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresenceComponent mode="wait">
        {isModalOpen && (
          <Modal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={
              editingItem
                ? `Editar ${modalType === 'unidade' ? 'Unidade' : modalType === 'indicador' ? 'Indicador' : modalType === 'categoria' ? 'Categoria' : 'Meta'}`
                : `Nova ${modalType === 'unidade' ? 'Unidade' : modalType === 'indicador' ? 'Indicador' : modalType === 'categoria' ? 'Categoria' : 'Meta'}`
            }
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);

                if (modalType === 'unidade') {
                  const nome = formData.get('nome') as string;
                  const ordem = parseInt(formData.get('ordem') as string);
                  if (nome) {
                    await onSaveUnidade({
                      id: editingItem?.id || crypto.randomUUID(),
                      nome,
                      ordem_exibicao: ordem || unidades.length + 1,
                      ativo: editingItem ? editingItem.ativo : true,
                    });
                  }
                } else if (modalType === 'categoria') {
                  const nome = formData.get('nome') as string;
                  const ordem = parseInt(formData.get('ordem') as string);
                  const visivel_capa = formData.get('visivel_capa') === 'on';
                  if (nome) {
                    await onSaveCategoria({
                      id: editingItem?.id || crypto.randomUUID(),
                      nome,
                      ordem: ordem || categorias.length + 1,
                      visivel_capa,
                    });
                  }
                } else if (modalType === 'indicador') {
                  const nome = formData.get('nome') as string;
                  const categoria = formData.get('categoria') as any;
                  const unidade_medida = formData.get('unidade_medida') as string;
                  const digitavel = formData.get('digitavel') === 'on';
                  const formula = formData.get('formula') as string;
                  if (nome) {
                    await onSaveIndicador({
                      id: editingItem?.id || crypto.randomUUID(),
                      nome,
                      categoria,
                      unidade_medida,
                      digitavel,
                      formula: !digitavel && formula ? formula : undefined,
                    });
                  }
                } else if (modalType === 'meta') {
                  const unidade_id = formData.get('unidade_id') as string;
                  const indicador_id = formData.get('indicador_id') as string;
                  const valor_meta = parseFloat(formData.get('valor_meta') as string);
                  const mes = parseInt(formData.get('mes') as string);
                  const ano = parseInt(formData.get('ano') as string);

                  if (unidade_id && indicador_id && !isNaN(valor_meta)) {
                    await onSaveMeta({
                      id: editingItem?.id || `${unidade_id}-${indicador_id}-${ano}-${mes}`,
                      unidade_id,
                      indicador_id,
                      ano,
                      mes,
                      valor_meta,
                    });
                  }
                }
                handleCloseModal();
              }}
              className="space-y-4"
            >
              {modalType === 'unidade' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome da Unidade</label>
                    <Input
                      name="nome"
                      defaultValue={editingItem?.nome}
                      placeholder="Ex: Unidade São Paulo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Ordem de Exibição</label>
                    <Input
                      name="ordem"
                      type="number"
                      defaultValue={editingItem?.ordem_exibicao}
                      placeholder="Ex: 1"
                    />
                  </div>
                </>
              )}
              {modalType === 'indicador' && (
                <>
                  {editingItem && (
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <p className="text-xs text-indigo-600 font-mono font-bold">
                        ID para fórmulas: {visualIdMap[editingItem.id] || editingItem.id}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome do Indicador</label>
                    <Input
                      name="nome"
                      defaultValue={editingItem?.nome}
                      placeholder="Ex: Tons Vendidos"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Categoria</label>
                    <Select
                      name="categoria"
                      defaultValue={
                        editingItem?.categoria || (categorias.length > 0 ? categorias[0].nome : '')
                      }
                    >
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unidade de Medida</label>
                    <Input
                      name="unidade_medida"
                      defaultValue={editingItem?.unidade_medida}
                      placeholder="Ex: TON., R$, %"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="digitavel"
                      checked={isDigitavel}
                      onChange={(e) => setIsDigitavel(e.target.checked)}
                      id="digitavel-check"
                    />
                    <label htmlFor="digitavel-check" className="text-sm font-medium text-slate-700">
                      Indicador Digitável
                    </label>
                  </div>
                  {!isDigitavel && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Fórmula de Cálculo</label>
                      <Input
                        name="formula"
                        defaultValue={editingItem?.formula || ''}
                        placeholder="Ex: [f1] / [f2]"
                      />
                      <p className="text-xs text-slate-400">
                        💡 Use [id] para o valor do dia, ACUM_MES[id] para mês, ACUM_SEM[id] para
                        semana, ACUM_ANO[id] para ano. Funções: IF(cond, a, b), MIN(a,b), MAX(a,b),
                        ABS(a), ROUND(a,n). Exemplos: [r1]*[r2] | ACUM_MES[r3] |
                        IF([r1]&gt;0,[r1]*[r2],0)
                      </p>
                    </div>
                  )}
                </>
              )}
              {modalType === 'categoria' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome da Categoria</label>
                    <Input
                      name="nome"
                      defaultValue={editingItem?.nome}
                      placeholder="Ex: Faturamento"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Ordem de Exibição</label>
                    <Input
                      name="ordem"
                      type="number"
                      defaultValue={editingItem?.ordem}
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="visivel_capa"
                      id="visivel_capa"
                      defaultChecked={editingItem?.visivel_capa ?? true}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="visivel_capa" className="text-sm font-medium text-slate-700">
                      Mostrar na capa do dashboard
                    </label>
                  </div>
                </>
              )}
              {modalType === 'meta' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unidade</label>
                    <Select
                      name="unidade_id"
                      defaultValue={editingItem?.unidade_id || selectedUnidade}
                      required
                    >
                      <option value="">Selecione...</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Indicador</label>
                    <Select name="indicador_id" defaultValue={editingItem?.indicador_id} required>
                      <option value="">Selecione...</option>
                      {indicadores.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Mês</label>
                      <Select
                        name="mes"
                        defaultValue={editingItem?.mes || new Date().getMonth() + 1}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Ano</label>
                      <Input
                        name="ano"
                        type="number"
                        defaultValue={editingItem?.ano || new Date().getFullYear()}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Valor da Meta</label>
                    <Input
                      name="valor_meta"
                      type="number"
                      step="0.01"
                      defaultValue={editingItem?.valor_meta}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2">
                  <Save className="w-4 h-4" /> Salvar
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {activeTab === 'unidades' && (
          <MotionDiv
            key="unidades"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">
                  Filiais gerenciadas em Configurações
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  O cadastro de filiais é feito em <strong>Configurações → Filiais</strong>. Aqui
                  você pode ativar/desativar filiais para este módulo de relatórios.
                </p>
              </div>
            </div>
            <Card>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700 w-16">ID</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Nome da Filial</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unidades.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm">
                          {u.id_numeric ?? u.ordem_exibicao}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{u.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                            u.ativo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {u.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSaveUnidade({ ...u, ativo: !u.ativo })}
                          title={u.ativo ? 'Desativar para Relatórios' : 'Ativar para Relatórios'}
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {unidades.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                        Nenhuma filial encontrada. Cadastre filiais em Configurações → Filiais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </MotionDiv>
        )}

        {activeTab === 'categorias' && (
          <MotionDiv
            key="categorias"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-end">
              <Button onClick={() => handleOpenModal('categoria')} className="gap-2">
                <Plus className="w-4 h-4" /> Nova Categoria
              </Button>
            </div>
            <Card>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndCategories}
              >
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-10 px-4 py-3"></th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Nome</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Ordem</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Mostrar na Capa</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <SortableContext
                      items={categorias.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {[...categorias]
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((c) => (
                          <SortableCategoryRow
                            key={c.id}
                            categoria={c}
                            onEdit={(cat) => handleOpenModal('categoria', cat)}
                            onDelete={onDeleteCategoria}
                            onToggleVisibilidadeCapa={handleToggleCategoriaVisibilidadeCapa}
                          />
                        ))}
                    </SortableContext>
                  </tbody>
                </table>
              </DndContext>
            </Card>
          </MotionDiv>
        )}

        {activeTab === 'indicadores' && (
          <MotionDiv
            key="indicadores"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-end">
              <Button onClick={() => handleOpenModal('indicador')} className="gap-2">
                <Plus className="w-4 h-4" /> Novo Indicador
              </Button>
            </div>

            {[...categorias]
              .sort((a, b) => a.ordem - b.ordem)
              .map((cat) => {
                const catIndicadores = indicadores
                  .filter((i) => i.categoria === cat.nome)
                  .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

                return (
                  <div key={cat.id} className="space-y-3">
                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider px-1">
                      {cat.nome}
                    </h3>
                    <Card>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleDragEnd(e, cat.nome)}
                      >
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="w-10 px-4 py-3"></th>
                              <th className="px-4 py-3 font-semibold text-slate-700">Nome</th>
                              <th className="px-4 py-3 font-semibold text-slate-700">Unidade</th>
                              <th className="px-4 py-3 font-semibold text-slate-700">Tipo</th>
                              <th className="px-4 py-3 font-semibold text-slate-700 text-right">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {catIndicadores.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-8 text-center text-slate-400 italic"
                                >
                                  Nenhum indicador nesta categoria. Arraste um indicador para cá ou
                                  crie um novo.
                                </td>
                              </tr>
                            ) : (
                              <SortableContext
                                items={catIndicadores.map((i) => i.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {catIndicadores.map((i) => (
                                  <SortableIndicadorRow
                                    key={i.id}
                                    indicador={i}
                                    onEdit={(ind) => handleOpenModal('indicador', ind)}
                                    onDelete={onDeleteIndicador}
                                    visualId={visualIdMap[i.id] || i.id}
                                  />
                                ))}
                              </SortableContext>
                            )}
                          </tbody>
                        </table>
                      </DndContext>
                    </Card>
                  </div>
                );
              })}
          </MotionDiv>
        )}

        {activeTab === 'metas' && (
          <MotionDiv
            key="metas"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-end">
              <Button onClick={() => handleOpenModal('meta')} className="gap-2">
                <Plus className="w-4 h-4" /> Nova Meta
              </Button>
            </div>
            <Card>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Unidade</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Indicador</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Mês/Ano</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">
                      Valor Meta
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metas.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        {unidades.find((u) => u.id === m.unidade_id)?.nome}
                      </td>
                      <td className="px-4 py-3">
                        {indicadores.find((i) => i.id === m.indicador_id)?.nome}
                      </td>
                      <td className="px-4 py-3">
                        {m.mes}/{m.ano}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">
                        {m.valor_meta.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal('meta', m)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteMeta(m.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </MotionDiv>
        )}

        {activeTab === 'config-unidades' && (
          <MotionDiv
            key="config-unidades"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700">
                  Selecione a Unidade para Personalizar
                </label>
                <Select
                  value={selectedUnidade}
                  onChange={(e) => setSelectedUnidade(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
            {selectedUnidade && (
              <Card>
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700">Indicador Original</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Nome Personalizado</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Visível</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {indicadores.map((i) => {
                      const config = configs.find(
                        (c) => c.unidade_id === selectedUnidade && c.indicador_id === i.id
                      );
                      return (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{i.nome}</td>
                          <td className="px-4 py-3">
                            <Input
                              placeholder={i.nome}
                              value={localNomes[i.id] ?? (config?.nome_personalizado || '')}
                              onChange={(e) =>
                                setLocalNomes((prev) => ({ ...prev, [i.id]: e.target.value }))
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-4">
                              <input
                                type="checkbox"
                                checked={localVisiveis[i.id] ?? (config ? config.visivel : true)}
                                onChange={(e) =>
                                  setLocalVisiveis((prev) => ({
                                    ...prev,
                                    [i.id]: e.target.checked,
                                  }))
                                }
                              />
                              <input
                                type="color"
                                value={localCores[i.id] ?? (config?.cor_fundo || '#ffffff')}
                                onChange={(e) =>
                                  setLocalCores((prev) => ({ ...prev, [i.id]: e.target.value }))
                                }
                                className="w-8 h-8 rounded border-0 cursor-pointer"
                                title="Cor de fundo da coluna"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={savingConfigs[i.id]}
                              onClick={async () => {
                                setSavingConfigs((prev) => ({ ...prev, [i.id]: true }));
                                try {
                                  await onSaveConfig({
                                    unidade_id: selectedUnidade,
                                    indicador_id: i.id,
                                    nome_personalizado:
                                      localNomes[i.id] ?? (config?.nome_personalizado || ''),
                                    visivel:
                                      localVisiveis[i.id] ?? (config ? config.visivel : true),
                                    cor_fundo: localCores[i.id] ?? (config?.cor_fundo || '#ffffff'),
                                  });
                                } finally {
                                  setSavingConfigs((prev) => ({ ...prev, [i.id]: false }));
                                }
                              }}
                              title="Salvar"
                            >
                              {savingConfigs[i.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingConfigs[i.id] || !config}
                              onClick={async () => {
                                if (!config) return;
                                setDeletingConfigs((prev) => ({ ...prev, [i.id]: true }));
                                try {
                                  await onDeleteConfig(selectedUnidade, i.id);
                                  // Clear local state for this indicator to force reset
                                  setLocalNomes((prev) => {
                                    const n = { ...prev };
                                    delete n[i.id];
                                    return n;
                                  });
                                  setLocalVisiveis((prev) => {
                                    const n = { ...prev };
                                    delete n[i.id];
                                    return n;
                                  });
                                  setLocalCores((prev) => {
                                    const n = { ...prev };
                                    delete n[i.id];
                                    return n;
                                  });
                                } finally {
                                  setDeletingConfigs((prev) => ({ ...prev, [i.id]: false }));
                                }
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Excluir Personalização"
                            >
                              {deletingConfigs[i.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </MotionDiv>
        )}

        {activeTab === 'dias-uteis' && (
          <MotionDiv
            key="dias-uteis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const uId = formData.get('unidade_id') as string;
                  const total = parseInt(formData.get('total') as string);
                  const mes = parseInt(formData.get('mes') as string);
                  const ano = parseInt(formData.get('ano') as string);

                  if (uId && !isNaN(total)) {
                    await onSaveDiasUteis({
                      unidade_id: uId,
                      ano,
                      mes,
                      total_dias_uteis: total,
                    });
                    e.currentTarget.reset();
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unidade</label>
                  <Select name="unidade_id" required>
                    <option value="">Selecione...</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mês/Ano</label>
                  <div className="flex gap-2">
                    <Select name="mes" defaultValue={new Date().getMonth() + 1}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {format(new Date(2024, i, 1), 'MM', { locale: ptBR })}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="ano"
                      type="number"
                      defaultValue={new Date().getFullYear()}
                      className="w-24"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Total Dias Úteis
                  </label>
                  <Input name="total" type="number" placeholder="Ex: 22" required />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full gap-2">
                    <Save className="w-4 h-4" /> Salvar Dias
                  </Button>
                </div>
              </form>
            </Card>
            <Card>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Unidade</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Mês/Ano</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Dias Úteis</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diasUteis.map((d, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        {unidades.find((u) => u.id === d.unidade_id)?.nome}
                      </td>
                      <td className="px-4 py-3">
                        {d.mes}/{d.ano}
                      </td>
                      <td className="px-4 py-3 font-bold">{d.total_dias_uteis}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDiasUteisPrompt({
                              isOpen: true,
                              defaultValue: d.total_dias_uteis.toString(),
                              onConfirm: (novoTotal: string) => {
                                setDiasUteisPrompt((prev) => ({ ...prev, isOpen: false }));
                                onSaveDiasUteis({ ...d, total_dias_uteis: parseInt(novoTotal) });
                              },
                            });
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteDiasUteis(d.unidade_id, d.ano, d.mes)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </MotionDiv>
        )}
        {activeTab === 'guia' && (
          <MotionDiv
            key="guia"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">📐 Guia Completo de Cálculos</h3>
                  <p className="text-sm text-slate-500">
                    Aprenda a criar fórmulas simples e complexas, encadear indicadores e usar
                    funções avançadas.
                  </p>
                </div>
              </div>

              <div className="space-y-8 text-sm text-slate-600">
                {/* Seção 1 — Referência de IDs */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    🔑 Como referenciar um indicador
                  </h4>
                  <p>
                    Use os <strong>IDs visuais</strong> dos indicadores entre colchetes para criar
                    cálculos. O ID de cada indicador é exibido na aba <strong>Indicadores</strong> e
                    abaixo do nome de cada campo na tabela de configuração.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-indigo-600 text-xs space-y-1">
                    <div>[r1] → valor do dia do indicador r1</div>
                    <div>ACUM_MES[r1] → acumulado do mês do indicador r1</div>
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    Os IDs visuais (r1, f1, c1…) são atribuídos automaticamente na ordem de criação
                    de cada indicador.
                  </p>
                </div>

                {/* Seção 2 — Tabela de tags */}
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    📋 Todas as tags disponíveis
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-indigo-100">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-indigo-100/70 border-b border-indigo-200">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-indigo-800">Tag</th>
                          <th className="px-3 py-2 font-semibold text-indigo-800">Período</th>
                          <th className="px-3 py-2 font-semibold text-indigo-800">Exemplo</th>
                          <th className="px-3 py-2 font-semibold text-indigo-800">
                            Funciona com Calculado?
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50 bg-white">
                        <tr>
                          <td className="px-3 py-2 font-mono text-indigo-600">[id]</td>
                          <td className="px-3 py-2">Dia selecionado</td>
                          <td className="px-3 py-2 font-mono text-slate-600">[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_SEM[id]</td>
                          <td className="px-3 py-2">Semana (seg → dia)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_SEM[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_MES[id]</td>
                          <td className="px-3 py-2">Mês (01 → dia)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_MES[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_ANO[id]</td>
                          <td className="px-3 py-2">Ano (01/Jan → dia)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_ANO[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_MES_ANT[id]</td>
                          <td className="px-3 py-2">Mês até ontem</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_MES_ANT[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_ANO_ANT[id]</td>
                          <td className="px-3 py-2">Ano até ontem</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_ANO_ANT[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono text-indigo-600">ACUM_SEM_ANT[id]</td>
                          <td className="px-3 py-2">Semana anterior (seg–dom)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ACUM_SEM_ANT[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-indigo-600">MEDIA_SEM[id]</td>
                          <td className="px-3 py-2">Média diária da semana</td>
                          <td className="px-3 py-2 font-mono text-slate-600">MEDIA_SEM[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono text-indigo-600">MEDIA_MES[id]</td>
                          <td className="px-3 py-2">Média diária do mês</td>
                          <td className="px-3 py-2 font-mono text-slate-600">MEDIA_MES[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-indigo-600">MEDIA_ANO[id]</td>
                          <td className="px-3 py-2">Média diária do ano</td>
                          <td className="px-3 py-2 font-mono text-slate-600">MEDIA_ANO[r1]</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">✅</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção 3 — Funções disponíveis */}
                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    ⚙️ Funções matemáticas disponíveis
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-emerald-100">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-emerald-100/70 border-b border-emerald-200">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-emerald-800">Função</th>
                          <th className="px-3 py-2 font-semibold text-emerald-800">Sintaxe</th>
                          <th className="px-3 py-2 font-semibold text-emerald-800">Exemplo</th>
                          <th className="px-3 py-2 font-semibold text-emerald-800">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50 bg-white">
                        <tr>
                          <td className="px-3 py-2 font-semibold">Mínimo</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">MIN(a, b)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">MIN([r1], 100)</td>
                          <td className="px-3 py-2 text-slate-500">Menor entre r1 e 100</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-semibold">Máximo</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">MAX(a, b)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">MAX([r1]-[r2], 0)</td>
                          <td className="px-3 py-2 text-slate-500">r1-r2 ou 0 se negativo</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-semibold">Valor Absoluto</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">ABS(a)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">ABS([r1]-[r2])</td>
                          <td className="px-3 py-2 text-slate-500">Diferença sem sinal</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-semibold">Arredondamento</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">ROUND(a, casas)</td>
                          <td className="px-3 py-2 font-mono text-slate-600">
                            ROUND([r1]/[r2], 2)
                          </td>
                          <td className="px-3 py-2 text-slate-500">Arredonda para 2 casas</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-semibold">Condicional</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">
                            IF(cond, v_sim, v_nao)
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">
                            IF([r1]&gt;0, [r1]*[r2], 0)
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            Se r1 &gt; 0, multiplica, senão 0
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção 4 — Exemplos práticos por complexidade */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    📚 Exemplos práticos por complexidade
                  </h4>

                  {/* Nível 1 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 1 — Fórmulas simples (operações entre campos digitáveis):
                    </p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>
                        Ticket Médio Dia: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [f1] /
                        [f2]
                      </div>
                      <div>
                        Receita Diária: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        [r1] * [r2]
                      </div>
                      <div>
                        Variação:
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        [f1] - [f2]
                      </div>
                      <div>
                        Percentual:
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        ([f1] / [f2]) * 100
                      </div>
                    </div>
                  </div>

                  {/* Nível 2 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 2 — Usando acumulados diretos:
                    </p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>Acumulado Faturamento Mês: &nbsp;&nbsp;&nbsp; ACUM_MES[f1]</div>
                      <div>
                        Acumulado Tons Ano: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        ACUM_ANO[r1]
                      </div>
                      <div>
                        Acumulado Semana:
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        ACUM_SEM[r1]
                      </div>
                      <div>
                        Semana Anterior:
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        ACUM_SEM_ANT[r1]
                      </div>
                      <div>
                        Ticket Médio Acumulado Mês: &nbsp;&nbsp; ACUM_MES[f1] / ACUM_MES[f2]
                      </div>
                      <div>
                        Média Diária do Mês: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        MEDIA_MES[r1]
                      </div>
                      <div>
                        Média Diária da Semana: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; MEDIA_SEM[r1]
                      </div>
                    </div>
                  </div>

                  {/* Nível 3 */}
                  <div className="space-y-3">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 3 — Encadeamento: calculado baseado em calculado (o caso do usuário):
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-slate-600">Passo</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">ID</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Nome</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Tipo</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Fórmula</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-3 py-2 font-bold text-slate-500">1</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r1</td>
                            <td className="px-3 py-2">Quantidade</td>
                            <td className="px-3 py-2 text-slate-500">Digitável</td>
                            <td className="px-3 py-2 text-slate-400 italic">—</td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="px-3 py-2 font-bold text-slate-500">2</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r2</td>
                            <td className="px-3 py-2">Rentabilidade %</td>
                            <td className="px-3 py-2 text-slate-500">Digitável</td>
                            <td className="px-3 py-2 text-slate-400 italic">—</td>
                          </tr>
                          <tr className="bg-indigo-50/40">
                            <td className="px-3 py-2 font-bold text-indigo-600">3</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r3</td>
                            <td className="px-3 py-2 font-semibold">Qtd × Rent (dia)</td>
                            <td className="px-3 py-2 font-semibold text-indigo-600">Calculado</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">[r1] * [r2]</td>
                          </tr>
                          <tr className="bg-emerald-50/40">
                            <td className="px-3 py-2 font-bold text-emerald-600">4</td>
                            <td className="px-3 py-2 font-mono text-emerald-600">r4</td>
                            <td className="px-3 py-2 font-semibold">Soma Qtd × Rent Mês</td>
                            <td className="px-3 py-2 font-semibold text-emerald-600">Calculado</td>
                            <td className="px-3 py-2 font-mono text-emerald-600">
                              ACUM_MES[r3] ✅
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>Dia 01/Mar: r1=100, r2=2.5 → r3=250</div>
                      <div>Dia 02/Mar: r1=150, r2=3.0 → r3=450</div>
                      <div>Dia 03/Mar: r1=200, r2=2.8 → r3=560</div>
                      <div className="border-t border-slate-300 pt-1 mt-1 text-slate-400">
                        ────────────────────────────────────────
                      </div>
                      <div className="text-emerald-700 font-bold">
                        ACUM_MES[r3] em 03/Mar = 250 + 450 + 560 = 1.260 ✅
                      </div>
                    </div>
                  </div>

                  {/* Nível 4 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 4 — Funções condicionais e avançadas:
                    </p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div className="text-slate-400">// Só multiplica se quantidade &gt; 0:</div>
                      <div>IF([r1]&gt;0, [r1]*[r2], 0)</div>
                      <div className="pt-1 text-slate-400">
                        // Diferença positiva (sem negativo):
                      </div>
                      <div>MAX([f1]-[meta1], 0)</div>
                      <div className="pt-1 text-slate-400">// Desvio absoluto da meta:</div>
                      <div>ABS([f1]-[meta1])</div>
                      <div className="pt-1 text-slate-400">
                        // Ticket Médio arredondado 2 casas:
                      </div>
                      <div>ROUND(ACUM_MES[f1] / ACUM_MES[f2], 2)</div>
                      <div className="pt-1 text-slate-400">// Encadeamento IF + calculado:</div>
                      <div>r3 = IF([r1]&gt;0, [r1]*[r2], 0)</div>
                      <div>r4 = ACUM_MES[r3] ← soma apenas os dias com quantidade positiva</div>
                    </div>
                  </div>

                  {/* Nível 5 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 5 — Fórmulas compostas (múltiplas junções):
                    </p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div className="text-slate-400">// Receita Líquida Mês:</div>
                      <div>ACUM_MES[f1] - ACUM_MES[f2] - ACUM_MES[f3]</div>
                      <div className="pt-1 text-slate-400">// Margem de Contribuição %:</div>
                      <div>(ACUM_MES[r3] / ACUM_MES[f1]) * 100</div>
                      <div className="pt-1 text-slate-400">// Crescimento vs Mês Anterior:</div>
                      <div>IF(ACUM_MES_ANT[f1]&gt;0, ([f1]/ACUM_MES_ANT[f1])*100, 0)</div>
                      <div className="pt-1 text-slate-400">// Peso médio com limite mínimo:</div>
                      <div>MAX(ACUM_MES[r1] / ACUM_MES[r2], 0)</div>
                      <div className="pt-1 text-slate-400">
                        // Média ponderada semanal (qtd × rent / qtd):
                      </div>
                      <div>IF(ACUM_SEM[r6]&gt;0, ACUM_SEM[r7]/ACUM_SEM[r6], 0)</div>
                      <div className="pt-1 text-slate-400">
                        // Comparação semana atual vs anterior:
                      </div>
                      <div>ACUM_SEM[r1] - ACUM_SEM_ANT[r1]</div>
                      <div className="pt-1 text-slate-400">// Operação mista com constante:</div>
                      <div>ACUM_MES[r3] * 100 / ACUM_MES[r1]</div>
                    </div>
                  </div>

                  {/* Nível 6 — Encadeamento triplo */}
                  <div className="space-y-3">
                    <p className="font-bold text-xs text-slate-700">
                      Nível 6 — Encadeamento triplo (calculado → acumulado → média ponderada):
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-[10px] text-left">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-slate-600">Passo</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">ID</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Nome</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Tipo</th>
                            <th className="px-3 py-2 font-semibold text-slate-600">Fórmula</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-3 py-2 font-bold text-slate-500">1</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r5</td>
                            <td className="px-3 py-2">Quantidade</td>
                            <td className="px-3 py-2 text-slate-500">Digitável</td>
                            <td className="px-3 py-2 text-slate-400 italic">—</td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="px-3 py-2 font-bold text-slate-500">2</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r6</td>
                            <td className="px-3 py-2">Rentabilidade %</td>
                            <td className="px-3 py-2 text-slate-500">Digitável</td>
                            <td className="px-3 py-2 text-slate-400 italic">—</td>
                          </tr>
                          <tr className="bg-indigo-50/40">
                            <td className="px-3 py-2 font-bold text-indigo-600">3</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">r7</td>
                            <td className="px-3 py-2 font-semibold">Qtd × Rent (dia)</td>
                            <td className="px-3 py-2 font-semibold text-indigo-600">Calculado</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">[r5] * [r6]</td>
                          </tr>
                          <tr className="bg-emerald-50/40">
                            <td className="px-3 py-2 font-bold text-emerald-600">4</td>
                            <td className="px-3 py-2 font-mono text-emerald-600">r8</td>
                            <td className="px-3 py-2 font-semibold">Média ponderada Sem</td>
                            <td className="px-3 py-2 font-semibold text-emerald-600">Calculado</td>
                            <td className="px-3 py-2 font-mono text-emerald-600">
                              IF(ACUM_SEM[r5]&gt;0, ACUM_SEM[r7]/ACUM_SEM[r5], 0) ✅
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Seção 5 — O que NÃO funciona */}
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 space-y-4">
                  <h4 className="font-bold text-red-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>❌ O que NÃO funciona
                    (armadilhas comuns)
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-red-100">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-red-100/70 border-b border-red-200">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-red-800">Fórmula</th>
                          <th className="px-3 py-2 font-semibold text-red-800">Problema</th>
                          <th className="px-3 py-2 font-semibold text-red-800">Solução correta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50 bg-white">
                        <tr>
                          <td className="px-3 py-2 font-mono text-red-600">[r1] * ACUM_MES[r2]</td>
                          <td className="px-3 py-2 text-slate-600">Mistura dia com mês</td>
                          <td className="px-3 py-2 font-mono text-emerald-700">
                            ACUM_MES[r3] onde r3=[r1]*[r2]
                          </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-red-600">
                            ACUM_MES[r1] * ACUM_MES[r2]
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            Produto dos totais ≠ soma dos produtos
                          </td>
                          <td className="px-3 py-2 font-mono text-emerald-700">
                            ACUM_MES[r3] (indicador intermediário)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-mono text-red-600">IF([r1], [r2], 0)</td>
                          <td className="px-3 py-2 text-slate-600">
                            Condição ambígua (sem operador)
                          </td>
                          <td className="px-3 py-2 font-mono text-emerald-700">
                            IF([r1]&gt;0, [r2], 0)
                          </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-red-600">r3=[r4], r4=[r3]</td>
                          <td className="px-3 py-2 text-slate-600">
                            Referência circular — loop infinito
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            Garantir que deps só apontam para indicadores anteriores
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção 6 — Dica importante */}
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200">
                  <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                    💡 Dica Importante
                  </h4>
                  <p>
                    Você <strong>não</strong> precisa criar uma fórmula diferente para cada período.
                    O sistema é inteligente: ele aplica a mesma fórmula lógica sobre os dados já
                    agrupados por Dia, Mês ou Ano conforme sua escolha no Dashboard principal.
                  </p>
                  <p className="mt-3 text-sm text-amber-800">
                    Use indicadores intermediários calculados como <strong>"pontes"</strong> para
                    construir cálculos complexos. Quanto mais modular a estrutura, mais fácil é
                    manter.
                  </p>
                </div>
              </div>
            </Card>
          </MotionDiv>
        )}
      </AnimatePresenceComponent>
      <PromptDialog
        isOpen={diasUteisPrompt.isOpen}
        title="Editar Dias Úteis"
        message="Novo total de dias úteis:"
        defaultValue={diasUteisPrompt.defaultValue}
        confirmLabel="Salvar"
        onConfirm={diasUteisPrompt.onConfirm}
        onCancel={() => setDiasUteisPrompt((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
