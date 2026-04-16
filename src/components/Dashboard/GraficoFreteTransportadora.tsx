import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  nome: string;
  valor: number;
}

interface Props {
  data: DataPoint[];
  loading?: boolean;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function GraficoFreteTransportadora({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-48 mb-4" />
        <div className="h-52 bg-stone-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">
        Frete por Transportadora (Top 5 — mês atual)
      </h3>
      {data.length === 0 ? (
        <p className="text-center text-stone-400 py-16 text-sm">Sem dados disponíveis</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), 'Valor']} />
            <Bar dataKey="valor" name="Valor" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
