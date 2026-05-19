import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ExecucaoCarregamento } from '../../types/carregamento';
import { concluirExecucao } from '../../services/execucaoCarregamentoService';

interface ModalConcluirExecucaoProps {
  execucao: ExecucaoCarregamento;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ModalConcluirExecucao({
  execucao,
  onClose,
  onUpdated,
}: ModalConcluirExecucaoProps) {
  const [quantidadeCarregada, setQuantidadeCarregada] = useState(
    String(execucao.quantidade_agendada)
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantidade = Number(quantidadeCarregada || 0);
    if (quantidade <= 0 || quantidade > execucao.quantidade_agendada) return;
    setSaving(true);
    try {
      await concluirExecucao(execucao.id, quantidade);
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
          <h3 className="font-bold text-stone-800">Concluir Execução</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-stone-500">
            Se for menor que agendada, a diferença volta para o saldo da solicitação.
          </p>
          <input
            type="number"
            min={0.001}
            max={execucao.quantidade_agendada}
            step={0.001}
            value={quantidadeCarregada}
            onChange={(e) => setQuantidadeCarregada(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
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
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg disabled:bg-emerald-300"
          >
            {saving ? 'Salvando...' : 'Concluir'}
          </button>
        </div>
      </form>
    </div>
  );
}
