import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileEdit, 
  Settings, 
  Building2, 
  Target, 
  Calendar as CalendarIcon, 
  BarChart3,
  Plus,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  Download,
  Upload,
  Trash2,
  Edit2,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import { 
  Unidade, 
  Indicador, 
  Lancamento, 
  MetaMensal, 
  DEFAULT_CATEGORIAS,
  ConfiguracaoIndicador,
  DiasUteisMes,
  User,
  Categoria
} from '../types';
import {
  getMgmtUnidades, upsertMgmtUnidade, deleteMgmtUnidade,
  getMgmtCategorias, upsertMgmtCategoria, deleteMgmtCategoria,
  getMgmtIndicadores, upsertMgmtIndicador, deleteMgmtIndicador,
  getMgmtLancamentos, upsertMgmtLancamentos, deleteMgmtLancamento,
  getMgmtMetas, upsertMgmtMeta, deleteMgmtMeta,
  getMgmtConfigs, upsertMgmtConfig, deleteMgmtConfig,
  getMgmtDiasUteis, upsertMgmtDiasUteis, deleteMgmtDiasUteis,
} from '../services/db';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Visual ID generation ---

const CATEGORY_PREFIXES: Record<string, string> = {
  'Faturamento': 'f',
  'Carregamento': 'c',
  'Rentabilidade': 'r',
  'Cancelamentos': 'n',
  'Entrada de Pedidos': 'e',
  'Carteira de Pedidos': 't',
  'Produção': 'p',
};

const generateVisualIdMaps = (
  indicadores: Indicador[],
  categorias: Categoria[]
): { visualIdMap: Record<string, string>; reverseVisualIdMap: Record<string, string> } => {
  const usedPrefixes = new Set<string>();
  const catPrefixMap: Record<string, string> = {};
  const sortedCategories = [...categorias].sort((a, b) => a.ordem - b.ordem);

  for (const cat of sortedCategories) {
    const known = CATEGORY_PREFIXES[cat.nome];
    if (known && !usedPrefixes.has(known)) {
      catPrefixMap[cat.nome] = known;
      usedPrefixes.add(known);
    } else {
      let prefix = '';
      for (const char of cat.nome.toLowerCase()) {
        if (/[a-z]/.test(char) && !usedPrefixes.has(char)) {
          prefix = char;
          break;
        }
      }
      if (!prefix) {
        for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
          if (!usedPrefixes.has(ch)) { prefix = ch; break; }
        }
      }
      catPrefixMap[cat.nome] = prefix;
      usedPrefixes.add(prefix);
    }
  }

  const visualIdMap: Record<string, string> = {};
  const reverseVisualIdMap: Record<string, string> = {};

  for (const cat of sortedCategories) {
    const prefix = catPrefixMap[cat.nome] || 'x';
    const catIndicadores = indicadores
      .filter(i => i.categoria === cat.nome)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    catIndicadores.forEach((ind, idx) => {
      const visualId = `${prefix}${idx + 1}`;
      visualIdMap[visualId] = ind.id;
      reverseVisualIdMap[ind.id] = visualId;
    });
  }

  return { visualIdMap, reverseVisualIdMap };
};

interface ManagementReportsModuleProps {
  currentUser: User;
  activeTab: 'dashboard' | 'lancamentos' | 'cadastros';
}

const MotionDiv = motion.div as any;
const AnimatePresenceComponent = AnimatePresence as any;

// --- UI Components ---

const Button = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-600',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-4 py-2 text-sm font-medium',
    lg: 'px-6 py-3 text-base font-medium',
    icon: 'p-2',
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => (
  <MotionDiv 
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    )}
  >
    {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70">
      <X className="w-4 h-4" />
    </button>
  </MotionDiv>
);

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </MotionDiv>
    </div>
  );
};

const SortableIndicadorRow = ({ 
  indicador, 
  onEdit, 
  onDelete,
  visualId
}: { 
  indicador: Indicador; 
  onEdit: (i: Indicador) => void; 
  onDelete: (id: string) => void;
  visualId?: string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: indicador.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={cn("hover:bg-slate-50", isDragging && "bg-slate-100 shadow-inner")}>
      <td className="px-4 py-3">
        <button {...attributes} {...listeners} className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-slate-900">{indicador.nome}</span>
        <span className="block text-[10px] text-slate-400 font-mono">ID: {visualId || indicador.id}</span>
      </td>
      <td className="px-4 py-3 text-slate-600">{indicador.unidade_medida}</td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold uppercase', indicador.digitavel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600')}>
          {indicador.digitavel ? 'Digitável' : 'Calculado'}
        </span>
      </td>
      <td className="px-4 py-3 text-right flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(indicador)}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(indicador.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
};

const SortableCategoryRow = ({ 
  categoria, 
  onEdit, 
  onDelete 
}: { 
  categoria: Categoria; 
  onEdit: (c: Categoria) => void; 
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: categoria.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={cn("hover:bg-slate-50", isDragging && "bg-slate-100 shadow-inner")}>
      <td className="px-4 py-3">
        <button {...attributes} {...listeners} className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">{categoria.nome}</td>
      <td className="px-4 py-3 text-slate-600">{categoria.ordem}</td>
      <td className="px-4 py-3 text-right flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(categoria)}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(categoria.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
};

// --- Pages ---

const Dashboard = ({ 
  unidades, 
  indicadores, 
  categorias,
  lancamentos, 
  metas,
  configs,
  diasUteis
}: { 
  unidades: Unidade[]; 
  indicadores: Indicador[]; 
  categorias: Categoria[];
  lancamentos: Lancamento[]; 
  metas: MetaMensal[];
  configs: ConfiguracaoIndicador[];
  diasUteis: DiasUteisMes[];
}) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const activeUnidades = unidades.filter(u => u.ativo).sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);
  
  const getValor = (unidadeId: string, indicadorId: string, date: string = selectedDate) => {
    return lancamentos.find(l => l.unidade_id === unidadeId && l.indicador_id === indicadorId && l.data === date)?.valor || 0;
  };

  const getSomaPeriodo = (unidadeId: string, indicadorId: string, start: Date, end: Date) => {
    return lancamentos
      .filter(l => l.unidade_id === unidadeId && l.indicador_id === indicadorId && parseISO(l.data) >= start && parseISO(l.data) <= end)
      .reduce((acc, curr) => acc + curr.valor, 0);
  };

  const getMediaPonderada = (unidadeId: string, rentId: string, volumeId: string, start: Date, end: Date) => {
    const periodLancamentos = lancamentos.filter(l => l.unidade_id === unidadeId && parseISO(l.data) >= start && parseISO(l.data) <= end);
    let totalVolume = 0;
    let weightedSum = 0;
    
    const dates = [...new Set(periodLancamentos.map(l => l.data))];
    dates.forEach(d => {
      const rent = periodLancamentos.find(l => l.data === d && l.indicador_id === rentId)?.valor || 0;
      const vol = periodLancamentos.find(l => l.data === d && l.indicador_id === volumeId)?.valor || 0;
      weightedSum += (rent * vol);
      totalVolume += vol;
    });
    
    return totalVolume > 0 ? weightedSum / totalVolume : 0;
  };

  const currentMonthStart = startOfMonth(parseISO(selectedDate));
  const currentYearStart = new Date(parseISO(selectedDate).getFullYear(), 0, 1);
  
  // Weekly range (Mon to Sun)
  const d = parseISO(selectedDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23,59,59,999);

  const { visualIdMap } = generateVisualIdMaps(indicadores, categorias);

  interface FormulaContext {
    lancamentos: Lancamento[];
    metas: MetaMensal[];
    unidadeId: string;
    selectedDate: string;
    visualIdMap: Record<string, string>;
    currentMonthStart: Date;
    currentYearStart: Date;
    weekStart: Date;
    totalDiasUteis: number;
    diasRestantes: number;
  }

  const avaliarFormula = (formula: string, valores: Record<string, number>, ctx?: FormulaContext): number => {
    try {
      let expressao = formula;

      if (ctx) {
        const {
          lancamentos: lans, metas: mts, unidadeId, selectedDate: selDate, visualIdMap: vidMap,
          currentMonthStart: mesInicio, currentYearStart: anoInicio, weekStart: semanaInicio,
          totalDiasUteis: diasUteisTotais, diasRestantes: diasRest,
        } = ctx;
        const selDateObj = parseISO(selDate);
        const yr = selDateObj.getFullYear();
        const mo = selDateObj.getMonth() + 1;
        const resolveId = (vid: string): string => vidMap[vid.trim()] ?? vid.trim();

        // SOMA_MES([id])
        expressao = expressao.replace(/SOMA_MES\(\[([^\]]+)\]\)/g, (_, vid) => {
          const iid = resolveId(vid);
          const soma = lans
            .filter(l => l.unidade_id === unidadeId && l.indicador_id === iid
              && parseISO(l.data) >= mesInicio && parseISO(l.data) <= selDateObj)
            .reduce((acc, l) => acc + l.valor, 0);
          return String(soma);
        });

        // SOMA_ANO([id])
        expressao = expressao.replace(/SOMA_ANO\(\[([^\]]+)\]\)/g, (_, vid) => {
          const iid = resolveId(vid);
          const soma = lans
            .filter(l => l.unidade_id === unidadeId && l.indicador_id === iid
              && parseISO(l.data) >= anoInicio && parseISO(l.data) <= selDateObj)
            .reduce((acc, l) => acc + l.valor, 0);
          return String(soma);
        });

        // SOMA_SEMANA([id])
        expressao = expressao.replace(/SOMA_SEMANA\(\[([^\]]+)\]\)/g, (_, vid) => {
          const iid = resolveId(vid);
          const soma = lans
            .filter(l => l.unidade_id === unidadeId && l.indicador_id === iid
              && parseISO(l.data) >= semanaInicio && parseISO(l.data) <= selDateObj)
            .reduce((acc, l) => acc + l.valor, 0);
          return String(soma);
        });

        // MEDIA_MES([id])
        expressao = expressao.replace(/MEDIA_MES\(\[([^\]]+)\]\)/g, (_, vid) => {
          const iid = resolveId(vid);
          const periodLans = lans.filter(l =>
            l.unidade_id === unidadeId && l.indicador_id === iid
            && parseISO(l.data) >= mesInicio && parseISO(l.data) <= selDateObj
          );
          const media = periodLans.length > 0 ? periodLans.reduce((acc, l) => acc + l.valor, 0) / periodLans.length : 0;
          return String(media);
        });

        // MEDIA_PONDERADA_MES([id],[peso])
        expressao = expressao.replace(/MEDIA_PONDERADA_MES\(\[([^\]]+)\],\[([^\]]+)\]\)/g, (_, vid, pesoVid) => {
          const iid = resolveId(vid);
          const pesoIid = resolveId(pesoVid);
          const periodLans = lans.filter(l =>
            l.unidade_id === unidadeId
            && parseISO(l.data) >= mesInicio && parseISO(l.data) <= selDateObj
          );
          let totalPeso = 0;
          let weightedSum = 0;
          const dates = [...new Set(periodLans.map(l => l.data))];
          dates.forEach(dt => {
            const val = periodLans.find(l => l.data === dt && l.indicador_id === iid)?.valor || 0;
            const peso = periodLans.find(l => l.data === dt && l.indicador_id === pesoIid)?.valor || 0;
            weightedSum += val * peso;
            totalPeso += peso;
          });
          return String(totalPeso > 0 ? weightedSum / totalPeso : 0);
        });

        // META_MES([id])
        expressao = expressao.replace(/META_MES\(\[([^\]]+)\]\)/g, (_, vid) => {
          const iid = resolveId(vid);
          const meta = mts.find(m =>
            m.unidade_id === unidadeId && m.ano === yr && m.mes === mo && m.indicador_id === iid
          )?.valor_meta || 0;
          return String(meta);
        });

        // DIAS_UTEIS()
        expressao = expressao.replace(/DIAS_UTEIS\(\)/g, String(diasUteisTotais));

        // DIAS_RESTANTES()
        expressao = expressao.replace(/DIAS_RESTANTES\(\)/g, String(diasRest));
      }

      // Replace [id] references with their numeric values (supports visual and internal IDs)
      expressao = expressao.replace(/\[([^\]]+)\]/g, (_, id) => {
        const trimmedId = id.trim();
        const internalId = ctx?.visualIdMap[trimmedId] ?? trimmedId;
        const val = valores[internalId] ?? valores[trimmedId];
        return val !== undefined ? String(val) : '0';
      });

      // Remove whitespace
      expressao = expressao.replace(/\s/g, '');

      // Validate: only allow digits, arithmetic operators, decimal points, and parentheses
      if (!/^[\d+\-*/().]+$/.test(expressao)) {
        return 0;
      }

      // Evaluate using Function with sanitized expression
      // eslint-disable-next-line no-new-func
      const resultado = new Function(`return (${expressao})`)();

      if (typeof resultado !== 'number' || !isFinite(resultado)) {
        return 0;
      }

      return resultado;
    } catch {
      return 0;
    }
  };

  const getCalculatedData = (u: Unidade) => {
    const year = parseISO(selectedDate).getFullYear();
    const month = parseISO(selectedDate).getMonth() + 1;
    const selectedDateObj = parseISO(selectedDate);

    // Vendas
    const tonsDia = getValor(u.id, 'v1');
    const rentDia = getValor(u.id, 'v2');
    const entradaGeral = getValor(u.id, 'v3');
    const cancelamentoBruto = getValor(u.id, 'v4');
    const carteiraAno = getValor(u.id, 'v5');
    
    // Weekly accumulation up to selected date
    const tonsSemana = getSomaPeriodo(u.id, 'v1', weekStart, selectedDateObj);
    const tonsMes = getSomaPeriodo(u.id, 'v1', currentMonthStart, selectedDateObj);
    const entradaMes = getSomaPeriodo(u.id, 'v3', currentMonthStart, selectedDateObj);
    const cancelamentoSemana = getSomaPeriodo(u.id, 'v4', weekStart, selectedDateObj);
    const mediaRentMes = getMediaPonderada(u.id, 'v2', 'v1', currentMonthStart, selectedDateObj);
    
    // Carregamento
    const prodDia = getValor(u.id, 'c1');
    const prodMes = getSomaPeriodo(u.id, 'c1', currentMonthStart, selectedDateObj);
    const prodAno = getSomaPeriodo(u.id, 'c1', currentYearStart, selectedDateObj);

    // Faturamento
    const fatVenda = getValor(u.id, 'f1');
    const fatConsig = getValor(u.id, 'f2');
    const fatRemessa = getValor(u.id, 'f3');
    const fatTotalDia = fatVenda + fatConsig + fatRemessa;
    const fatAcumuladoMes = lancamentos
      .filter(l => l.unidade_id === u.id && ['f1', 'f2', 'f3'].includes(l.indicador_id) && parseISO(l.data) >= currentMonthStart && parseISO(l.data) <= selectedDateObj)
      .reduce((acc, curr) => acc + curr.valor, 0);
    const fatAcumuladoAno = lancamentos
      .filter(l => l.unidade_id === u.id && ['f1', 'f2', 'f3'].includes(l.indicador_id) && parseISO(l.data) >= currentYearStart && parseISO(l.data) <= selectedDateObj)
      .reduce((acc, curr) => acc + curr.valor, 0);

    const metaMes = metas.find(m => m.unidade_id === u.id && m.ano === year && m.mes === month && m.indicador_id === 'f1')?.valor_meta || 0;
    const saldoDeficit = metaMes - fatAcumuladoMes;
    
    const totalDiasUteis = diasUteis.find(d => d.unidade_id === u.id && d.ano === year && d.mes === month)?.total_dias_uteis || 22;
    // Count days with invoicing
    const daysWithInvoicing = new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && ['f1', 'f2', 'f3'].includes(l.indicador_id) && parseISO(l.data) >= currentMonthStart && parseISO(l.data) <= selectedDateObj && l.valor > 0)
        .map(l => l.data)
    ).size;
    
    const diasRestantes = Math.max(0, totalDiasUteis - daysWithInvoicing);
    const mediaAFaturar = diasRestantes > 0 ? saldoDeficit / diasRestantes : 0;

    const genericData = Object.fromEntries(indicadores.map(i => [i.id, getValor(u.id, i.id)]));

    const formulaCtx: FormulaContext = {
      lancamentos,
      metas,
      unidadeId: u.id,
      selectedDate,
      visualIdMap,
      currentMonthStart,
      currentYearStart,
      weekStart,
      totalDiasUteis,
      diasRestantes,
    };

    // Process calculated indicators with formulas in dependency order (topological sort)
    const formulaIndicadores = indicadores.filter(ind => !ind.digitavel && ind.formula);
    const getDeps = (formula: string): string[] => {
      // Strip aggregation function calls before extracting direct [id] dependencies
      const stripped = formula
        .replace(/SOMA_MES\(\[[^\]]+\]\)/g, '0')
        .replace(/SOMA_ANO\(\[[^\]]+\]\)/g, '0')
        .replace(/SOMA_SEMANA\(\[[^\]]+\]\)/g, '0')
        .replace(/MEDIA_MES\(\[[^\]]+\]\)/g, '0')
        .replace(/MEDIA_PONDERADA_MES\(\[[^\]]+\],\[[^\]]+\]\)/g, '0')
        .replace(/META_MES\(\[[^\]]+\]\)/g, '0')
        .replace(/DIAS_UTEIS\(\)/g, '0')
        .replace(/DIAS_RESTANTES\(\)/g, '0');
      const deps: string[] = [];
      stripped.replace(/\[([^\]]+)\]/g, (_, id) => {
        const trimmedId = id.trim();
        const internalId = visualIdMap[trimmedId] ?? trimmedId;
        deps.push(internalId);
        return '';
      });
      return deps;
    };
    const visited = new Set<string>();
    const evaluate = (ind: typeof formulaIndicadores[number], stack: Set<string> = new Set()): void => {
      if (visited.has(ind.id)) return;
      if (stack.has(ind.id)) return; // circular reference guard
      stack.add(ind.id);
      const deps = getDeps(ind.formula!);
      for (const depId of deps) {
        const depInd = formulaIndicadores.find(i => i.id === depId);
        if (depInd) evaluate(depInd, stack);
      }
      genericData[ind.id] = avaliarFormula(ind.formula!, genericData, formulaCtx);
      visited.add(ind.id);
      stack.delete(ind.id);
    };
    for (const ind of formulaIndicadores) evaluate(ind);

    return {
      ...genericData,
      tonsDia, rentDia, entradaGeral, cancelamentoBruto, carteiraAno,
      tonsSemana, tonsMes, entradaMes, cancelamentoSemana, mediaRentMes,
      prodDia, prodMes, prodAno,
      fatVenda, fatConsig, fatRemessa, fatTotalDia, fatAcumuladoMes, fatAcumuladoAno,
      metaMes, saldoDeficit, diasRestantes, mediaAFaturar
    };
  };

  const unitData = activeUnidades.map(u => ({
    unidade: u,
    data: getCalculatedData(u)
  }));

  const formatValue = (val: number, indicadorId?: string) => {
    const ind = indicadores.find(i => i.id === indicadorId);
    const unit = ind?.unidade_medida || '';
    
    if (unit === 'R$' || unit === 'currency') {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (unit === '%' || unit === 'percent') {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
    }
    return val.toLocaleString('pt-BR');
  };

  const renderRow = (label: string, field: string, indicadorId?: string, isTotal = false) => (
    <tr className={cn("hover:bg-slate-50 transition-colors", isTotal && "bg-indigo-50/30 font-bold")}>
      <td className="px-4 py-2 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100">{label}</td>
      {unitData.map(({ data, unidade }) => {
        const val = (data as any)[field] || 0;
        return (
          <td key={unidade.id} className="px-4 py-2 text-right font-mono text-slate-600 border-r border-slate-100">
            {formatValue(val, indicadorId)}
          </td>
        );
      })}
      <td className="px-4 py-2 text-right font-bold text-indigo-700 bg-indigo-50/50">
        {(() => {
          let val = 0;
          if (field === 'rentDia') {
            // Weighted average for daily rentability
            const totalTons = unitData.reduce((acc, curr) => acc + curr.data.tonsDia, 0);
            const weightedSum = unitData.reduce((acc, curr) => acc + (curr.data.rentDia * curr.data.tonsDia), 0);
            val = totalTons > 0 ? weightedSum / totalTons : 0;
          } else if (field === 'mediaRentMes') {
            // Weighted average for monthly rentability
            const totalTons = unitData.reduce((acc, curr) => acc + curr.data.tonsMes, 0);
            const weightedSum = unitData.reduce((acc, curr) => acc + (curr.data.mediaRentMes * curr.data.tonsMes), 0);
            val = totalTons > 0 ? weightedSum / totalTons : 0;
          } else if (field === 'diasRestantes') {
            val = unitData.length > 0 ? unitData.reduce((acc, curr) => acc + curr.data.diasRestantes, 0) / unitData.length : 0;
          } else {
            val = unitData.reduce((acc, curr) => acc + ((curr.data as any)[field] || 0), 0);
          }
          return formatValue(val, indicadorId);
        })()}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Capa / Relatório Consolidado</h1>
          <p className="text-slate-500">Gestão de Unidades - ONE Superfast</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 w-48">INDICADORES</th>
              {activeUnidades.map(u => (
                <th key={u.id} className="px-4 py-3 font-bold text-slate-700 text-center border-r border-slate-200 min-w-[120px]">{u.nome}</th>
              ))}
              <th className="px-4 py-3 font-bold text-indigo-700 text-center bg-indigo-100 min-w-[120px]">TOTAL GERAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[...categorias].sort((a, b) => a.ordem - b.ordem).map(cat => {
              const catIndicadores = indicadores
                .filter(i => i.categoria === cat.nome)
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

              return (
                <React.Fragment key={cat.id}>
                  <tr className="bg-slate-50">
                    <td colSpan={activeUnidades.length + 2} className="px-4 py-1 font-black text-indigo-600 text-[10px] uppercase">
                      {cat.nome}
                    </td>
                  </tr>
                  {catIndicadores.map(ind => (
                    <React.Fragment key={ind.id}>
                      {renderRow(ind.nome, ind.id as any, ind.id)}
                      
                      {/* Special Variations */}
                      {ind.id === 'v1' && (
                        <>
                          {renderRow('Acumulado Tons Semana', 'tonsSemana', 'v1')}
                          {renderRow('Acumulado Tons Mês', 'tonsMes', 'v1')}
                        </>
                      )}
                      {ind.id === 'v2' && renderRow('Média Rentabilidade Mês', 'mediaRentMes', 'v2')}
                      {ind.id === 'v4' && renderRow('Cancelamento Semana', 'cancelamentoSemana', 'v4')}
                      {ind.id === 'c1' && (
                        <>
                          {renderRow('Acumulado Produção Mês', 'prodMes', 'c1')}
                          {renderRow('Acumulado Produção Ano', 'prodAno', 'c1')}
                        </>
                      )}
                      {ind.id === 'f3' && (
                        <>
                          {renderRow('Total Faturado Dia', 'fatTotalDia', 'f1', true)}
                          {renderRow('Total Acumulado Mês', 'fatAcumuladoMes', 'f1')}
                          {renderRow('Meta do Mês', 'metaMes', 'f1')}
                          {renderRow('Saldo / Déficit', 'saldoDeficit', 'f1')}
                          {renderRow('Dias Restantes', 'diasRestantes')}
                          {renderRow('Média a Faturar / Dia', 'mediaAFaturar', 'f1')}
                          {renderRow('Faturamento Acumulado Ano', 'fatAcumuladoAno', 'f1')}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );

};

const Lancamentos = ({ 
  unidades, 
  indicadores, 
  categorias,
  configs,
  currentUser,
  onSave 
}: { 
  unidades: Unidade[]; 
  indicadores: Indicador[]; 
  categorias: Categoria[];
  configs: ConfiguracaoIndicador[];
  currentUser: User;
  onSave: (l: Partial<Lancamento>[]) => Promise<void> 
}) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedUnidade && selectedDate) {
      getMgmtLancamentos({ data: selectedDate, unidade_id: selectedUnidade })
        .then(data => {
          const newValues: Record<string, number> = {};
          data.forEach((l: Lancamento) => {
            newValues[l.indicador_id] = l.valor;
          });
          setValues(newValues);
        });
    }
  }, [selectedDate, selectedUnidade]);

  const handleSave = async () => {
    if (!selectedUnidade) return;
    setLoading(true);
    const toSave: Partial<Lancamento>[] = Object.entries(values).map(([indicador_id, valor]) => ({
      id: `${selectedDate}-${selectedUnidade}-${indicador_id}`,
      data: selectedDate,
      unidade_id: selectedUnidade,
      indicador_id,
      valor: Number(valor),
      usuario_id: currentUser.id
    }));
    await onSave(toSave);
    setLoading(false);
  };

  const getIndicadorLabel = (ind: Indicador) => {
    const config = configs.find(c => c.unidade_id === selectedUnidade && c.indicador_id === ind.id);
    return config?.nome_personalizado || ind.nome;
  };

  const isIndicadorVisible = (ind: Indicador) => {
    const config = configs.find(c => c.unidade_id === selectedUnidade && c.indicador_id === ind.id);
    return config ? config.visivel : true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lançamento Diário</h1>
          <p className="text-slate-500">Registre os indicadores do dia</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar Excel
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedUnidade} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Lançamentos
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-indigo-50/30 border-indigo-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Data do Lançamento</label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unidade de Negócio</label>
            <Select value={selectedUnidade} onChange={(e) => setSelectedUnidade(e.target.value)}>
              <option value="">Selecione uma unidade...</option>
              {unidades.filter(u => u.ativo).map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {!selectedUnidade ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ArrowRightLeft className="w-12 h-12 mb-4 opacity-20" />
          <p>Selecione uma unidade para iniciar os lançamentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...categorias].sort((a, b) => a.ordem - b.ordem).map(cat => (
            <div key={cat.id}>
              <Card className="flex flex-col h-full">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-indigo-600 text-xs uppercase tracking-wider">{cat.nome}</h3>
                </div>
                <div className="p-4 space-y-4 flex-1">
                  {indicadores.filter(i => i.categoria === cat.nome && i.digitavel && isIndicadorVisible(i)).map(ind => (
                    <div key={ind.id} className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{getIndicadorLabel(ind)}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{ind.unidade_medida}</p>
                      </div>
                      <div className="w-32">
                        <Input 
                          type="number" 
                          value={values[ind.id] || ''} 
                          onChange={(e) => setValues(prev => ({ ...prev, [ind.id]: parseFloat(e.target.value) }))}
                          placeholder="0.00"
                          className="text-right font-mono"
                        />
                      </div>
                    </div>
                  ))}
                  {indicadores.filter(i => i.categoria === cat.nome && i.digitavel && isIndicadorVisible(i)).length === 0 && (
                    <p className="text-xs text-slate-400 italic">Nenhum indicador visível nesta categoria.</p>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Cadastros = ({ 
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
  onDeleteDiasUteis
}: { 
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
}) => {
  const [activeTab, setActiveTab] = useState<'indicadores' | 'categorias' | 'metas' | 'config-unidades' | 'dias-uteis' | 'guia-formulas' | 'unidades'>('categorias');
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'unidade' | 'indicador' | 'categoria' | 'meta' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDigitavel, setIsDigitavel] = useState(true);

  const { reverseVisualIdMap } = generateVisualIdMaps(indicadores, categorias);

  const handleOpenModal = (type: 'unidade' | 'indicador' | 'categoria' | 'meta', item: any = null) => {
    setModalType(type);
    setEditingItem(item);
    setIsDigitavel(type === 'indicador' ? (item ? item.digitavel : true) : true);
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
      const categoryIndicadores = indicadores.filter(i => i.categoria === category).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const oldIndex = categoryIndicadores.findIndex(i => i.id === active.id);
      const newIndex = categoryIndicadores.findIndex(i => i.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(categoryIndicadores, oldIndex, newIndex);
        // Update order for all indicators in this category
        await Promise.all(newOrder.map((ind, idx) => 
          onSaveIndicador({ ...ind, ordem: idx + 1 })
        ));
      }
    }
  };

  const handleDragEndCategories = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sortedCategories = [...categorias].sort((a, b) => a.ordem - b.ordem);
      const oldIndex = sortedCategories.findIndex(c => c.id === active.id);
      const newIndex = sortedCategories.findIndex(c => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex);
        await Promise.all(newOrder.map((cat, idx) => 
          onSaveCategoria({ ...cat, ordem: idx + 1 })
        ));
      }
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
          { id: 'guia-formulas', label: 'Guia de Fórmulas', icon: BookOpen },
        ].map(tab => (
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
            title={editingItem ? `Editar ${modalType === 'unidade' ? 'Unidade' : modalType === 'indicador' ? 'Indicador' : modalType === 'categoria' ? 'Categoria' : 'Meta'}` : `Nova ${modalType === 'unidade' ? 'Unidade' : modalType === 'indicador' ? 'Indicador' : modalType === 'categoria' ? 'Categoria' : 'Meta'}`}
          >
            <form onSubmit={async (e) => {
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
                    ativo: editingItem ? editingItem.ativo : true
                  });
                }
              } else if (modalType === 'categoria') {
                const nome = formData.get('nome') as string;
                const ordem = parseInt(formData.get('ordem') as string);
                if (nome) {
                  await onSaveCategoria({
                    id: editingItem?.id || crypto.randomUUID(),
                    nome,
                    ordem: ordem || categorias.length + 1
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
                    formula: !digitavel && formula ? formula : undefined
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
                    valor_meta
                  });
                }
              }
              handleCloseModal();
            }} className="space-y-4">
              {modalType === 'unidade' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome da Unidade</label>
                    <Input name="nome" defaultValue={editingItem?.nome} placeholder="Ex: Unidade São Paulo" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Ordem de Exibição</label>
                    <Input name="ordem" type="number" defaultValue={editingItem?.ordem_exibicao} placeholder="Ex: 1" />
                  </div>
                </>
              )}
              {modalType === 'indicador' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome do Indicador</label>
                    <Input name="nome" defaultValue={editingItem?.nome} placeholder="Ex: Tons Vendidos" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Categoria</label>
                    <Select name="categoria" defaultValue={editingItem?.categoria || (categorias.length > 0 ? categorias[0].nome : '')}>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unidade de Medida</label>
                    <Input name="unidade_medida" defaultValue={editingItem?.unidade_medida} placeholder="Ex: TON., R$, %" required />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="digitavel" checked={isDigitavel} onChange={(e) => setIsDigitavel(e.target.checked)} id="digitavel-check" />
                    <label htmlFor="digitavel-check" className="text-sm font-medium text-slate-700">Indicador Digitável</label>
                  </div>
                  {!isDigitavel && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Fórmula de Cálculo</label>
                      <Input
                        name="formula"
                        defaultValue={editingItem?.formula || ''}
                        placeholder="Ex: [f1] / [v1]"
                      />
                      <p className="text-xs text-slate-400">
                        💡 Use [id] para referenciar outros indicadores. Ex: [f1] / [v1] para Ticket Médio.
                      </p>
                    </div>
                  )}
                </>
              )}
              {modalType === 'categoria' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome da Categoria</label>
                    <Input name="nome" defaultValue={editingItem?.nome} placeholder="Ex: Faturamento" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Ordem de Exibição</label>
                    <Input name="ordem" type="number" defaultValue={editingItem?.ordem} placeholder="Ex: 1" />
                  </div>
                </>
              )}
              {modalType === 'meta' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unidade</label>
                    <Select name="unidade_id" defaultValue={editingItem?.unidade_id || selectedUnidade} required>
                      <option value="">Selecione...</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Indicador</label>
                    <Select name="indicador_id" defaultValue={editingItem?.indicador_id} required>
                      <option value="">Selecione...</option>
                      {indicadores.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Mês</label>
                      <Select name="mes" defaultValue={editingItem?.mes || new Date().getMonth() + 1}>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Ano</label>
                      <Input name="ano" type="number" defaultValue={editingItem?.ano || new Date().getFullYear()} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Valor da Meta</label>
                    <Input name="valor_meta" type="number" step="0.01" defaultValue={editingItem?.valor_meta} placeholder="0.00" required />
                  </div>
                </>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>Cancelar</Button>
                <Button type="submit" className="gap-2">
                  <Save className="w-4 h-4" /> Salvar
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {activeTab === 'unidades' && (
          <MotionDiv key="unidades" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenModal('unidade')} className="gap-2">
                <Plus className="w-4 h-4" /> Nova Unidade
              </Button>
            </div>
            <Card>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">Nome</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Ordem</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unidades.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.nome}</td>
                      <td className="px-4 py-3 text-slate-600">{u.ordem_exibicao}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold uppercase', u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal('unidade', u)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onSaveUnidade({ ...u, ativo: !u.ativo })} title={u.ativo ? 'Desativar' : 'Ativar'}>
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteUnidade(u.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
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

        {activeTab === 'categorias' && (
          <MotionDiv key="categorias" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
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
                      <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <SortableContext 
                      items={categorias.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {[...categorias].sort((a, b) => a.ordem - b.ordem).map(c => (
                        <SortableCategoryRow 
                          key={c.id} 
                          categoria={c} 
                          onEdit={(cat) => handleOpenModal('categoria', cat)}
                          onDelete={onDeleteCategoria}
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
          <MotionDiv key="indicadores" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenModal('indicador')} className="gap-2">
                <Plus className="w-4 h-4" /> Novo Indicador
              </Button>
            </div>
            
            {[...categorias].sort((a, b) => a.ordem - b.ordem).map(cat => {
              const catIndicadores = indicadores
                .filter(i => i.categoria === cat.nome)
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
              
              return (
                <div key={cat.id} className="space-y-3">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider px-1">{cat.nome}</h3>
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
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {catIndicadores.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                Nenhum indicador nesta categoria. Arraste um indicador para cá ou crie um novo.
                              </td>
                            </tr>
                          ) : (
                            <SortableContext 
                              items={catIndicadores.map(i => i.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {catIndicadores.map(i => (
                                <SortableIndicadorRow 
                                  key={i.id} 
                                  indicador={i} 
                                  onEdit={(ind) => handleOpenModal('indicador', ind)}
                                  onDelete={onDeleteIndicador}
                                  visualId={reverseVisualIdMap[i.id]}
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
          <MotionDiv key="metas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
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
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Valor Meta</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metas.map((m, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">{unidades.find(u => u.id === m.unidade_id)?.nome}</td>
                      <td className="px-4 py-3">{indicadores.find(i => i.id === m.indicador_id)?.nome}</td>
                      <td className="px-4 py-3">{m.mes}/{m.ano}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">
                        {m.valor_meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal('meta', m)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteMeta(m.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
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
          <MotionDiv key="config-unidades" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700">Selecione a Unidade para Personalizar</label>
                <Select value={selectedUnidade} onChange={(e) => setSelectedUnidade(e.target.value)}>
                  <option value="">Selecione...</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
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
                    {indicadores.map(i => {
                      const config = configs.find(c => c.unidade_id === selectedUnidade && c.indicador_id === i.id);
                      return (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{i.nome}</td>
                          <td className="px-4 py-3">
                            <Input 
                              placeholder={i.nome} 
                              defaultValue={config?.nome_personalizado || ''} 
                              onBlur={(e) => onSaveConfig({ unidade_id: selectedUnidade, indicador_id: i.id, nome_personalizado: e.target.value, visivel: config?.visivel ?? true })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              checked={config?.visivel ?? true} 
                              onChange={(e) => onSaveConfig({ unidade_id: selectedUnidade, indicador_id: i.id, nome_personalizado: config?.nome_personalizado || '', visivel: e.target.checked })}
                            />
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => onSaveConfig({ unidade_id: selectedUnidade, indicador_id: i.id, nome_personalizado: config?.nome_personalizado || '', visivel: config?.visivel ?? true })} title="Salvar">
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDeleteConfig(selectedUnidade, i.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Excluir Personalização">
                              <Trash2 className="w-4 h-4" />
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
          <MotionDiv key="dias-uteis" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Card className="p-6">
              <form onSubmit={async (e) => {
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
                    total_dias_uteis: total
                  });
                  e.currentTarget.reset();
                }
              }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unidade</label>
                  <Select name="unidade_id" required>
                    <option value="">Selecione...</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mês/Ano</label>
                  <div className="flex gap-2">
                    <Select name="mes" defaultValue={new Date().getMonth() + 1}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{format(new Date(2024, i, 1), 'MM', { locale: ptBR })}</option>
                      ))}
                    </Select>
                    <Input name="ano" type="number" defaultValue={new Date().getFullYear()} className="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Total Dias Úteis</label>
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
                      <td className="px-4 py-3">{unidades.find(u => u.id === d.unidade_id)?.nome}</td>
                      <td className="px-4 py-3">{d.mes}/{d.ano}</td>
                      <td className="px-4 py-3 font-bold">{d.total_dias_uteis}</td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          const novoTotal = prompt('Novo total de dias úteis:', d.total_dias_uteis.toString());
                          if (novoTotal) onSaveDiasUteis({ ...d, total_dias_uteis: parseInt(novoTotal) });
                        }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteDiasUteis(d.unidade_id, d.ano, d.mes)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
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

        {activeTab === 'guia-formulas' && (
          <MotionDiv key="guia-formulas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

            {/* Como Funciona */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">🎯</span> Como Funciona
              </h2>
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="font-bold text-indigo-600 min-w-[1.5rem]">1.</span>
                  <span>Vá em <strong>Indicadores</strong> e clique em <strong>Novo Indicador</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-indigo-600 min-w-[1.5rem]">2.</span>
                  <span>Preencha o nome e desmarque a opção <strong>Indicador Digitável</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-indigo-600 min-w-[1.5rem]">3.</span>
                  <span>No campo <strong>Fórmula de Cálculo</strong>, escreva a expressão usando os IDs dos indicadores (veja a tabela de IDs no final desta página)</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-indigo-600 min-w-[1.5rem]">4.</span>
                  <span>Salve — o sistema calculará o valor automaticamente no Dashboard a cada vez que os dados forem exibidos</span>
                </li>
              </ol>
            </Card>

            {/* Referências [id] */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📌</span> Referências{' '}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-600 text-base">[id]</code>
              </h2>
              <p className="text-sm text-slate-600 mb-3">
                Use <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">[id]</code> para referenciar o <strong>valor do dia selecionado</strong> de outro indicador.
                O ID visual é exibido abaixo do nome de cada indicador na lista.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm space-y-1">
                <p className="text-slate-400">{'// Referência simples: valor do dia'}</p>
                <p className="text-indigo-700">[f1] + [f2]</p>
                <p className="text-slate-400 mt-2">{'// Ticket Médio do dia: Faturamento ÷ Tons'}</p>
                <p className="text-indigo-700">[f2] / [f1]</p>
              </div>
            </Card>

            {/* Operadores */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">➕</span> Operadores
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Operador</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Descrição</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { op: '+', desc: 'Adição', ex: '[f1] + [f2]' },
                      { op: '-', desc: 'Subtração', ex: '[f1] - [f2]' },
                      { op: '*', desc: 'Multiplicação', ex: '[f1] * 1.1' },
                      { op: '/', desc: 'Divisão', ex: '[f2] / [f1]' },
                      { op: '()', desc: 'Agrupamento / precedência', ex: '([f1] + [f2]) / 2' },
                    ].map(row => (
                      <tr key={row.op}>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{row.op}</td>
                        <td className="px-4 py-2 text-slate-700">{row.desc}</td>
                        <td className="px-4 py-2 font-mono text-slate-500">{row.ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Funções de Agregação */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span> Funções de Agregação Temporal
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Calculam valores acumulados ao longo de um período, consultando todos os lançamentos registrados.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Função</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Descrição</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { fn: 'SOMA_MES([id])', desc: 'Soma todos os lançamentos do mês até a data selecionada', ex: 'SOMA_MES([f1])' },
                      { fn: 'SOMA_ANO([id])', desc: 'Soma todos os lançamentos do ano até a data selecionada', ex: 'SOMA_ANO([f1])' },
                      { fn: 'SOMA_SEMANA([id])', desc: 'Soma os lançamentos da semana corrente (seg → data selecionada)', ex: 'SOMA_SEMANA([n1])' },
                      { fn: 'MEDIA_MES([id])', desc: 'Média simples dos lançamentos do mês', ex: 'MEDIA_MES([r1])' },
                      { fn: 'MEDIA_PONDERADA_MES([id],[peso])', desc: 'Média ponderada mensal: Σ(valor × peso) ÷ Σ(peso)', ex: 'MEDIA_PONDERADA_MES([r1],[f1])' },
                    ].map(row => (
                      <tr key={row.fn}>
                        <td className="px-4 py-2 font-mono text-indigo-600 whitespace-nowrap text-xs">{row.fn}</td>
                        <td className="px-4 py-2 text-slate-700">{row.desc}</td>
                        <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap text-xs">{row.ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Funções Especiais */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">⚙️</span> Funções Especiais
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Função</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Descrição</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Exemplo de uso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-2 font-mono text-indigo-600 whitespace-nowrap text-xs">META_MES([id])</td>
                      <td className="px-4 py-2 text-slate-700">Retorna o valor da meta mensal cadastrada para o indicador</td>
                      <td className="px-4 py-2 font-mono text-slate-500 text-xs whitespace-nowrap">META_MES([f2]) - SOMA_MES([f2])</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-indigo-600 whitespace-nowrap text-xs">DIAS_UTEIS()</td>
                      <td className="px-4 py-2 text-slate-700">Total de dias úteis do mês (configurado na aba Dias Úteis)</td>
                      <td className="px-4 py-2 font-mono text-slate-500 text-xs whitespace-nowrap">SOMA_MES([f2]) / DIAS_UTEIS()</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono text-indigo-600 whitespace-nowrap text-xs">DIAS_RESTANTES()</td>
                      <td className="px-4 py-2 text-slate-700">Dias úteis restantes no mês (baseado nos dias com faturamento já lançado)</td>
                      <td className="px-4 py-2 font-mono text-slate-500 text-xs whitespace-nowrap">(META_MES([f2]) - SOMA_MES([f2])) / DIAS_RESTANTES()</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 10 Exemplos Práticos */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">💡</span> 10 Exemplos Práticos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: '1. Ticket Médio Mensal (R$/Ton)', formula: 'SOMA_MES([f2]) / SOMA_MES([f1])', desc: 'Faturamento acumulado no mês ÷ Tons acumuladas no mês' },
                  { title: '2. Faturamento Acumulado Mês', formula: 'SOMA_MES([f2]) + SOMA_MES([f3]) + SOMA_MES([f4])', desc: 'Soma de todos os faturamentos no mês corrente' },
                  { title: '3. Tons Acumulado Ano', formula: 'SOMA_ANO([f1])', desc: 'Total de tons vendidas desde janeiro até hoje' },
                  { title: '4. Saldo de Meta (Déficit)', formula: 'META_MES([f2]) - SOMA_MES([f2])', desc: 'Quanto falta faturar para atingir a meta do mês' },
                  { title: '5. Projeção Diária Necessária', formula: '(META_MES([f2]) - SOMA_MES([f2])) / DIAS_RESTANTES()', desc: 'Média diária mínima necessária para bater a meta' },
                  { title: '6. Média Diária Realizada', formula: 'SOMA_MES([f2]) / DIAS_UTEIS()', desc: 'Média de faturamento por dia útil no mês' },
                  { title: '7. Rentabilidade Ponderada Mês', formula: 'MEDIA_PONDERADA_MES([r1],[f1])', desc: 'Rentabilidade média ponderada pelo volume de tons' },
                  { title: '8. Cancelamentos na Semana', formula: 'SOMA_SEMANA([n1])', desc: 'Total de cancelamentos registrados na semana corrente' },
                  { title: '9. % Atingimento da Meta', formula: '(SOMA_MES([f2]) / META_MES([f2])) * 100', desc: 'Percentual da meta mensal já atingido' },
                  { title: '10. Faturamento Total do Dia', formula: '[f2] + [f3] + [f4]', desc: 'Soma dos faturamentos lançados no dia selecionado' },
                ].map(ex => (
                  <div key={ex.title} className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="font-bold text-slate-800 text-sm">{ex.title}</p>
                    <p className="font-mono text-indigo-600 text-xs bg-white border border-slate-200 rounded px-2 py-1.5 break-all">{ex.formula}</p>
                    <p className="text-xs text-slate-500">{ex.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Dicas e Cuidados */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Dicas e Cuidados
              </h2>
              <ul className="space-y-3 text-sm text-slate-700">
                {[
                  { icon: '⚡', text: <><strong>Divisão por zero:</strong> O sistema retorna 0 automaticamente quando o denominador é zero. Exemplo: se <code className="bg-slate-100 px-1 rounded">SOMA_MES([f1])</code> for 0, a divisão resulta em 0.</> },
                  { icon: '⚡', text: <><strong>IDs dinâmicos:</strong> Os IDs visuais (<code className="bg-slate-100 px-1 rounded">f1</code>, <code className="bg-slate-100 px-1 rounded">r1</code>...) são gerados pela ordem dos indicadores na categoria. Se você reorganizar os indicadores, os IDs mudam — revise as fórmulas.</> },
                  { icon: '⚡', text: <><strong>Parênteses:</strong> Use parênteses para garantir a precedência correta: <code className="bg-slate-100 px-1 rounded">([f1] + [f2]) / 2</code> é diferente de <code className="bg-slate-100 px-1 rounded">[f1] + [f2] / 2</code>.</> },
                  { icon: '⚡', text: <><strong>DIAS_RESTANTES():</strong> Conta os dias úteis do mês ainda não cobertos por lançamentos de faturamento. Depende da configuração de Dias Úteis e dos lançamentos existentes.</> },
                  { icon: '⚡', text: <><strong>Dependências circulares:</strong> Evite que um indicador calculado referencia a si mesmo direta ou indiretamente. O sistema detecta e ignora referências circulares.</> },
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-amber-500 mt-0.5">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Tabela de IDs Atuais */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="text-2xl">🏷️</span> IDs Atuais dos Indicadores
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Use estes IDs nas suas fórmulas. Os IDs são gerados automaticamente com base na categoria e na ordem dos indicadores.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">ID Visual</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Nome do Indicador</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Categoria</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-700">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...categorias].sort((a, b) => a.ordem - b.ordem).flatMap(cat =>
                      indicadores
                        .filter(i => i.categoria === cat.nome)
                        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                        .map(ind => (
                          <tr key={ind.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <code className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-bold text-xs">
                                {reverseVisualIdMap[ind.id] || ind.id}
                              </code>
                            </td>
                            <td className="px-4 py-2 font-medium text-slate-900">{ind.nome}</td>
                            <td className="px-4 py-2 text-slate-600">{cat.nome}</td>
                            <td className="px-4 py-2">
                              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', ind.digitavel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600')}>
                                {ind.digitavel ? 'Digitável' : 'Calculado'}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </MotionDiv>
        )}
      </AnimatePresenceComponent>
    </div>
  );
};

// --- Main Module Component ---

export default function ManagementReportsModule({ currentUser, activeTab }: ManagementReportsModuleProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [metas, setMetas] = useState<MetaMensal[]>([]);
  const [configs, setConfigs] = useState<ConfiguracaoIndicador[]>([]);
  const [diasUteis, setDiasUteis] = useState<DiasUteisMes[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [u, i, cat, l, m, c, d] = await Promise.all([
        getMgmtUnidades(),
        getMgmtIndicadores(),
        getMgmtCategorias(),
        getMgmtLancamentos(),
        getMgmtMetas(),
        getMgmtConfigs(),
        getMgmtDiasUteis(),
      ]);
      setUnidades(u);
      setIndicadores(i);
      setCategorias(cat);
      setLancamentos(l);
      setMetas(m);
      setConfigs(c);
      setDiasUteis(d);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveLancamentos = async (newLancamentos: Partial<Lancamento>[]) => {
    try {
      await upsertMgmtLancamentos(newLancamentos);
      await fetchData();
      showToast('✅ Lançamento registrado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao registrar lançamento:', error);
      showToast('❌ Erro ao registrar lançamento. Tente novamente.', 'error');
    }
  };

  const handleSaveUnidade = async (u: Unidade) => {
    try {
      await upsertMgmtUnidade(u);
      await fetchData();
      showToast('Unidade salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      showToast('❌ Erro ao salvar unidade. Tente novamente.', 'error');
    }
  };

  const handleSaveIndicador = async (i: Indicador) => {
    try {
      await upsertMgmtIndicador(i);
      await fetchData();
      showToast('Indicador salvo com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar indicador:', error);
      showToast('❌ Erro ao salvar indicador. Tente novamente.', 'error');
    }
  };

  const handleSaveCategoria = async (c: Categoria) => {
    try {
      await upsertMgmtCategoria(c);
      await fetchData();
      showToast('Categoria salva com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showToast('❌ Erro ao salvar categoria. Tente novamente.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Carregando RELATÓRIOS GERENCIAIS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-8">
      <MotionDiv
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'dashboard' && (
          <Dashboard 
            unidades={unidades} 
            indicadores={indicadores} 
            categorias={categorias}
            lancamentos={lancamentos} 
            metas={metas} 
            configs={configs}
            diasUteis={diasUteis}
          />
        )}
        {activeTab === 'lancamentos' && (
          <Lancamentos 
            unidades={unidades} 
            indicadores={indicadores} 
            categorias={categorias}
            configs={configs}
            currentUser={currentUser}
            onSave={handleSaveLancamentos} 
          />
        )}
        {activeTab === 'cadastros' && (
          <Cadastros 
            unidades={unidades} 
            indicadores={indicadores} 
            categorias={categorias}
            metas={metas}
            configs={configs}
            diasUteis={diasUteis}
            onSaveUnidade={handleSaveUnidade}
            onSaveIndicador={handleSaveIndicador}
            onSaveCategoria={handleSaveCategoria}
            onSaveMeta={async (m) => {
              try {
                await upsertMgmtMeta(m);
                await fetchData();
                showToast('Meta salva com sucesso', 'success');
              } catch (error) {
                console.error('Erro ao salvar meta:', error);
                showToast('❌ Erro ao salvar meta. Tente novamente.', 'error');
              }
            }}
            onSaveConfig={async (c) => {
              try {
                await upsertMgmtConfig(c);
                await fetchData();
                showToast('Configuração salva com sucesso', 'success');
              } catch (error) {
                console.error('Erro ao salvar configuração:', error);
                showToast('❌ Erro ao salvar configuração. Tente novamente.', 'error');
              }
            }}
            onSaveDiasUteis={async (d) => {
              try {
                await upsertMgmtDiasUteis(d);
                await fetchData();
                showToast('Dias úteis salvos com sucesso', 'success');
              } catch (error) {
                console.error('Erro ao salvar dias úteis:', error);
                showToast('❌ Erro ao salvar dias úteis. Tente novamente.', 'error');
              }
            }}
            onDeleteUnidade={async (id) => {
              if (confirm('Tem certeza que deseja excluir esta unidade?')) {
                try {
                  await deleteMgmtUnidade(id);
                  await fetchData();
                  showToast('Unidade excluída com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir unidade:', error);
                  showToast('❌ Erro ao excluir unidade. Tente novamente.', 'error');
                }
              }
            }}
            onDeleteIndicador={async (id) => {
              if (confirm('Tem certeza que deseja excluir este indicador?')) {
                try {
                  await deleteMgmtIndicador(id);
                  await fetchData();
                  showToast('Indicador excluído com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir indicador:', error);
                  showToast('❌ Erro ao excluir indicador. Tente novamente.', 'error');
                }
              }
            }}
            onDeleteCategoria={async (id) => {
              if (confirm('Tem certeza que deseja excluir esta categoria?')) {
                try {
                  await deleteMgmtCategoria(id);
                  await fetchData();
                  showToast('Categoria excluída com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir categoria:', error);
                  showToast('❌ Erro ao excluir categoria. Tente novamente.', 'error');
                }
              }
            }}
            onDeleteMeta={async (id) => {
              if (confirm('Tem certeza que deseja excluir esta meta?')) {
                try {
                  await deleteMgmtMeta(id);
                  await fetchData();
                  showToast('Meta excluída com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir meta:', error);
                  showToast('❌ Erro ao excluir meta. Tente novamente.', 'error');
                }
              }
            }}
            onDeleteConfig={async (uId, iId) => {
              if (confirm('Tem certeza que deseja excluir esta personalização?')) {
                try {
                  await deleteMgmtConfig(uId, iId);
                  await fetchData();
                  showToast('Personalização excluída com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir personalização:', error);
                  showToast('❌ Erro ao excluir personalização. Tente novamente.', 'error');
                }
              }
            }}
            onDeleteDiasUteis={async (uId, ano, mes) => {
              if (confirm('Tem certeza que deseja excluir este registro de dias úteis?')) {
                try {
                  await deleteMgmtDiasUteis(uId, ano, mes);
                  await fetchData();
                  showToast('Dias úteis excluídos com sucesso', 'success');
                } catch (error) {
                  console.error('Erro ao excluir dias úteis:', error);
                  showToast('❌ Erro ao excluir dias úteis. Tente novamente.', 'error');
                }
              }
            }}
          />
        )}
      </MotionDiv>

      <AnimatePresenceComponent>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresenceComponent>
    </div>
  );
}
