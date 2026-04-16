import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  mes: string;
  total: number;
  entregues: number;
}

interface Props {
  data: DataPoint[];
  loading?: boolean;
}

export default function GraficoCarregamentosMes({ data, loading }: Props) {
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
        Carregamentos por Mês (últimos 6 meses)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" name="Criados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="entregues" name="Entregues" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
