import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregamento, ExecucaoCarregamento } from '../../types/carregamento';
import { getExecucoesByCarregamento } from '../../services/execucaoCarregamentoService';
import ModalAgendarVeiculo from './ModalAgendarVeiculo';
import ModalIniciarExecucao from './ModalIniciarExecucao';
import ModalConcluirExecucao from './ModalConcluirExecucao';
import ModalCancelarSaldoSolicitacao from './ModalCancelarSaldoSolicitacao';

interface PainelExecucoesProps {
  carregamento: Carregamento;
  currentUserId: string;
  canManage: boolean;
  onChanged?: () => void;
}

export default function PainelExecucoes({
  carregamento,
  currentUserId,
  canManage,
  onChanged,
}: PainelExecucoesProps) {
  const [execucoes, setExecucoes] = useState<ExecucaoCarregamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);
  const [iniciando, setIniciando] = useState<ExecucaoCarregamento | null>(null);
  const [concluindo, setConcluindo] = useState<ExecucaoCarregamento | null>(null);
  const [cancelandoSaldo, setCancelandoSaldo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getExecucoesByCarregamento(carregamento.id);
      setExecucoes(rows);
    } finally {
      setLoading(false);
    }
  }, [carregamento.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saldoAtual = useMemo(() => {
    const totalConcluido = execucoes
      .filter((e) => e.status === 'concluido')
      .reduce((acc, e) => acc + Number(e.quantidade_carregada ?? 0), 0);
    const totalReservado = execucoes
      .filter((e) => e.status === 'agendado' || e.status === 'em_carregamento')
      .reduce((acc, e) => acc + Number(e.quantidade_agendada ?? 0), 0);
    return (
      Number(carregamento.quantidade_total ?? 0) -
      totalConcluido -
      totalReservado -
      Number(carregamento.quantidade_cancelada ?? 0)
    );
  }, [carregamento.quantidade_total, carregamento.quantidade_cancelada, execucoes]);

  const handleUpdated = async () => {
    await load();
    onChanged?.();
  };

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-stone-800">Execuções de Veículo</h4>
        <span className="text-xs text-stone-500">
          Saldo atual da solicitação: <strong>{saldoAtual.toFixed(3)} ton</strong>
        </span>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAgendar(true)}
            disabled={saldoAtual <= 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:bg-emerald-300"
          >
            Agendar Veículo
          </button>
          <button
            type="button"
            onClick={() => setCancelandoSaldo(true)}
            disabled={saldoAtual <= 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:bg-red-300"
          >
            Cancelar Saldo Restante
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-stone-500">Carregando execuções...</p>
      ) : execucoes.length === 0 ? (
        <p className="text-xs text-stone-500">Nenhuma execução agendada.</p>
      ) : (
        <div className="space-y-2">
          {execucoes.map((exec) => (
            <div key={exec.id} className="border border-stone-200 rounded-lg p-2 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-stone-700">{exec.placa_veiculo}</span>
                <span className="uppercase text-stone-500">{exec.status}</span>
              </div>
              <div className="text-stone-500 mt-1">
                {exec.motorista_nome} · Agendado: {exec.quantidade_agendada.toFixed(3)} ton
              </div>
              {canManage && (
                <div className="mt-2 flex gap-2">
                  {exec.status === 'agendado' && (
                    <button
                      type="button"
                      onClick={() => setIniciando(exec)}
                      className="px-2 py-1 rounded border border-purple-300 text-purple-700 font-bold"
                    >
                      Iniciar
                    </button>
                  )}
                  {exec.status === 'em_carregamento' && (
                    <button
                      type="button"
                      onClick={() => setConcluindo(exec)}
                      className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 font-bold"
                    >
                      Concluir
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAgendar && (
        <ModalAgendarVeiculo
          carregamento={carregamento}
          saldoAtual={saldoAtual}
          currentUserId={currentUserId}
          onClose={() => setShowAgendar(false)}
          onCreated={() => {
            setShowAgendar(false);
            handleUpdated();
          }}
        />
      )}
      {iniciando && (
        <ModalIniciarExecucao
          execucao={iniciando}
          onClose={() => setIniciando(null)}
          onUpdated={handleUpdated}
        />
      )}
      {concluindo && (
        <ModalConcluirExecucao
          execucao={concluindo}
          onClose={() => setConcluindo(null)}
          onUpdated={handleUpdated}
        />
      )}
      {cancelandoSaldo && (
        <ModalCancelarSaldoSolicitacao
          carregamento={carregamento}
          saldoAtual={saldoAtual}
          onClose={() => setCancelandoSaldo(false)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
