import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ExecucaoCarregamento } from '../../types/carregamento';
import { updateExecucaoStatus } from '../../services/execucaoCarregamentoService';

interface ModalIniciarExecucaoProps {
  execucao: ExecucaoCarregamento;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ModalIniciarExecucao({
  execucao,
  onClose,
  onUpdated,
}: ModalIniciarExecucaoProps) {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await updateExecucaoStatus(execucao.id, 'em_carregamento');
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl">
        <div className="p-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="font-bold text-stone-800">Iniciar Execução</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-4 text-sm text-stone-600">
          Confirmar início do carregamento para o veículo <strong>{execucao.placa_veiculo}</strong>?
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
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg disabled:bg-purple-300"
          >
            {saving ? 'Processando...' : 'Iniciar'}
          </button>
        </div>
      </div>
    </div>
  );
}
