import React, { useEffect, useMemo, useState } from 'react';
import { getCarregamentosByPedidoVenda } from '../services/carregamentoService';
import { Carregamento, ExecucaoCarregamento } from '../types/carregamento';

type CarregamentoComExecucoes = Carregamento & { execucoes?: ExecucaoCarregamento[] };

interface HistoricoCarregamentosPedidoProps {
  pedidoVendaId: string;
}

function Grupo({
  titulo,
  itens,
  mostrarExecucoes = false,
}: {
  titulo: string;
  itens: CarregamentoComExecucoes[];
  mostrarExecucoes?: boolean;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs uppercase font-bold text-stone-500">{titulo}</h4>
      <div className="space-y-2">
        {itens.map((item) => (
          <div key={item.id} className="border border-stone-200 rounded-lg p-2 bg-white">
            <div className="flex justify-between text-xs">
              <span className="font-mono font-bold text-stone-700">{item.numero_carregamento}</span>
              <span className="text-stone-500">{item.quantidade_total.toFixed(3)} ton</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Produto: {item.pedido_produto_nome || '—'} · Prev.:{' '}
              {item.data_prevista_carregamento
                ? new Date(item.data_prevista_carregamento + 'T00:00:00').toLocaleDateString(
                    'pt-BR'
                  )
                : '—'}
            </div>
            {mostrarExecucoes && (item.execucoes?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                {item.execucoes?.map((exec) => (
                  <div
                    key={exec.id}
                    className="text-[11px] text-stone-600 bg-stone-50 border border-stone-100 rounded px-2 py-1"
                  >
                    {exec.placa_veiculo} · {exec.motorista_nome} ·{' '}
                    {exec.quantidade_agendada.toFixed(3)} ton
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoricoCarregamentosPedido({
  pedidoVendaId,
}: HistoricoCarregamentosPedidoProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    aguardando_liberacao: Carregamento[];
    liberado: CarregamentoComExecucoes[];
    em_carregamento: CarregamentoComExecucoes[];
    carregado: CarregamentoComExecucoes[];
    cancelado: Carregamento[];
    resumo: { quantidade_solicitada: number; quantidade_carregada: number; percentual: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getCarregamentosByPedidoVenda(pedidoVendaId);
        if (!cancelled) setData(response);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pedidoVendaId]);

  const total = useMemo(() => data?.resumo.quantidade_solicitada ?? 0, [data]);
  const carregado = useMemo(() => data?.resumo.quantidade_carregada ?? 0, [data]);
  const percentual = useMemo(() => data?.resumo.percentual ?? 0, [data]);

  if (loading)
    return <div className="text-xs text-stone-500">Carregando histórico de carregamentos...</div>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
        <p className="text-xs text-stone-600 font-medium">
          {carregado.toFixed(3)} / {total.toFixed(3)} ton carregadas ({percentual.toFixed(1)}%)
        </p>
        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.min(100, percentual)}%` }}
          />
        </div>
      </div>

      <Grupo titulo="Aguardando Liberação" itens={data.aguardando_liberacao} />
      <Grupo titulo="Liberado" itens={data.liberado} />
      <Grupo titulo="Em Carregamento" itens={data.em_carregamento} mostrarExecucoes />
      <Grupo titulo="Concluído" itens={data.carregado} mostrarExecucoes />
      <Grupo titulo="Cancelados" itens={data.cancelado} />
    </div>
  );
}
