import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Carregamento } from '../../types/carregamento';
import { updateCarregamento } from '../../services/carregamentoService';

interface ModalCancelarSaldoSolicitacaoProps {
  carregamento: Carregamento;
  saldoAtual: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ModalCancelarSaldoSolicitacao({
  carregamento,
  saldoAtual,
  onClose,
  onUpdated,
}: ModalCancelarSaldoSolicitacaoProps) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return;
    setSaving(true);
    try {
      await updateCarregamento(carregamento.id, {
        quantidade_cancelada: Number((carregamento.quantidade_cancelada ?? 0) + saldoAtual),
        motivo_cancelamento_saldo: motivo.trim(),
      });
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-xl shadow-xl">
        <div className="p-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="font-bold text-stone-800">Cancelar Saldo Restante</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm text-stone-600">
          <p>
            Cancelar <strong>{saldoAtual.toFixed(3)} ton</strong> restantes? Esse saldo voltará para
            o pedido.
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            placeholder="Motivo (obrigatório)"
            required
          />
        </div>
        <div className="p-4 border-t border-stone-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold border border-stone-300 rounded-lg"
          >
            Fechar
          </button>
          <button
            type="submit"
            disabled={saving || !motivo.trim()}
            className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg disabled:bg-red-300"
          >
            {saving ? 'Salvando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
