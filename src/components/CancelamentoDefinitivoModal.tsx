import React, { useState } from 'react';
import { PedidoVenda } from '../types';
import { X, Ban, AlertTriangle } from 'lucide-react';
import { executarCancelamentoDefinitivo } from '../services/pedidosVendaService';
import { useToast } from './Toast';

interface CancelamentoDefinitivoModalProps {
  pedido: PedidoVenda;
  currentUser: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

function fmtQtd(n?: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' ton';
}

export default function CancelamentoDefinitivoModal({
  pedido,
  currentUser,
  onClose,
  onSuccess,
}: CancelamentoDefinitivoModalProps) {
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [tipoCancelamento, setTipoCancelamento] = useState<'total' | 'parcial'>('total');
  const [quantidade, setQuantidade] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  const saldo =
    pedido.saldo_disponivel ??
    (pedido.quantidade_original ?? pedido.quantidade_real ?? 0) -
      (pedido.quantidade_desmembrada ?? 0) -
      (pedido.quantidade_cancelada_definitiva ?? 0);

  const numeroPedido =
    pedido.barra_pedido ||
    (pedido.numero_pedido ? `${pedido.numero_pedido}/${pedido.emitente ?? 1}` : '—');

  const handleSave = async () => {
    if (!motivo.trim()) {
      showError('Informe o motivo do cancelamento.');
      return;
    }

    let qtd: number | undefined = undefined;
    if (tipoCancelamento === 'parcial') {
      qtd = parseFloat(quantidade.replace(',', '.'));
      if (!quantidade || isNaN(qtd) || qtd <= 0) {
        showError('Informe uma quantidade válida para cancelamento parcial.');
        return;
      }
      if (qtd > saldo) {
        showError('Quantidade a cancelar maior que o saldo disponível.');
        return;
      }
    }

    setSaving(true);
    try {
      await executarCancelamentoDefinitivo({
        pedido,
        quantidade: tipoCancelamento === 'parcial' ? qtd : undefined,
        motivo: motivo.trim(),
        usuarioId: currentUser.id,
        usuarioNome: currentUser.name,
      });
      showSuccess(
        tipoCancelamento === 'total'
          ? 'Pedido cancelado definitivamente!'
          : 'Cancelamento parcial registrado!'
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Erro ao cancelar pedido.';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-red-600 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Ban className="w-5 h-5" />
            Cancelamento Definitivo
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Pedido info */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">
              Pedido a Cancelar
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Nº / Emitente</p>
                <p className="font-mono font-bold text-stone-800">{numeroPedido}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Cliente</p>
                <p className="text-stone-700 truncate">{pedido.cliente_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">Produto</p>
                <p className="text-stone-700 truncate">{pedido.produto_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase mb-0.5">
                  Saldo Disponível
                </p>
                <p
                  className={`font-mono font-bold ${saldo > 0 ? 'text-emerald-700' : 'text-red-600'}`}
                >
                  {fmtQtd(saldo)}
                </p>
              </div>
            </div>
          </div>

          {saldo <= 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Saldo zerado. O pedido já está cancelado ou sem saldo.</span>
            </div>
          )}

          {/* Tipo de cancelamento */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              Tipo de Cancelamento
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo_cancelamento"
                  value="total"
                  checked={tipoCancelamento === 'total'}
                  onChange={() => setTipoCancelamento('total')}
                  className="accent-red-600"
                />
                <span className="text-sm font-medium text-stone-700">Total</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo_cancelamento"
                  value="parcial"
                  checked={tipoCancelamento === 'parcial'}
                  onChange={() => setTipoCancelamento('parcial')}
                  className="accent-red-600"
                />
                <span className="text-sm font-medium text-stone-700">Parcial</span>
              </label>
            </div>
          </div>

          {tipoCancelamento === 'total' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ O saldo disponível ({fmtQtd(saldo)}) será zerado e o status do pedido será marcado
              como <strong>Cancelado</strong>.
            </div>
          )}

          {tipoCancelamento === 'parcial' && (
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                Quantidade a Cancelar (ton) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                max={saldo}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0.000"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
              />
              {quantidade && parseFloat(quantidade) > saldo && (
                <p className="text-xs text-red-500 mt-1">
                  Máx: {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} ton
                </p>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo do cancelamento..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saldo <= 0}
            className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Confirmar Cancelamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
