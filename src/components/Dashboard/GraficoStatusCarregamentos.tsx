import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  status: string;
  count: number;
  color: string;
}

interface Props {
  data: DataPoint[];
  loading?: boolean;
}

export default function GraficoStatusCarregamentos({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-48 mb-4" />
        <div className="h-52 bg-stone-100 rounded-full mx-auto w-52" />
      </div>
    );
  }

  const filtered = data.filter((d) => d.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">
        Status dos Carregamentos (mês atual)
      </h3>
      {filtered.length === 0 ? (
        <p className="text-center text-stone-400 py-16 text-sm">Sem dados disponíveis</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {filtered.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
