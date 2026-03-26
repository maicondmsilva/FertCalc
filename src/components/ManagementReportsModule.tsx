import React, { useState, useEffect, useMemo } from 'react';
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
  HelpCircle
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

interface ManagementReportsModuleProps {
  currentUser: User;
  activeTab: 'dashboard' | 'lancamentos' | 'cadastros';
}

const MotionDiv = motion.div as any;
const AnimatePresenceComponent = AnimatePresence as any;

// --- Visual ID generation ---
const CATEGORIA_PREFIXOS: Record<string, string> = {
  'Faturamento': 'f',
  'Carregamento': 'c',
  'Rentabilidade': 'r',
  'Cancelamentos': 'n',
  'Entrada de Pedidos': 'e',
  'Carteira de Pedidos': 't',
  'Produção': 'p',
};

function gerarPrefixoCategoria(categoriaNome: string, prefixosUsados: Set<string>): string {
  const padrao = CATEGORIA_PREFIXOS[categoriaNome];
  if (padrao && !prefixosUsados.has(padrao)) return padrao;

  const nome = categoriaNome.toLowerCase().replace(/\s/g, '');
  for (const char of nome) {
    if (/[a-z]/.test(char) && !prefixosUsados.has(char)) return char;
  }
  // Last resort: find any unused letter a-z
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(97 + i);
    if (!prefixosUsados.has(c)) return c;
  }
  return 'x';
}

function gerarIdsVisuais(
  indicadores: Indicador[],
  categorias: Categoria[]
): { visualIdMap: Record<string, string>; reverseVisualIdMap: Record<string, string> } {
  const visualIdMap: Record<string, string> = {};
  const reverseVisualIdMap: Record<string, string> = {};
  const prefixosUsados = new Set<string>();

  const categoriaPrefixo: Record<string, string> = {};
  [...categorias].sort((a, b) => a.ordem - b.ordem).forEach(cat => {
    const prefixo = gerarPrefixoCategoria(cat.nome, prefixosUsados);
    categoriaPrefixo[cat.nome] = prefixo;
    prefixosUsados.add(prefixo);
  });

  const contadores: Record<string, number> = {};
  [...indicadores]
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .forEach(ind => {
      const prefixo = categoriaPrefixo[ind.categoria] || 'x';
      contadores[prefixo] = (contadores[prefixo] || 0) + 1;
      const visualId = `${prefixo}${contadores[prefixo]}`;
      visualIdMap[ind.id] = visualId;
      reverseVisualIdMap[visualId] = ind.id;
    });

  return { visualIdMap, reverseVisualIdMap };
}

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
  visualId: string;
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
        <span className="block text-[10px] text-indigo-500 font-mono font-bold">ID: {visualId}</span>
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
  onDelete,
  onToggleVisibilidadeCapa
}: { 
  categoria: Categoria; 
  onEdit: (c: Categoria) => void; 
  onDelete: (id: string) => void;
  onToggleVisibilidadeCapa: (c: Categoria) => void;
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

  const visivelCapa = categoria.visivel_capa ?? true;

  return (
    <tr ref={setNodeRef} style={style} className={cn("hover:bg-slate-50", isDragging && "bg-slate-100 shadow-inner")}>
      <td className="px-4 py-3">
        <button {...attributes} {...listeners} className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">{categoria.nome}</td>
      <td className="px-4 py-3 text-slate-600">{categoria.ordem}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleVisibilidadeCapa(categoria)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
            visivelCapa ? 'bg-indigo-600' : 'bg-slate-200'
          )}
          title={visivelCapa ? 'Clique para ocultar da capa' : 'Clique para mostrar na capa'}
        >
          <span className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
            visivelCapa ? 'translate-x-6' : 'translate-x-1'
          )} />
        </button>
      </td>
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

  const { reverseVisualIdMap } = useMemo(
    () => gerarIdsVisuais(indicadores, categorias),
    [indicadores, categorias]
  );
  
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

  const avaliarFormula = (
    formula: string,
    valores: Record<string, number>,
    valoresMes: Record<string, number> = {},
    valoresAno: Record<string, number> = {},
    valoresMesAnt: Record<string, number> = {},
    valoresAnoAnt: Record<string, number> = {},
    valoresSem: Record<string, number> = {},
    valoresSemAnt: Record<string, number> = {},
    diasComLancMes = 1,
    diasComLancAno = 1,
    diasComLancSem = 1,
  ): number => {
    try {
      let expressao = formula;

      // 1. Specific accumulation tags FIRST (longer prefixes before shorter ones to avoid partial matches)
      expressao = expressao.replace(/ACUM_MES_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMesAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      expressao = expressao.replace(/ACUM_ANO_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAnoAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // Previous-week accumulation tag
      expressao = expressao.replace(/ACUM_SEM_ANT\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSemAnt[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // Average tags: ACUM / number-of-days-with-data
      expressao = expressao.replace(/MEDIA_MES\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMes[idInterno] ?? 0;
        return String(diasComLancMes > 0 ? val / diasComLancMes : 0);
      });

      expressao = expressao.replace(/MEDIA_ANO\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAno[idInterno] ?? 0;
        return String(diasComLancAno > 0 ? val / diasComLancAno : 0);
      });

      expressao = expressao.replace(/MEDIA_SEM\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSem[idInterno] ?? 0;
        return String(diasComLancSem > 0 ? val / diasComLancSem : 0);
      });

      // Weekly accumulation tag
      expressao = expressao.replace(/ACUM_SEM\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresSem[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 2. Standard accumulation tags
      expressao = expressao.replace(/ACUM_MES\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresMes[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      expressao = expressao.replace(/ACUM_ANO\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valoresAno[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 3. Simple [visualId] references LAST
      expressao = expressao.replace(/\[([^\]]+)\]/g, (_, visualId) => {
        const idInterno = reverseVisualIdMap[visualId.trim()] || visualId.trim();
        const val = valores[idInterno];
        return val !== undefined ? String(val) : '0';
      });

      // 4. Pre-process math functions into Math.* equivalents
      // IF(cond, vTrue, vFalse) → (cond ? vTrue : vFalse)
      expressao = expressao.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, vTrue, vFalse) => {
        return `(${cond.trim()}?${vTrue.trim()}:${vFalse.trim()})`;
      });
      // MIN(a, b)
      expressao = expressao.replace(/MIN\(([^,]+),([^)]+)\)/gi, (_, a, b) => {
        return `Math.min(${a.trim()},${b.trim()})`;
      });
      // MAX(a, b)
      expressao = expressao.replace(/MAX\(([^,]+),([^)]+)\)/gi, (_, a, b) => {
        return `Math.max(${a.trim()},${b.trim()})`;
      });
      // ABS(a)
      expressao = expressao.replace(/ABS\(([^)]+)\)/gi, (_, a) => {
        return `Math.abs(${a.trim()})`;
      });
      // ROUND(a, casas)
      expressao = expressao.replace(/ROUND\(([^,]+),([^)]+)\)/gi, (_, a, casas) => {
        return `Math.round(${a.trim()}*Math.pow(10,${casas.trim()}))/Math.pow(10,${casas.trim()})`;
      });

      // Remove whitespace
      expressao = expressao.replace(/\s/g, '');

      // Validate: allow digits, operators, parentheses, decimal point, comparison operators, and Math.* calls
      if (!/^[\d+\-*/().,><=!?:]+$/.test(expressao.replace(/\bMath\.(min|max|abs|round|pow)\b/g, '0'))) {
        return 0;
      }

      // Blocklist: reject any dangerous identifiers after transformations
      const blocklist = ['eval','fetch','window','document','process','require','import','export','function','return','var','let','const','new','this','prototype','__proto__','constructor','globalThis'];
      if (blocklist.some(word => new RegExp(`\\b${word}\\b`).test(expressao))) {
        return 0;
      }

      // Evaluate using Function with Math in scope
      // eslint-disable-next-line no-new-func
      const resultado = new Function('Math', `return (${expressao})`)(Math);

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
    const genericDataMes = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, currentMonthStart, selectedDateObj)]));
    const genericDataAno = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, currentYearStart, selectedDateObj)]));
    const genericDataSem = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, weekStart, selectedDateObj)]));

    // Previous day accumulation (selectedDate - 1)
    const yesterday = new Date(selectedDateObj);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const genericDataMesAnt = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, currentMonthStart, yesterday)]));
    const genericDataAnoAnt = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, currentYearStart, yesterday)]));

    // Previous-week accumulation (Mon–Sun of the week before the current one).
    // Initialized here so it is available as a closure inside makeEvaluator.
    const prevWeekStartInit = new Date(weekStart);
    prevWeekStartInit.setDate(prevWeekStartInit.getDate() - 7);
    const prevWeekEndInit = new Date(weekEnd);
    prevWeekEndInit.setDate(prevWeekEndInit.getDate() - 7);
    const genericDataSemAnt = Object.fromEntries(indicadores.map(i => [i.id, getSomaPeriodo(u.id, i.id, prevWeekStartInit, prevWeekEndInit)]));

    // These day-count variables are used by MEDIA_* tags inside makeEvaluator (closure access).
    // They are assigned their real values after daysInMonth/Year/Week are computed below.
    let diasComLancMes = 1;
    let diasComLancAno = 1;
    let diasComLancSem = 1;

    // Process calculated indicators with formulas in dependency order (topological sort)
    const formulaIndicadores = indicadores.filter(ind => !ind.digitavel && ind.formula);
    const formulaIndMap = new Map(formulaIndicadores.map(i => [i.id, i]));
    const getDeps = (formula: string): string[] => {
      const deps: string[] = [];
      // Longer prefixes listed before shorter ones to avoid partial matches.
      // The prefix is optional so plain [id] references are also captured.
      const regex = /(?:ACUM_MES_ANT|ACUM_ANO_ANT|ACUM_SEM_ANT|ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM)?\[([^\]\s]+)\]/g;
      let match;
      while ((match = regex.exec(formula)) !== null) {
        const rawId = match[1].trim();
        const idInterno = reverseVisualIdMap[rawId] || rawId;
        deps.push(idInterno);
      }
      return deps;
    };

    // Reusable topological evaluator: resolves each indicator's formula into the given target context.
    // When onlyAccum is true, indicators without ACUM_* tags are skipped (their values were already
    // correctly set by recalcularSomasPeriodo and must not be overwritten).
    const makeEvaluator = (
      target: Record<string, number>,
      valores: Record<string, number>,
      valoresMes: Record<string, number>,
      valoresAno: Record<string, number>,
      valoresSem: Record<string, number> = {},
      onlyAccum = false,
      valoresSemAnt: Record<string, number> = {},
    ) => {
      const visited = new Set<string>();
      const evaluate = (ind: typeof formulaIndicadores[number], stack: Set<string> = new Set()): void => {
        if (visited.has(ind.id)) return;
        if (stack.has(ind.id)) return; // circular reference guard
        const usesAccum = /ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM/.test(ind.formula!);
        if (onlyAccum && !usesAccum) {
          // Already correctly set by recalcularSomasPeriodo; mark visited and keep the value.
          visited.add(ind.id);
          return;
        }
        stack.add(ind.id);
        const deps = getDeps(ind.formula!);
        for (const depId of deps) {
          const depInd = formulaIndMap.get(depId);
          if (depInd) evaluate(depInd, stack);
        }
        target[ind.id] = avaliarFormula(ind.formula!, valores, valoresMes, valoresAno, genericDataMesAnt, genericDataAnoAnt, valoresSem, valoresSemAnt, diasComLancMes, diasComLancAno, diasComLancSem);
        visited.add(ind.id);
        stack.delete(ind.id);
      };
      return evaluate;
    };

    // Evaluates a single calculated indicator for one specific day, resolving its formula
    // dependencies recursively (topological order) before evaluating. Raw (digitavel) values
    // for the day should already be present in valoresDia before calling this.
    const avaliarIndicadorDia = (
      ind: typeof formulaIndicadores[number],
      valoresDia: Record<string, number>,
      visitedDay: Set<string>,
    ): number => {
      if (visitedDay.has(ind.id)) return valoresDia[ind.id] ?? 0;
      visitedDay.add(ind.id);
      const deps = getDeps(ind.formula!);
      for (const depId of deps) {
        const depInd = formulaIndMap.get(depId);
        if (depInd) avaliarIndicadorDia(depInd, valoresDia, visitedDay);
      }
      valoresDia[ind.id] = avaliarFormula(ind.formula!, valoresDia, {}, {}, {}, {}, {});
      return valoresDia[ind.id];
    };

    // Computes the correct accumulated value for a calculated indicator by summing its formula
    // result day-by-day over the given period. This ensures that ACUM_MES[r7] where r7=[r5]*[r6]
    // stores Σ(r5_day * r6_day) in the accumulation context instead of sum_r5 * sum_r6.
    const calcularSomaDiaria = (
      ind: typeof formulaIndicadores[number],
      days: string[],
      visitedCalc: Set<string>,
      target: Record<string, number>,
    ): void => {
      if (visitedCalc.has(ind.id)) return;
      // Resolve period-sum dependencies first (topological order)
      const deps = getDeps(ind.formula!);
      for (const depId of deps) {
        const depInd = formulaIndMap.get(depId);
        if (depInd && !visitedCalc.has(depInd.id)) {
          calcularSomaDiaria(depInd, days, visitedCalc, target);
        }
      }
      visitedCalc.add(ind.id);
      // Sum the formula result for each day in the period
      target[ind.id] = days.reduce((acc, d) => {
        const valoresDia: Record<string, number> = {};
        indicadores.forEach(i => { valoresDia[i.id] = getValor(u.id, i.id, d); });
        // Recursively resolve any calculated dependencies for this specific day
        const visitedDay = new Set<string>();
        for (const depId of deps) {
          const depInd = formulaIndMap.get(depId);
          if (depInd) avaliarIndicadorDia(depInd, valoresDia, visitedDay);
        }
        return acc + avaliarFormula(ind.formula!, valoresDia, {}, {}, {}, {}, {});
      }, 0);
    };

    // For each accumulation context, replace the initial getSomaPeriodo value (which is 0 for
    // calculated indicators) with the correct per-day sum for indicators whose formulas do not
    // themselves contain ACUM_* or MEDIA_* tags. Indicators with those tags are handled separately by
    // makeEvaluator (onlyAccum=true) so they can read the corrected values from valoresMes/valoresAno.
    const recalcularSomasPeriodo = (
      target: Record<string, number>,
      days: string[],
    ): void => {
      const visitedCalc = new Set<string>();
      for (const ind of formulaIndicadores) {
        const usesAccum = /ACUM_MES|ACUM_ANO|ACUM_SEM|MEDIA_MES|MEDIA_ANO|MEDIA_SEM/.test(ind.formula!);
        if (!usesAccum) {
          calcularSomaDiaria(ind, days, visitedCalc, target);
        }
      }
    };

    // Collect unique days with lancamentos for each accumulation period
    const daysInMonth = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= currentMonthStart && parseISO(l.data) <= selectedDateObj)
        .map(l => l.data)
    )];
    const daysInYear = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= currentYearStart && parseISO(l.data) <= selectedDateObj)
        .map(l => l.data)
    )];
    const daysInWeek = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= weekStart && parseISO(l.data) <= selectedDateObj)
        .map(l => l.data)
    )];
    const daysInMonthAnt = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= currentMonthStart && parseISO(l.data) <= yesterday)
        .map(l => l.data)
    )];
    const daysInYearAnt = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= currentYearStart && parseISO(l.data) <= yesterday)
        .map(l => l.data)
    )];

    // Previous week range (same start/end used for genericDataSemAnt above)
    const daysInWeekAnt = [...new Set(
      lancamentos
        .filter(l => l.unidade_id === u.id && parseISO(l.data) >= prevWeekStartInit && parseISO(l.data) <= prevWeekEndInit)
        .map(l => l.data)
    )];

    // Number of distinct days with data for each period; assigned to the let variables declared
    // earlier so makeEvaluator closures pick up the real values before the evaluators run.
    // Using || 1 is safe because ACUM_MES/ANO/SEM for an indicator also equals 0 when there
    // are no days with data, so MEDIA_* would correctly return 0/1 = 0 in that case.
    diasComLancMes = daysInMonth.length || 1;
    diasComLancAno = daysInYear.length || 1;
    diasComLancSem = daysInWeek.length || 1;

    // Pre-compute per-day sums for all accumulation contexts BEFORE evaluating the day context.
    // This ensures that when the day evaluator processes an indicator like ACUM_MES[r7]
    // (where r7 is itself a calculated indicator), it can read the correct monthly sum
    // for r7 from genericDataMes rather than the initial getSomaPeriodo value of 0.
    recalcularSomasPeriodo(genericDataMes, daysInMonth);
    recalcularSomasPeriodo(genericDataAno, daysInYear);
    recalcularSomasPeriodo(genericDataSem, daysInWeek);
    recalcularSomasPeriodo(genericDataMesAnt, daysInMonthAnt);
    recalcularSomasPeriodo(genericDataAnoAnt, daysInYearAnt);
    recalcularSomasPeriodo(genericDataSemAnt, daysInWeekAnt);

    // Resolve formulas for the current day context.
    // genericDataMes/Ano/Sem are already populated with correct per-day sums above,
    // so ACUM_* references in day-context formulas resolve to the right values.
    const evaluate = makeEvaluator(genericData, genericData, genericDataMes, genericDataAno, genericDataSem, false, genericDataSemAnt);
    for (const ind of formulaIndicadores) evaluate(ind);

    // For each accumulation context, evaluate indicators that use ACUM_* or MEDIA_* tags.
    // recalcularSomasPeriodo already set correct values for non-ACUM indicators;
    // makeEvaluator(onlyAccum=true) skips those and only evaluates ACUM_*/MEDIA_* indicators.
    const evaluateMes = makeEvaluator(genericDataMes, genericDataMes, genericDataMes, genericDataAno, genericDataSem, true, genericDataSemAnt);
    for (const ind of formulaIndicadores) evaluateMes(ind);

    const evaluateAno = makeEvaluator(genericDataAno, genericDataAno, genericDataMes, genericDataAno, genericDataSem, true, genericDataSemAnt);
    for (const ind of formulaIndicadores) evaluateAno(ind);

    const evaluateSem = makeEvaluator(genericDataSem, genericDataSem, genericDataMes, genericDataAno, genericDataSem, true, genericDataSemAnt);
    for (const ind of formulaIndicadores) evaluateSem(ind);

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
            {[...categorias].filter(cat => cat.visivel_capa !== false).sort((a, b) => a.ordem - b.ordem).map(cat => {
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

  const { visualIdMap } = useMemo(
    () => gerarIdsVisuais(indicadores, categorias),
    [indicadores, categorias]
  );

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
  const [activeTab, setActiveTab] = useState<'indicadores' | 'categorias' | 'metas' | 'config-unidades' | 'dias-uteis' | 'guia'>('categorias');
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [localNomes, setLocalNomes] = useState<Record<string, string>>({});
  const [localVisiveis, setLocalVisiveis] = useState<Record<string, boolean>>({});
  const [savingConfigs, setSavingConfigs] = useState<Record<string, boolean>>({});
  const [deletingConfigs, setDeletingConfigs] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'unidade' | 'indicador' | 'categoria' | 'meta' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDigitavel, setIsDigitavel] = useState(true);

  useEffect(() => {
    if (!selectedUnidade) return;
    const nomesInit: Record<string, string> = {};
    const visiveisInit: Record<string, boolean> = {};
    indicadores.forEach(i => {
      const config = configs.find(c => c.unidade_id === selectedUnidade && c.indicador_id === i.id);
      nomesInit[i.id] = config?.nome_personalizado || '';
      visiveisInit[i.id] = config?.visivel ?? true;
    });
    setLocalNomes(nomesInit);
    setLocalVisiveis(visiveisInit);
  }, [selectedUnidade, configs, indicadores]);

  const { visualIdMap } = useMemo(
    () => gerarIdsVisuais(indicadores, categorias),
    [indicadores, categorias]
  );

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
                  {editingItem && (
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <p className="text-xs text-indigo-600 font-mono font-bold">
                        ID para fórmulas: {visualIdMap[editingItem.id] || editingItem.id}
                      </p>
                    </div>
                  )}
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
                        placeholder="Ex: [f1] / [f2]"
                      />
                      <p className="text-xs text-slate-400">
                        💡 Use [id] para o valor do dia, ACUM_MES[id] para mês, ACUM_SEM[id] para semana, ACUM_ANO[id] para ano. Funções: IF(cond, a, b), MIN(a,b), MAX(a,b), ABS(a), ROUND(a,n). Exemplos: [r1]*[r2] | ACUM_MES[r3] | IF([r1]&gt;0,[r1]*[r2],0)
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
                      <th className="px-4 py-3 font-semibold text-slate-700">Mostrar na Capa</th>
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
                              value={localNomes[i.id] ?? ''}
                              onChange={(e) => setLocalNomes(prev => ({ ...prev, [i.id]: e.target.value }))}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              checked={localVisiveis[i.id] ?? true}
                              onChange={(e) => setLocalVisiveis(prev => ({ ...prev, [i.id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={savingConfigs[i.id]}
                              onClick={async () => {
                                setSavingConfigs(prev => ({ ...prev, [i.id]: true }));
                                try {
                                  await onSaveConfig({ unidade_id: selectedUnidade, indicador_id: i.id, nome_personalizado: localNomes[i.id] ?? '', visivel: localVisiveis[i.id] ?? true });
                                } finally {
                                  setSavingConfigs(prev => ({ ...prev, [i.id]: false }));
                                }
                              }}
                              title="Salvar"
                            >
                              {savingConfigs[i.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingConfigs[i.id]}
                              onClick={async () => {
                                setDeletingConfigs(prev => ({ ...prev, [i.id]: true }));
                                try {
                                  await onDeleteConfig(selectedUnidade, i.id);
                                } finally {
                                  setDeletingConfigs(prev => ({ ...prev, [i.id]: false }));
                                }
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Excluir Personalização"
                            >
                              {deletingConfigs[i.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
        {activeTab === 'guia' && (
          <MotionDiv key="guia" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">📐 Guia Completo de Cálculos</h3>
                  <p className="text-sm text-slate-500">Aprenda a criar fórmulas simples e complexas, encadear indicadores e usar funções avançadas.</p>
                </div>
              </div>

              <div className="space-y-8 text-sm text-slate-600">

                {/* Seção 1 — Referência de IDs */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    🔑 Como referenciar um indicador
                  </h4>
                  <p>Use os <strong>IDs visuais</strong> dos indicadores entre colchetes para criar cálculos. O ID de cada indicador é exibido na aba <strong>Indicadores</strong> e abaixo do nome de cada campo na tabela de configuração.</p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-indigo-600 text-xs space-y-1">
                    <div>[r1] → valor do dia do indicador r1</div>
                    <div>ACUM_MES[r1] → acumulado do mês do indicador r1</div>
                  </div>
                  <p className="text-xs text-slate-500 italic">Os IDs visuais (r1, f1, c1…) são atribuídos automaticamente na ordem de criação de cada indicador.</p>
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
                          <th className="px-3 py-2 font-semibold text-indigo-800">Funciona com Calculado?</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50 bg-white">
                        <tr><td className="px-3 py-2 font-mono text-indigo-600">[id]</td><td className="px-3 py-2">Dia selecionado</td><td className="px-3 py-2 font-mono text-slate-600">[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-indigo-600">ACUM_SEM[id]</td><td className="px-3 py-2">Semana (seg → dia)</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_SEM[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr><td className="px-3 py-2 font-mono text-indigo-600">ACUM_MES[id]</td><td className="px-3 py-2">Mês (01 → dia)</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_MES[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-indigo-600">ACUM_ANO[id]</td><td className="px-3 py-2">Ano (01/Jan → dia)</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_ANO[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr><td className="px-3 py-2 font-mono text-indigo-600">ACUM_MES_ANT[id]</td><td className="px-3 py-2">Mês até ontem</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_MES_ANT[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-indigo-600">ACUM_ANO_ANT[id]</td><td className="px-3 py-2">Ano até ontem</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_ANO_ANT[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr><td className="px-3 py-2 font-mono text-indigo-600">ACUM_SEM_ANT[id]</td><td className="px-3 py-2">Semana anterior (seg–dom)</td><td className="px-3 py-2 font-mono text-slate-600">ACUM_SEM_ANT[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-indigo-600">MEDIA_SEM[id]</td><td className="px-3 py-2">Média diária da semana</td><td className="px-3 py-2 font-mono text-slate-600">MEDIA_SEM[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr><td className="px-3 py-2 font-mono text-indigo-600">MEDIA_MES[id]</td><td className="px-3 py-2">Média diária do mês</td><td className="px-3 py-2 font-mono text-slate-600">MEDIA_MES[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-indigo-600">MEDIA_ANO[id]</td><td className="px-3 py-2">Média diária do ano</td><td className="px-3 py-2 font-mono text-slate-600">MEDIA_ANO[r1]</td><td className="px-3 py-2 text-emerald-600 font-bold">✅</td></tr>
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
                        <tr><td className="px-3 py-2 font-semibold">Mínimo</td><td className="px-3 py-2 font-mono text-emerald-700">MIN(a, b)</td><td className="px-3 py-2 font-mono text-slate-600">MIN([r1], 100)</td><td className="px-3 py-2 text-slate-500">Menor entre r1 e 100</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-semibold">Máximo</td><td className="px-3 py-2 font-mono text-emerald-700">MAX(a, b)</td><td className="px-3 py-2 font-mono text-slate-600">MAX([r1]-[r2], 0)</td><td className="px-3 py-2 text-slate-500">r1-r2 ou 0 se negativo</td></tr>
                        <tr><td className="px-3 py-2 font-semibold">Valor Absoluto</td><td className="px-3 py-2 font-mono text-emerald-700">ABS(a)</td><td className="px-3 py-2 font-mono text-slate-600">ABS([r1]-[r2])</td><td className="px-3 py-2 text-slate-500">Diferença sem sinal</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-semibold">Arredondamento</td><td className="px-3 py-2 font-mono text-emerald-700">ROUND(a, casas)</td><td className="px-3 py-2 font-mono text-slate-600">ROUND([r1]/[r2], 2)</td><td className="px-3 py-2 text-slate-500">Arredonda para 2 casas</td></tr>
                        <tr><td className="px-3 py-2 font-semibold">Condicional</td><td className="px-3 py-2 font-mono text-emerald-700">IF(cond, v_sim, v_nao)</td><td className="px-3 py-2 font-mono text-slate-600">IF([r1]&gt;0, [r1]*[r2], 0)</td><td className="px-3 py-2 text-slate-500">Se r1 &gt; 0, multiplica, senão 0</td></tr>
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
                    <p className="font-bold text-xs text-slate-700">Nível 1 — Fórmulas simples (operações entre campos digitáveis):</p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>Ticket Médio Dia: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [f1] / [f2]</div>
                      <div>Receita Diária: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [r1] * [r2]</div>
                      <div>Variação: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [f1] - [f2]</div>
                      <div>Percentual: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ([f1] / [f2]) * 100</div>
                    </div>
                  </div>

                  {/* Nível 2 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">Nível 2 — Usando acumulados diretos:</p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>Acumulado Faturamento Mês: &nbsp;&nbsp;&nbsp; ACUM_MES[f1]</div>
                      <div>Acumulado Tons Ano: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ACUM_ANO[r1]</div>
                      <div>Acumulado Semana: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ACUM_SEM[r1]</div>
                      <div>Semana Anterior: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ACUM_SEM_ANT[r1]</div>
                      <div>Ticket Médio Acumulado Mês: &nbsp;&nbsp; ACUM_MES[f1] / ACUM_MES[f2]</div>
                      <div>Média Diária do Mês: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; MEDIA_MES[r1]</div>
                      <div>Média Diária da Semana: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; MEDIA_SEM[r1]</div>
                    </div>
                  </div>

                  {/* Nível 3 */}
                  <div className="space-y-3">
                    <p className="font-bold text-xs text-slate-700">Nível 3 — Encadeamento: calculado baseado em calculado (o caso do usuário):</p>
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
                          <tr><td className="px-3 py-2 font-bold text-slate-500">1</td><td className="px-3 py-2 font-mono text-indigo-600">r1</td><td className="px-3 py-2">Quantidade</td><td className="px-3 py-2 text-slate-500">Digitável</td><td className="px-3 py-2 text-slate-400 italic">—</td></tr>
                          <tr className="bg-slate-50/50"><td className="px-3 py-2 font-bold text-slate-500">2</td><td className="px-3 py-2 font-mono text-indigo-600">r2</td><td className="px-3 py-2">Rentabilidade %</td><td className="px-3 py-2 text-slate-500">Digitável</td><td className="px-3 py-2 text-slate-400 italic">—</td></tr>
                          <tr className="bg-indigo-50/40"><td className="px-3 py-2 font-bold text-indigo-600">3</td><td className="px-3 py-2 font-mono text-indigo-600">r3</td><td className="px-3 py-2 font-semibold">Qtd × Rent (dia)</td><td className="px-3 py-2 font-semibold text-indigo-600">Calculado</td><td className="px-3 py-2 font-mono text-indigo-600">[r1] * [r2]</td></tr>
                          <tr className="bg-emerald-50/40"><td className="px-3 py-2 font-bold text-emerald-600">4</td><td className="px-3 py-2 font-mono text-emerald-600">r4</td><td className="px-3 py-2 font-semibold">Soma Qtd × Rent Mês</td><td className="px-3 py-2 font-semibold text-emerald-600">Calculado</td><td className="px-3 py-2 font-mono text-emerald-600">ACUM_MES[r3] ✅</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div>Dia 01/Mar: r1=100, r2=2.5 → r3=250</div>
                      <div>Dia 02/Mar: r1=150, r2=3.0 → r3=450</div>
                      <div>Dia 03/Mar: r1=200, r2=2.8 → r3=560</div>
                      <div className="border-t border-slate-300 pt-1 mt-1 text-slate-400">────────────────────────────────────────</div>
                      <div className="text-emerald-700 font-bold">ACUM_MES[r3] em 03/Mar = 250 + 450 + 560 = 1.260 ✅</div>
                    </div>
                  </div>

                  {/* Nível 4 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">Nível 4 — Funções condicionais e avançadas:</p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div className="text-slate-400">// Só multiplica se quantidade &gt; 0:</div>
                      <div>IF([r1]&gt;0, [r1]*[r2], 0)</div>
                      <div className="pt-1 text-slate-400">// Diferença positiva (sem negativo):</div>
                      <div>MAX([f1]-[meta1], 0)</div>
                      <div className="pt-1 text-slate-400">// Desvio absoluto da meta:</div>
                      <div>ABS([f1]-[meta1])</div>
                      <div className="pt-1 text-slate-400">// Ticket Médio arredondado 2 casas:</div>
                      <div>ROUND(ACUM_MES[f1] / ACUM_MES[f2], 2)</div>
                      <div className="pt-1 text-slate-400">// Encadeamento IF + calculado:</div>
                      <div>r3 = IF([r1]&gt;0, [r1]*[r2], 0)</div>
                      <div>r4 = ACUM_MES[r3] ← soma apenas os dias com quantidade positiva</div>
                    </div>
                  </div>

                  {/* Nível 5 */}
                  <div className="space-y-2">
                    <p className="font-bold text-xs text-slate-700">Nível 5 — Fórmulas compostas (múltiplas junções):</p>
                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-700 space-y-1">
                      <div className="text-slate-400">// Receita Líquida Mês:</div>
                      <div>ACUM_MES[f1] - ACUM_MES[f2] - ACUM_MES[f3]</div>
                      <div className="pt-1 text-slate-400">// Margem de Contribuição %:</div>
                      <div>(ACUM_MES[r3] / ACUM_MES[f1]) * 100</div>
                      <div className="pt-1 text-slate-400">// Crescimento vs Mês Anterior:</div>
                      <div>IF(ACUM_MES_ANT[f1]&gt;0, ([f1]/ACUM_MES_ANT[f1])*100, 0)</div>
                      <div className="pt-1 text-slate-400">// Peso médio com limite mínimo:</div>
                      <div>MAX(ACUM_MES[r1] / ACUM_MES[r2], 0)</div>
                      <div className="pt-1 text-slate-400">// Média ponderada semanal (qtd × rent / qtd):</div>
                      <div>IF(ACUM_SEM[r6]&gt;0, ACUM_SEM[r7]/ACUM_SEM[r6], 0)</div>
                      <div className="pt-1 text-slate-400">// Comparação semana atual vs anterior:</div>
                      <div>ACUM_SEM[r1] - ACUM_SEM_ANT[r1]</div>
                      <div className="pt-1 text-slate-400">// Operação mista com constante:</div>
                      <div>ACUM_MES[r3] * 100 / ACUM_MES[r1]</div>
                    </div>
                  </div>

                  {/* Nível 6 — Encadeamento triplo */}
                  <div className="space-y-3">
                    <p className="font-bold text-xs text-slate-700">Nível 6 — Encadeamento triplo (calculado → acumulado → média ponderada):</p>
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
                          <tr><td className="px-3 py-2 font-bold text-slate-500">1</td><td className="px-3 py-2 font-mono text-indigo-600">r5</td><td className="px-3 py-2">Quantidade</td><td className="px-3 py-2 text-slate-500">Digitável</td><td className="px-3 py-2 text-slate-400 italic">—</td></tr>
                          <tr className="bg-slate-50/50"><td className="px-3 py-2 font-bold text-slate-500">2</td><td className="px-3 py-2 font-mono text-indigo-600">r6</td><td className="px-3 py-2">Rentabilidade %</td><td className="px-3 py-2 text-slate-500">Digitável</td><td className="px-3 py-2 text-slate-400 italic">—</td></tr>
                          <tr className="bg-indigo-50/40"><td className="px-3 py-2 font-bold text-indigo-600">3</td><td className="px-3 py-2 font-mono text-indigo-600">r7</td><td className="px-3 py-2 font-semibold">Qtd × Rent (dia)</td><td className="px-3 py-2 font-semibold text-indigo-600">Calculado</td><td className="px-3 py-2 font-mono text-indigo-600">[r5] * [r6]</td></tr>
                          <tr className="bg-emerald-50/40"><td className="px-3 py-2 font-bold text-emerald-600">4</td><td className="px-3 py-2 font-mono text-emerald-600">r8</td><td className="px-3 py-2 font-semibold">Média ponderada Sem</td><td className="px-3 py-2 font-semibold text-emerald-600">Calculado</td><td className="px-3 py-2 font-mono text-emerald-600">IF(ACUM_SEM[r5]&gt;0, ACUM_SEM[r7]/ACUM_SEM[r5], 0) ✅</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Seção 5 — O que NÃO funciona */}
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 space-y-4">
                  <h4 className="font-bold text-red-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    ❌ O que NÃO funciona (armadilhas comuns)
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
                        <tr><td className="px-3 py-2 font-mono text-red-600">[r1] * ACUM_MES[r2]</td><td className="px-3 py-2 text-slate-600">Mistura dia com mês</td><td className="px-3 py-2 font-mono text-emerald-700">ACUM_MES[r3] onde r3=[r1]*[r2]</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-red-600">ACUM_MES[r1] * ACUM_MES[r2]</td><td className="px-3 py-2 text-slate-600">Produto dos totais ≠ soma dos produtos</td><td className="px-3 py-2 font-mono text-emerald-700">ACUM_MES[r3] (indicador intermediário)</td></tr>
                        <tr><td className="px-3 py-2 font-mono text-red-600">IF([r1], [r2], 0)</td><td className="px-3 py-2 text-slate-600">Condição ambígua (sem operador)</td><td className="px-3 py-2 font-mono text-emerald-700">IF([r1]&gt;0, [r2], 0)</td></tr>
                        <tr className="bg-slate-50/50"><td className="px-3 py-2 font-mono text-red-600">r3=[r4], r4=[r3]</td><td className="px-3 py-2 text-slate-600">Referência circular — loop infinito</td><td className="px-3 py-2 text-slate-600">Garantir que deps só apontam para indicadores anteriores</td></tr>
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
                    Você <strong>não</strong> precisa criar uma fórmula diferente para cada período. O sistema é inteligente: ele aplica a mesma fórmula lógica sobre os dados já agrupados por Dia, Mês ou Ano conforme sua escolha no Dashboard principal.
                  </p>
                  <p className="mt-3 text-sm text-amber-800">
                    Use indicadores intermediários calculados como <strong>"pontes"</strong> para construir cálculos complexos. Quanto mais modular a estrutura, mais fácil é manter.
                  </p>
                </div>
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
