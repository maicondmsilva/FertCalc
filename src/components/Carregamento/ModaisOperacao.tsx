import React, { useState } from 'react';
import { Truck, X } from 'lucide-react';
import { Carregamento, Transportadora } from '../../types/carregamento';
import { closeModalOnBackdrop } from '../../utils/modalUtils';
import { fmtCarregamentoNum } from './shared';

export interface ModalInformarTransportadorProps {
  carregamento: Carregamento;
  transportadoras: Transportadora[];
  onSave: (transportadoraId: string, valorFrete?: number) => Promise<void>;
  onClose: () => void;
}

export function ModalInformarTransportador({
  carregamento,
  transportadoras,
  onSave,
  onClose,
}: ModalInformarTransportadorProps) {
  const [transportadoraId, setTransportadoraId] = useState(carregamento.transportadora_id ?? '');
  const [valorFrete, setValorFrete] = useState(
    carregamento.valor_frete != null ? String(carregamento.valor_frete) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(transportadoraId, valorFrete ? parseFloat(valorFrete) : undefined);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Informar Transportador
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-sm text-stone-600">
          <span className="font-mono font-bold text-emerald-600">
            {fmtCarregamentoNum(carregamento)}
          </span>{' '}
          &mdash; {carregamento.tipo_frete} &mdash; {carregamento.quantidade_total} ton
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Transportadora *
            </label>
            <select
              value={transportadoraId}
              onChange={(e) => setTransportadoraId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            >
              <option value="">— Selecione —</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                  {t.telefone ? ` — ${t.telefone}` : ''}
                </option>
              ))}
            </select>
            {transportadoras.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhuma transportadora cadastrada. Acesse Logística → Transportadoras para
                cadastrar.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Valor do Frete (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-stone-300 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !transportadoraId}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT: Transportadora Manager
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT: Modal Cancelar Carregamento
// ─────────────────────────────────────────────────────────────────────────────

export interface DadosCancelamento {
  tipo: 'total' | 'parcial';
  quantidadeCancelada: number;
  motivo: string;
}

export function ModalCancelarCarregamento({
  carregamento,
  onConfirm,
  onClose,
}: {
  carregamento: Carregamento;
  onConfirm: (dados: DadosCancelamento) => Promise<void>;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [quantidadeCancelada, setQuantidadeCancelada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const qtdTotal = Math.max(
    0,
    carregamento.quantidade_total - (carregamento.quantidade_cancelada || 0)
  );
  const qtdCancelada = parseFloat(quantidadeCancelada) || 0;

  const handleConfirm = async () => {
    if (saving || !motivo.trim()) return;
    if (tipo === 'parcial' && (qtdCancelada <= 0 || qtdCancelada >= qtdTotal)) return;
    setSaving(true);
    await onConfirm({ tipo, quantidadeCancelada: qtdCancelada, motivo: motivo.trim() });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => closeModalOnBackdrop(event, onClose, saving)}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <X className="w-5 h-5" />
          <h3 className="font-bold text-base">
            Cancelar Carregamento{' '}
            {carregamento.numero
              ? `CAR-${String(carregamento.numero).padStart(4, '0')}`
              : carregamento.numero_carregamento}
          </h3>
        </div>

        {/* Tipo de cancelamento */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase mb-2">
            Tipo de Cancelamento
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setTipo('total')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${
                tipo === 'total'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              Total ({qtdTotal.toFixed(3)} ton)
            </button>
            <button
              type="button"
              onClick={() => setTipo('parcial')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${
                tipo === 'parcial'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              Parcial
            </button>
          </div>
        </div>

        {/* Campo de quantidade (só para parcial) */}
        {tipo === 'parcial' && (
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
              Quantidade a Cancelar (ton) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max={qtdTotal - 0.001}
              value={quantidadeCancelada}
              onChange={(e) => setQuantidadeCancelada(e.target.value)}
              placeholder={`Máx: ${(qtdTotal - 0.001).toFixed(3)} ton`}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400"
            />
            {qtdCancelada > 0 && qtdCancelada < qtdTotal && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                <p className="text-amber-700 font-bold">Impacto no Pedido de Venda:</p>
                <p className="text-amber-600 mt-0.5">
                  + {qtdCancelada.toFixed(3)} ton devolvidas ao saldo disponível
                </p>
                <p className="text-amber-600">
                  Saldo restante neste carregamento: {(qtdTotal - qtdCancelada).toFixed(3)} ton
                </p>
              </div>
            )}
          </div>
        )}

        {tipo === 'total' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">
            <strong>{qtdTotal.toFixed(3)} ton</strong> serão devolvidas ao saldo do pedido
            automaticamente.
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo do cancelamento..."
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        <p className="text-xs text-stone-400">
          ⚠️ O solicitante será notificado. Esta operação ficará registrada no histórico.
        </p>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg font-bold hover:bg-stone-200"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              saving ||
              !motivo.trim() ||
              (tipo === 'parcial' && (qtdCancelada <= 0 || qtdCancelada >= qtdTotal))
            }
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
