import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { RefreshCw, X, MapPin } from 'lucide-react';
import { Carregamento, Filial, Transportadora } from '../../types/carregamento';
import { getCarregamentosCalendario } from '../../services/carregamentoService';
import { subscribeToOrderLoadingChanges } from '../../services/orderLoadingSubscription';
import { STATUS_LABEL, StatusBadge, fmtCarregamentoNum, fmtDate } from './shared';

export function CalendarioCarregamentos({ currentUser }: { currentUser: User }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [eventos, setEventos] = useState<Carregamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Carregamento | null>(null);

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCarregamentosCalendario(mes, ano);
    setEventos(data);
    setLoading(false);
  }, [mes, ano]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToOrderLoadingChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 350);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  const navigate = (dir: number) => {
    setMes((m) => {
      let nm = m + dir;
      if (nm > 12) {
        setAno((y) => y + 1);
        return 1;
      }
      if (nm < 1) {
        setAno((y) => y - 1);
        return 12;
      }
      return nm;
    });
  };

  // Build calendar grid
  const firstDay = new Date(ano, mes - 1, 1).getDay();
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsForDay = (day: number) => {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventos.filter(
      (e) =>
        e.data_prevista_carregamento === dateStr ||
        (!e.data_prevista_carregamento && e.data_real_carregamento === dateStr)
    );
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && mes === today.getMonth() + 1 && ano === today.getFullYear();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
        >
          ‹
        </button>
        <h3 className="text-lg font-bold text-stone-800">
          {monthNames[mes - 1]} {ano}
        </h3>
        <button
          onClick={() => navigate(1)}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
        >
          ›
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        {[
          { label: 'Aguardando', color: 'bg-yellow-400' },
          { label: 'Liberado', color: 'bg-emerald-400' },
          { label: 'Em Carregamento', color: 'bg-purple-400' },
          { label: 'Carregado', color: 'bg-green-500' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-stone-600">
            <span className={`w-3 h-3 rounded-full ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-stone-200">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-stone-400 py-2 uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[80px] border-b border-r border-stone-100 bg-stone-50/50"
                  />
                );
              }
              const dayEvents = eventsForDay(day);
              return (
                <div
                  key={day}
                  className={`min-h-[80px] p-1.5 border-b border-r border-stone-100 ${isToday(day) ? 'bg-emerald-50' : 'hover:bg-stone-50'} cursor-default`}
                >
                  <p
                    className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-emerald-600 text-white' : 'text-stone-600'
                    }`}
                  >
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const dotColor =
                        e.status === 'carregado'
                          ? 'bg-green-500'
                          : ['liberado_total', 'liberado_parcial'].includes(e.status)
                            ? 'bg-emerald-400'
                            : e.status === 'em_carregamento'
                              ? 'bg-purple-400'
                              : 'bg-yellow-400';
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelected(e)}
                          className={`w-full text-left text-[9px] font-bold ${dotColor} text-white rounded px-1 py-0.5 truncate`}
                          title={`${fmtCarregamentoNum(e)} — ${STATUS_LABEL[e.status]}`}
                        >
                          {fmtCarregamentoNum(e)}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-stone-400">+{dayEvents.length - 3} mais</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-mono font-bold text-emerald-600">{fmtCarregamentoNum(selected)}</h4>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-stone-100 rounded">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Status</p>
              <StatusBadge status={selected.status} />
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Tipo</p>
              <span className="font-bold">{selected.tipo_frete}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Quantidade</p>
              <span>{selected.quantidade_total} ton</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Filial</p>
              <span>{selected.filial?.nome ?? '—'}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">
                Local de Carregamento
              </p>
              {selected.local_carregamento ? (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-stone-400" />
                  {selected.local_carregamento.nome}
                  {selected.local_carregamento.cidade && (
                    <span className="text-stone-500">
                      — {selected.local_carregamento.cidade}
                      {selected.local_carregamento.estado
                        ? `/${selected.local_carregamento.estado}`
                        : ''}
                    </span>
                  )}
                  {selected.local_carregamento.maps_url && (
                    <a
                      href={selected.local_carregamento.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-xs text-blue-600 hover:underline"
                      title="Abrir no Google Maps"
                    >
                      🗺️
                    </a>
                  )}
                </span>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Data Prevista</p>
              <span>{fmtDate(selected.data_prevista_carregamento)}</span>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Transportadora</p>
              <span>{selected.transportadora?.nome ?? '—'}</span>
            </div>
            {selected.observacoes && (
              <div className="col-span-2">
                <p className="text-xs text-stone-400 uppercase font-bold mb-0.5">Observações</p>
                <p className="text-stone-600">{selected.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIEW: Relatórios
// ─────────────────────────────────────────────────────────────────────────────
