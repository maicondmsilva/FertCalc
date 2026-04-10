import React from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, CheckCircle2, AlertCircle, Edit2, Trash2, GripVertical } from 'lucide-react';
import { cn } from '../../utils/managementUtils';
import type { Indicador, Categoria } from '../../types';

const MotionDiv = motion.div as any;

export const Button = ({
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

export const Card = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden',
      className
    )}
  >
    {children}
  </div>
);

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

export const Select = ({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
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

export const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) => (
  <MotionDiv
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800'
    )}
  >
    {type === 'success' ? (
      <CheckCircle2 className="w-5 h-5" />
    ) : (
      <AlertCircle className="w-5 h-5" />
    )}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70">
      <X className="w-4 h-4" />
    </button>
  </MotionDiv>
);

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </MotionDiv>
    </div>
  );
};

export const SortableIndicadorRow = ({
  indicador,
  onEdit,
  onDelete,
  visualId,
}: {
  key?: React.Key;
  indicador: Indicador;
  onEdit: (i: Indicador) => void;
  onDelete: (id: string) => void | Promise<void>;
  visualId: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: indicador.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('hover:bg-slate-50', isDragging && 'bg-slate-100 shadow-inner')}
    >
      <td className="px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-slate-900">{indicador.nome}</span>
        <span className="block text-[10px] text-indigo-500 font-mono font-bold">
          ID: {visualId}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{indicador.unidade_medida}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
            indicador.digitavel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
          )}
        >
          {indicador.digitavel ? 'Digitável' : 'Calculado'}
        </span>
      </td>
      <td className="px-4 py-3 text-right flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(indicador)}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(indicador.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
};

export const SortableCategoryRow = ({
  categoria,
  onEdit,
  onDelete,
  onToggleVisibilidadeCapa,
}: {
  key?: React.Key;
  categoria: Categoria;
  onEdit: (c: Categoria) => void;
  onDelete: (id: string) => void | Promise<void>;
  onToggleVisibilidadeCapa: (c: Categoria) => void | Promise<void>;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: categoria.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const visivelCapa = categoria.visivel_capa ?? true;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('hover:bg-slate-50', isDragging && 'bg-slate-100 shadow-inner')}
    >
      <td className="px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="p-1 hover:bg-slate-200 rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">
        {categoria.nome}
        <span
          className={cn(
            'ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            visivelCapa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          )}
        >
          {visivelCapa ? 'Na capa' : 'Oculta da capa'}
        </span>
      </td>
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
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
              visivelCapa ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </td>
      <td className="px-4 py-3 text-right flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(categoria)}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(categoria.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
};
