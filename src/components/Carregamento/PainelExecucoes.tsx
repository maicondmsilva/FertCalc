import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregamento, ExecucaoCarregamento } from '../../types/carregamento';
import { getExecucoesByCarregamento } from '../../services/execucaoCarregamentoService';
import ModalAgendarVeiculo from './ModalAgendarVeiculo';
import ModalIniciarExecucao from './ModalIniciarExecucao';
import ModalConcluirExecucao from './ModalConcluirExecucao';
import ModalCancelarSaldoSolicitacao from './ModalCancelarSaldoSolicitacao';
import { loadingBalance } from '../../utils/loadingBalance';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAgendar, setShowAgendar] = useState(false);
  const [iniciando, setIniciando] = useState<ExecucaoCarregamento | null>(null);
  const [concluindo, setConcluindo] = useState<ExecucaoCarregamento | null>(null);
  const [cancelandoSaldo, setCancelandoSaldo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getExecucoesByCarregamento(carregamento.id);
      setExecucoes(rows);
    } catch {
      setError('Não foi possível consultar as execuções. Atualize antes de movimentar o saldo.');
    } finally {
      setLoading(false);
    }
  }, [carregamento.id, carregamento.atualizado_em]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = useMemo(() => loadingBalance(carregamento, execucoes), [carregamento, execucoes]);
  const saldoAtual = balance.available;
  const unavailable =
    loading || !!error || ['carregado', 'cancelado'].includes(carregamento.status);

  const handleUpdated = async () => {
    await load();
    onChanged?.();
  };

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-stone-800">Execuções de Veículo</h4>
        <span className="text-xs text-stone-500">
          Liberado para agendar: <strong>{saldoAtual.toFixed(3)} ton</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-stone-600">
        <span>Solicitado: {balance.total.toFixed(3)} t</span>
        <span>Aguardando liberação: {balance.awaitingRelease.toFixed(3)} t</span>
        <span>Reservado em veículos: {balance.reserved.toFixed(3)} t</span>
        <span>Carregado: {balance.loaded.toFixed(3)} t</span>
        <span>Cancelado: {balance.cancelled.toFixed(3)} t</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={load}>
            Tentar novamente
          </button>
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAgendar(true)}
            disabled={unavailable || saldoAtual <= 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:bg-emerald-300"
          >
            Agendar Veículo
          </button>
          <button
            type="button"
            onClick={() => setCancelandoSaldo(true)}
            disabled={unavailable || balance.cancellable <= 0}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:bg-red-300"
          >
            Cancelar Saldo Restante
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-stone-500">Carregando execuções...</p>
      ) : error ? null : execucoes.length === 0 ? (
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
              {canManage && !unavailable && (
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
          saldoAtual={balance.cancellable}
          onClose={() => setCancelandoSaldo(false)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
