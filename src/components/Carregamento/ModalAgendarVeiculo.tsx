import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Carregamento, ExecucaoCarregamento } from '../../types/carregamento';
import { createExecucao } from '../../services/execucaoCarregamentoService';

interface ModalAgendarVeiculoProps {
  carregamento: Carregamento;
  saldoAtual: number;
  currentUserId: string;
  onClose: () => void;
  onCreated: (execucao: ExecucaoCarregamento) => void;
}

export default function ModalAgendarVeiculo({
  carregamento,
  saldoAtual,
  currentUserId,
  onClose,
  onCreated,
}: ModalAgendarVeiculoProps) {
  const [motoristaNome, setMotoristaNome] = useState('');
  const [motoristaCpf, setMotoristaCpf] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [placaCarreta, setPlacaCarreta] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantidadeNum = Number(quantidade || 0);
    if (quantidadeNum <= 0 || quantidadeNum > saldoAtual) return;

    setSaving(true);
    try {
      const created = await createExecucao({
        carregamento_id: carregamento.id,
        motorista_nome: motoristaNome,
        motorista_cpf: motoristaCpf || undefined,
        placa_veiculo: placaVeiculo,
        placa_carreta: placaCarreta || undefined,
        quantidade_agendada: quantidadeNum,
        data_agendamento: dataAgendamento || undefined,
        criado_por: currentUserId,
      });
      onCreated(created);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-xl shadow-xl">
        <div className="p-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="font-bold text-stone-800">Agendar Veículo</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-stone-500">
            Saldo atual da solicitação: <strong>{saldoAtual.toFixed(3)} ton</strong>
          </p>
          <input
            value={motoristaNome}
            onChange={(e) => setMotoristaNome(e.target.value)}
            placeholder="Motorista (nome)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            required
          />
          <input
            value={motoristaCpf}
            onChange={(e) => setMotoristaCpf(e.target.value)}
            placeholder="CPF do motorista"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
          <input
            value={placaVeiculo}
            onChange={(e) => setPlacaVeiculo(e.target.value.toUpperCase())}
            placeholder="Placa do veículo"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            required
          />
          <input
            value={placaCarreta}
            onChange={(e) => setPlacaCarreta(e.target.value.toUpperCase())}
            placeholder="Placa da carreta (opcional)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
          <input
            type="number"
            min={0.001}
            max={saldoAtual}
            step={0.001}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Quantidade a carregar (ton)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            required
          />
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider pl-1">
              Data do Carregamento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataAgendamento}
              onChange={(e) => setDataAgendamento(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-700"
              required
            />
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold border border-stone-300 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg disabled:bg-emerald-300"
          >
            {saving ? 'Salvando...' : 'Agendar'}
          </button>
        </div>
      </form>
    </div>
  );
}
