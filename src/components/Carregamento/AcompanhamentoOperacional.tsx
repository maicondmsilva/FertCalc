import { AlertTriangle, CheckCircle, Clock, Package, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AlertaCarregamento, Carregamento } from '../../types/carregamento';
import { formatCarregamentoId } from '../../utils/formatId';

const STATUS_FINAL = new Set(['carregado', 'cancelado']);

export function calcularSaldoOperacional(carregamento: Carregamento): number {
  return Math.max(
    0,
    Number(carregamento.quantidade_liberada || 0) -
      Number(carregamento.quantidade_carregada || 0) -
      Number(carregamento.quantidade_cancelada || 0)
  );
}

export function diasEmAberto(carregamento: Carregamento, hoje = new Date()): number {
  const referencia = carregamento.data_liberacao || carregamento.criado_em;
  const inicio = new Date(referencia);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.max(0, Math.floor((hoje.getTime() - inicio.getTime()) / 86_400_000));
}

export function obterCarregamentosComSaldoAntigo(
  carregamentos: Carregamento[],
  limiteDias = 7,
  hoje = new Date()
): Carregamento[] {
  return carregamentos
    .filter(
      (carregamento) =>
        !STATUS_FINAL.has(carregamento.status) &&
        calcularSaldoOperacional(carregamento) > 0 &&
        diasEmAberto(carregamento, hoje) >= limiteDias
    )
    .sort((a, b) => diasEmAberto(b, hoje) - diasEmAberto(a, hoje));
}

function numeroCarregamento(carregamento: Carregamento) {
  return carregamento.numero != null
    ? formatCarregamentoId(carregamento.numero)
    : carregamento.numero_carregamento;
}

interface AcompanhamentoOperacionalProps {
  carregamentos: Carregamento[];
  alertas: AlertaCarregamento[];
  onAbrirExecucoes: (carregamento: Carregamento) => void;
  onMarcarAlertaLido: (alerta: AlertaCarregamento) => void;
}

export default function AcompanhamentoOperacional({
  carregamentos,
  alertas,
  onAbrirExecucoes,
  onMarcarAlertaLido,
}: AcompanhamentoOperacionalProps) {
  const ativos = carregamentos.filter((item) => !STATUS_FINAL.has(item.status));
  const comSaldoAntigo = obterCarregamentosComSaldoAntigo(ativos);
  const saldoTotal = ativos.reduce((total, item) => total + calcularSaldoOperacional(item), 0);
  const emExecucao = ativos.filter((item) => item.status === 'em_carregamento').length;

  return (
    <section className="space-y-4" aria-labelledby="acompanhamento-operacional-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="acompanhamento-operacional-title" className="font-bold text-stone-800">
            Acompanhamento operacional
          </h2>
          <p className="text-xs text-stone-500">
            Progresso dos carregamentos e saldos que precisam de atenção.
          </p>
        </div>
        <span className="text-xs font-semibold text-stone-500">
          Alerta de saldo antigo: 7 dias ou mais
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <TruckMetric icon={<Clock className="h-5 w-5" />} value={emExecucao} label="Em execução" />
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <TruckMetric
            icon={<AlertTriangle className="h-5 w-5" />}
            value={comSaldoAntigo.length}
            label="Saldos antigos"
          />
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <TruckMetric
            icon={<Package className="h-5 w-5" />}
            value={`${saldoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ton`}
            label="Saldo liberado a carregar"
          />
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Alertas recentes ({alertas.length})
          </div>
          <div className="space-y-2">
            {alertas.slice(0, 5).map((alerta) => (
              <div
                key={alerta.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-amber-100 bg-white p-3"
              >
                <div>
                  <p className="text-sm text-stone-700">{alerta.mensagem}</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {new Date(alerta.criado_em).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onMarcarAlertaLido(alerta)}
                  aria-label="Marcar alerta como lido"
                  title="Marcar como lido"
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {comSaldoAntigo.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            Carregamentos com saldo antigo
          </div>
          <div className="divide-y divide-stone-100">
            {comSaldoAntigo.slice(0, 8).map((carregamento) => {
              const liberado = Number(carregamento.quantidade_liberada || 0);
              const carregado = Number(carregamento.quantidade_carregada || 0);
              const progresso = liberado > 0 ? Math.min(100, (carregado / liberado) * 100) : 0;
              return (
                <div key={carregamento.id} className="p-4">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-stone-800">
                        {numeroCarregamento(carregamento)} ·{' '}
                        {carregamento.pedido_cliente_nome || carregamento.cliente_nome || 'Cliente não informado'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {calcularSaldoOperacional(carregamento).toFixed(3)} ton restantes ·{' '}
                        {diasEmAberto(carregamento)} dias em aberto
                      </p>
                    </div>
                    {['liberado_total', 'liberado_parcial', 'em_carregamento'].includes(
                      carregamento.status
                    ) && (
                      <button
                        type="button"
                        onClick={() => onAbrirExecucoes(carregamento)}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                      >
                        Ver execuções
                      </button>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100" aria-label={`Progresso ${progresso.toFixed(0)}%`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                    <span>{carregado.toFixed(3)} ton carregadas</span>
                    <span>{liberado.toFixed(3)} ton liberadas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alertas.length === 0 && comSaldoAntigo.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle className="h-5 w-5" /> Nenhuma pendência operacional crítica no momento.
        </div>
      )}
    </section>
  );
}

function TruckMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-stone-600">{icon}</span>
      <div>
        <p className="text-xl font-black text-stone-800">{value}</p>
        <p className="text-xs font-semibold text-stone-500">{label}</p>
      </div>
    </div>
  );
}
