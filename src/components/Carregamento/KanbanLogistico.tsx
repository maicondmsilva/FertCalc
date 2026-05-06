import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Carregamento, StatusCarregamento } from '../../types/carregamento';
import { Calendar, MapPin, Package } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

// ── Kanban columns ────────────────────────────────────────────────────────────
type KanbanColumn = 'aguardando' | 'cotado' | 'liberado' | 'carregado';

const COLUMN_CONFIG: Record<
  KanbanColumn,
  {
    label: string;
    statuses: StatusCarregamento[];
    targetStatus: StatusCarregamento;
    color: string;
    headerColor: string;
  }
> = {
  aguardando: {
    label: 'Aguardando',
    statuses: ['aguardando_cotacao', 'cotacao_solicitada'],
    targetStatus: 'aguardando_cotacao',
    color: 'bg-stone-100 border-stone-300',
    headerColor: 'bg-stone-500 text-white',
  },
  cotado: {
    label: 'Cotado',
    statuses: ['cotacao_recebida', 'aguardando_liberacao'],
    targetStatus: 'cotacao_recebida',
    color: 'bg-amber-50 border-amber-300',
    headerColor: 'bg-amber-500 text-white',
  },
  liberado: {
    label: 'Liberado',
    statuses: ['liberado_parcial', 'liberado_total', 'em_carregamento'],
    targetStatus: 'liberado_total',
    color: 'bg-blue-50 border-blue-300',
    headerColor: 'bg-blue-600 text-white',
  },
  carregado: {
    label: 'Carregado',
    statuses: ['carregado'],
    targetStatus: 'carregado',
    color: 'bg-emerald-50 border-emerald-300',
    headerColor: 'bg-emerald-600 text-white',
  },
};

function getColumnForStatus(status: StatusCarregamento): KanbanColumn | null {
  for (const [col, cfg] of Object.entries(COLUMN_CONFIG) as [
    KanbanColumn,
    (typeof COLUMN_CONFIG)[KanbanColumn],
  ][]) {
    if (cfg.statuses.includes(status)) return col;
  }
  return null;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtNum(c: { numero?: number; numero_carregamento: string }): string {
  if (c.numero != null) {
    return `CAR-${String(c.numero).padStart(4, '0')}`;
  }
  return c.numero_carregamento || '—';
}

// ── Card ─────────────────────────────────────────────────────────────────────
function KanbanCard({
  carregamento,
  isDragging,
}: {
  carregamento: Carregamento;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: carregamento.id,
    data: { carregamento },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white rounded-lg border border-stone-200 shadow-sm p-3 select-none hover:shadow-md transition-shadow"
    >
      <p className="font-mono font-bold text-xs text-stone-700 mb-1">{fmtNum(carregamento)}</p>
      {carregamento.cliente_nome && (
        <p className="text-sm font-medium text-stone-800 truncate">{carregamento.cliente_nome}</p>
      )}
      <div className="mt-2 space-y-1">
        {carregamento.local_carregamento && (
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{carregamento.local_carregamento.nome}</span>
          </div>
        )}
        {carregamento.data_prevista_carregamento && (
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{fmtDate(carregamento.data_prevista_carregamento)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Package className="w-3 h-3 flex-shrink-0" />
          <span>{carregamento.quantidade_total.toFixed(2)} ton</span>
        </div>
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
function KanbanColumnView({
  column,
  carregamentos,
  activeId,
}: {
  column: KanbanColumn;
  carregamentos: Carregamento[];
  activeId: string | null;
}) {
  const cfg = COLUMN_CONFIG[column];
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div
      className={`flex flex-col rounded-xl border-2 ${cfg.color} min-h-[400px] ${isOver ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
    >
      <div
        className={`${cfg.headerColor} rounded-t-xl px-4 py-2 flex items-center justify-between`}
      >
        <span className="font-bold text-sm">{cfg.label}</span>
        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {carregamentos.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 overflow-y-auto">
        {carregamentos.map((c) => (
          <KanbanCard key={c.id} carregamento={c} isDragging={c.id === activeId} />
        ))}
      </div>
    </div>
  );
}

// ── Overlay Card (while dragging) ─────────────────────────────────────────────
function OverlayCard({ carregamento }: { carregamento: Carregamento }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-xl p-3 w-52 opacity-90 rotate-2">
      <p className="font-mono font-bold text-xs text-stone-700 mb-1">{fmtNum(carregamento)}</p>
      {carregamento.cliente_nome && (
        <p className="text-sm font-medium text-stone-800 truncate">{carregamento.cliente_nome}</p>
      )}
    </div>
  );
}

// ── Main Kanban Component ─────────────────────────────────────────────────────
interface KanbanLogisticoProps {
  carregamentos: Carregamento[];
  onUpdateStatus: (carregamentoId: string, newStatus: StatusCarregamento) => Promise<void>;
}

export default function KanbanLogistico({ carregamentos, onUpdateStatus }: KanbanLogisticoProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeCarregamento = activeId ? carregamentos.find((c) => c.id === activeId) : null;

  const getColumnItems = (col: KanbanColumn) =>
    carregamentos.filter((c) => {
      const colForStatus = getColumnForStatus(c.status);
      return colForStatus === col;
    });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const carregamentoId = active.id as string;
    const targetColumn = over.id as KanbanColumn;

    const c = carregamentos.find((x) => x.id === carregamentoId);
    if (!c) return;

    const fromColumn = getColumnForStatus(c.status);
    if (!fromColumn || fromColumn === targetColumn) return;

    // Ask for confirmation
    const targetLabel = COLUMN_CONFIG[targetColumn].label;
    const ok = await confirm({
      title: `Alterar status para "${targetLabel}"?`,
      message: `O carregamento ${fmtNum(c)} será movido para a coluna "${targetLabel}".`,
      variant: 'info',
      confirmLabel: 'Confirmar',
    });

    if (ok) {
      const newStatus = COLUMN_CONFIG[targetColumn].targetStatus;
      await onUpdateStatus(carregamentoId, newStatus);
    }
  };

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(COLUMN_CONFIG) as KanbanColumn[]).map((col) => (
            <KanbanColumnView
              key={col}
              column={col}
              carregamentos={getColumnItems(col)}
              activeId={activeId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCarregamento && <OverlayCard carregamento={activeCarregamento} />}
        </DragOverlay>
      </DndContext>
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
